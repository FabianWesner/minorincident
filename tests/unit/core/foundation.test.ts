import { expect, test } from 'vitest';
import { Clock } from '../../../src/core/Clock';
import { EventBus } from '../../../src/core/EventBus';
import { Rng } from '../../../src/core/Rng';
import { Services } from '../../../src/core/Services';
import { SpatialHash } from '../../../src/sim/spatial/SpatialHash';

test('T-E01-02a @E01 @E01-AC02 fixed 60 Hz, interpolation and capped catch-up', () => {
  const clock = new Clock();
  let ticks = 0;
  clock.advance(1 / 120, () => ticks++);
  expect(ticks).toBe(0);
  expect(clock.alpha).toBeCloseTo(0.5);
  clock.advance(1 / 120, () => ticks++);
  expect(ticks).toBe(1);
  clock.advance(1, () => ticks++);
  expect(ticks).toBe(6);
  expect(clock.alpha).toBeLessThan(1);
  clock.pause();
  clock.advance(1, () => ticks++);
  expect(ticks).toBe(6);
  expect(() => clock.setTimeScale(-1)).toThrow(RangeError);
  expect(() => clock.setTimeScale(NaN)).toThrow(RangeError);
});

test('T-E22-20-catchup @E22-AC20 @E01-AC02 a budgeted frame defers owed ticks instead of a catch-up spiral, and loses none', () => {
  // Fake CPU clock: each tick costs `cost[tick]` ms.
  let now = 0, ticks = 0;
  const cost = (tick: number) => tick === 3 ? 21 : tick === 4 ? 24 : 6;
  const clock = new Clock(20, 25, () => now), step = () => { now += cost(ticks); ticks++; };
  const frames: number[] = [], spent: number[] = [];
  // 33 ms frames: two ticks owed most frames; the expensive ticks 3 and 4 never share a frame.
  for (let frame = 0; frame < 30; frame++) { const t = now; frames.push(clock.advance(1 / 30, step)); spent.push(now - t); }
  expect(frames.slice(0, 3)).toEqual([2, 2, 1]);
  expect(Math.max(...spent)).toBeLessThanOrEqual(27);
  // Unbudgeted, the frame after tick 3 pays for ticks 4 and 5 together.
  const old = new Clock(20); let oldTicks = 0, oldNow = 0; const oldSpent: number[] = [];
  for (let frame = 0; frame < 4; frame++) { const t = oldNow; old.advance(1 / 30, () => { oldNow += cost(oldTicks); oldTicks++; }); oldSpent.push(oldNow - t); }
  expect(Math.max(...oldSpent)).toBe(30);
  // Every owed tick runs: 30 frames of 1/30 s are 60 ticks, the remainder is still owed, not dropped.
  expect(ticks + clock.deferred).toBe(60);
  expect(clock.alpha).toBeLessThanOrEqual(1);
  // An unbudgeted clock (and a fast-forward time scale) keep the full catch-up.
  const free = new Clock(20); let n = 0; free.advance(.2, () => n++); expect(n).toBe(12);
  const fast = new Clock(20, 25, () => now); fast.setTimeScale(4); let m = 0; fast.advance(1 / 30, () => { now += 10; m++; }); expect(m).toBe(8);
  // A slow renderer (150 ms frames) may spend half its frame on ticks: 9 cheap ticks still fit.
  const slow = new Clock(20, 25, () => now); let k = 0; slow.advance(.15, () => { now += 6; k++; }); expect(k).toBe(9);
});

test('T-E01-09 @E01 @E01-AC09 ordered typed events and a 10k ring', () => {
  const bus = new EventBus<{ tick: number; type: 'test'; value: number }>();
  const order: number[] = [];
  bus.on('test', () => order.push(3), 3);
  const off = bus.on('test', () => order.push(0), 0);
  bus.on('test', () => order.push(1), 3);
  bus.emit({ tick: 0, type: 'test', value: 1 });
  expect(order).toEqual([0, 3, 1]);
  off(); off();
  expect(bus.listenerCount).toBe(2);
  for (let tick = 1; tick <= 10005; tick++) bus.emit({ tick, type: 'test', value: tick });
  expect(bus.events()).toHaveLength(10000);
  expect(bus.events()[0].tick).toBe(6);
  expect(bus.events(10003).map((e) => e.tick)).toEqual([10004, 10005]);
  const events = bus.events(); events[0].value = -1;
  expect(bus.events()[0].value).toBe(6);
  bus.reset();
  expect(bus.events()).toEqual([]);
  expect(bus.listenerCount).toBe(0);
});

test('T-E01-core @E01 seeded streams and service lifecycle ownership', async () => {
  const a = new Rng(1, 'fixture'), b = new Rng(1, 'fixture'), other = new Rng(1, 'ai');
  expect(Array.from({ length: 100 }, () => a.next())).toEqual(Array.from({ length: 100 }, () => b.next()));
  expect(other.next()).not.toBe(new Rng(1, 'fixture').next());
  const calls: string[] = [];
  const services = new Services();
  for (const name of ['a', 'b']) services.add({ init: () => { calls.push(`init ${name}`); }, update: () => { calls.push(`update ${name}`); }, reset: () => { calls.push(`reset ${name}`); }, dispose: () => { calls.push(`dispose ${name}`); } });
  await services.init(); services.update(); services.reset(); services.dispose();
  expect(calls).toEqual(['init a', 'init b', 'update a', 'update b', 'reset b', 'reset a', 'dispose b', 'dispose a']);
});

test('T-E01-spatial @E01 spatial hash handles negative cells, moves and reset', () => {
  const hash = new SpatialHash();
  hash.set(1, -1, -1); hash.set(2, 5, 0); hash.set(3, -5, -5);
  expect(hash.query({ x: 0, z: 0, r: 2 })).toEqual([1]);
  hash.set(1, 10, 10);
  expect(hash.query({ x: 0, z: 0, r: 2 })).toEqual([]);
  hash.delete(2);
  hash.reset();
  expect(hash.query({ x: 0, z: 0, r: 100 })).toEqual([]);
});


test('spatial buckets retain insertion order and reuse positions without stale IDs', () => {
  const hash = new SpatialHash(), query = { x: 0, z: 0, r: 2 };
  hash.set(3, 0, 0); hash.set(1, 1, 0); hash.set(2, 0, 1);
  hash.set(3, .5, .5);
  expect(hash.query(query, [], false)).toEqual([3, 1, 2]);
  expect(hash.query(query)).toEqual([1, 2, 3]);
  hash.delete(1); hash.set(8, 1, 0);
  expect(hash.query(query, [], false)).toEqual([3, 2, 8]);
  hash.set(3, -5, 0); hash.set(3, 0, 0);
  expect(hash.query(query, [], false)).toEqual([2, 8, 3]);
  const visited: number[] = []; expect(hash.query(query, [], false, id => visited.push(id))).toEqual([]);
  expect(visited).toEqual([2, 8, 3]);
  for (const bad of [NaN, Infinity, -1]) expect(() => hash.query({ ...query, r: bad })).toThrow(RangeError);
});

test('contact bounds stay conservative during moves and refresh radii each phase', () => {
  const hash = new SpatialHash(), query = { x: 0, z: 0, r: 12 }, radii = new Map([[1, .35], [2, 2]]);
  const contacts = { epoch: 0, radius: (id: number) => radii.get(id) ?? 0, intersects: (maximum: number) => maximum >= 1 };
  hash.set(1, 0, 0); hash.set(2, 8, 0);
  expect(hash.query(query, [], false, undefined, contacts)).toEqual([2]);
  hash.set(2, 1, 0);
  expect(hash.query(query, [], false, undefined, contacts)).toEqual([1, 2]);
  hash.delete(2); contacts.epoch++;
  expect(hash.query(query, [], false, undefined, contacts)).toEqual([]);
  radii.set(1, 2); contacts.epoch++;
  expect(hash.query(query, [], false, undefined, contacts)).toEqual([1]);
  contacts.radius = () => .35;
  expect(hash.query(query, [], false, undefined, contacts)).toEqual([]);
  hash.reset();
  expect(hash.query(query, [], false, undefined, contacts)).toEqual([]);
});
