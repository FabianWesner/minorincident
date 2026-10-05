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
