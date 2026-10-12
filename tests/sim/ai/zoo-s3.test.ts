import { expect, test } from 'vitest';
import { Clock } from '../../../src/core/Clock';
import { infectedSpecialMoves, type InfectedSpecialMove } from '../../../src/data/infected';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { arena, spawn, step } from './helpers';
type World = Awaited<ReturnType<typeof arena>>;
function player(w: World, x: number, z = 0) {
  const e = w.entities.get(1)!; Object.assign(e.transform, { x, z });
  w.physics.playerBody!.setTranslation(e.transform, true); w.player!.locomotion.reset(); w.spatial.set(1, x, z); return e;
}
function human(w: World, x: number, z: number) {
  const e = w.entities.get(w.npcs!.civilians.spawn('officer', { x, z }))!;
  e.civilian!.state = 'annoyed'; e.civilian!.until = 10000; return e;
}
function start(w: World, e: EntitySnapshot, move: InfectedSpecialMove, x = 20, z = 0) {
  expect(w.infected!.startSpecial(e.id, move, { id: 1, x, z }, { x: e.transform.x, z: e.transform.z, radius: 1, dx: 1, dz: 0 })).toBe(true);
  return e.infected!.specialAttack!;
}
function group(w: World, move: InfectedSpecialMove) {
  const species = move.split('.')[0], e = spawn(w, species, 0, 0, 'idle');
  if (move !== 'zebra.kick') { spawn(w, species, -2, 0, 'idle'); if (move === 'flamingo.dive') spawn(w, species, 0, -2, 'idle'); }
  return e;
}
function wall(w: World, x: number, halfZ = 2) {
  const shape = { x, z: 0, y: 1, halfX: .1, halfZ, halfY: 1 };
  (w.combat!.query.walls as typeof shape[]).push(shape);
}
for (const move of ['zebra.kick', 'zebra.stampede', 'flamingo.dive'] as const) {
  test(`T-E07-19-${move}-timing @E07-AC05 @E07-AC19 pause, telegraph, recovery, serialized group/cooldown, exact next activation`, async () => {
    const w = await arena(); player(w, 25); const e = group(w, move), timing = infectedSpecialMoves[move];
    const a = start(w, e, move), initial = structuredClone(e.transform);
    const clock = new Clock(); clock.pause(); clock.advance(1, () => w.update()); expect(w.tick).toBe(0);
    step(w, timing.windup - 1); expect(a.stage).toBe('telegraph'); expect(e.transform.x).toBe(initial.x); expect(e.transform.z).toBe(initial.z); expect(e.transform.y).toBe(initial.y); expect(e.transform.yaw).toBeCloseTo(initial.yaw, 12);
    expect(w.events.events().filter(ev => ev.type === 'infected.attack')).toHaveLength(0); expect(a.obstructionUntil).toBeUndefined();
    const tell = w.events.events().find(ev => ev.type === 'telegraph' && ev.attackId === a.attackId);
    expect(tell).toMatchObject({ sourceId: e.id, move, startTick: 0, activeTick: timing.windup, cooldownExpiry: timing.windup + timing.cooldown, target: a.target, area: a.area });
    step(w, 1); expect(a.stage).not.toBe('telegraph'); step(w, 200);
    expect(e.infected!.specialRecoveryUntil).toBeGreaterThanOrEqual(a.activeTick + 36);
    for (const member of w.infected!.active) { member.infected = JSON.parse(JSON.stringify(member.infected)); w.infected!.restoreSpecialTimers(member.infected!, 123); delete member.infected!.specialAttack; member.infected!.state = 'idle'; member.infected!.cooldown = 0; member.infected!.specialRecoveryUntil = 0; }
    Object.assign(e.transform, { x: 0, z: 0 }); for (const [i, id] of (a.members ?? []).filter(id => id !== e.id).entries()) Object.assign(w.entities.get(id)!.transform, { x: -2 - i * 2, z: 0 });
    w.tick = a.cooldownExpiry + 123 - timing.windup - 1;
    expect(w.infected!.startSpecial(e.id, move, a.target, a.area)).toBe(false); w.tick++;
    const next = start(w, e, move); expect(next.activeTick - (a.activeTick + 123)).toBe(timing.cooldown);
    expect(next.attackId).toBeGreaterThan(a.attackId); expect(w.infected!.startSpecial(e.id, move, a.target, a.area)).toBe(false);
  });
}
test('T-E07-19-zebra-kick @E07-AC01 @E07-AC19 rear 90 degree/2m boundary, 20 damage, 3m shove and 36 tick stagger; front/cover/protected controls', async () => {
  const w = await arena(); player(w, 25); const e = group(w, 'zebra.kick'); expect(e.health).toEqual({ current: 180, max: 180 });
  const edge = human(w, -Math.SQRT2, Math.SQRT2), outside = human(w, -Math.SQRT2 + .001, -Math.SQRT2), front = human(w, 1.8, 0), far = human(w, -2.001, 0), cover = human(w, -1.8, 0);
  const child = w.entities.get(w.npcs!.escorts.spawn({ x: -1, z: -.8 }, true))!; const childHp = child.health.current;
  wall(w, -1, .4); const a = start(w, e, 'zebra.kick'); expect(a.area).toMatchObject({ dx: -1, dz: 0, radius: 2 });
  step(w, 35); expect(edge.health.current).toBe(100); step(w, 1);
  expect(edge.health.current).toBe(80); expect(edge.combat!.staggerUntil).toBe(w.tick + 36); expect(edge.civilian!.knockedUntil).toBe(0);
  expect(Math.hypot(edge.transform.x + Math.SQRT2, edge.transform.z - Math.SQRT2)).toBeGreaterThanOrEqual(3 - 1e-8);
  for (const t of [outside, front, far, cover]) expect(t.health.current).toBe(100); expect(child.health.current).toBe(childHp);
  step(w, 10); expect(w.events.events().filter(ev => ev.type === 'combat.hit' && ev.attackId === a.attackId)).toHaveLength(1);
});
test('T-E07-19-zebra-stampede @E07-AC19 existing 2-4 zebras, locked 10m/s, 15m, 1.5m sweep and one hit per zebra', async () => {
  const w = await arena(); player(w, 25); const e = group(w, 'zebra.stampede');
  const inside = human(w, 5, .75), outside = human(w, 5, -.751), a = start(w, e, 'zebra.stampede');
  expect(a.members).toHaveLength(2); const count = w.infected!.active.length;
  step(w, 47); expect(inside.health.current).toBe(100); step(w, 1); expect(e.transform.x).toBeCloseTo(10 / 60);
  player(w, 25, 8); step(w, 89); expect(e.transform.x).toBeCloseTo(15); expect(e.transform.z).toBe(0); expect(a.stage).toBe('recovery');
  expect(inside.health.current).toBe(50); expect(outside.health.current).toBe(100); expect(w.infected!.active.length).toBe(count);
  const hits = w.events.events().filter(ev => ev.type === 'combat.hit' && ev.targetId === inside.id);
  expect(hits).toHaveLength(2); expect(new Set(hits.map(h => h.type === 'combat.hit' ? h.attackId : 0)).size).toBe(2); expect(inside.civilian!.knockedUntil).toBe(hits[1].tick + 60);
});
test('T-E07-19-zebra-stampede-wall @E07-AC19 intact walls stop every participant and remain intact', async () => {
  const w = await arena(); player(w, 25); const e = group(w, 'zebra.stampede'), behind = human(w, 5, 0); wall(w, 4);
  const id = w.barricades!.spawn({ id: 'line', groupId: 'line', a: { x: 2, z: -3 }, b: { x: 2, z: 3 }, height: 1, initialHp: 300 });
  const a = start(w, e, 'zebra.stampede'); step(w, 110);
  for (const member of a.members!) expect(w.entities.get(member)!.transform.x).toBeLessThan(1.5);
  expect(behind.health.current).toBe(100); expect(w.entities.get(id)!.health.current).toBe(300);
});
test('T-E07-19-group-controls @E07-AC19 no phantom herd/flock, cap, 12m acquisition, busy/dead/occluded animals excluded', async () => {
  const w = await arena(); player(w, 25); const e = spawn(w, 'zebra', 0, 0, 'idle');
  expect(w.infected!.startSpecial(e.id, 'zebra.stampede', { id: 1, x: 20, z: 0 }, { x: 0, z: 0, dx: 1, dz: 0, radius: 1 })).toBe(false);
  const far = spawn(w, 'zebra', 12.001, 0, 'idle');
  expect(w.infected!.startSpecial(e.id, 'zebra.stampede', { id: 1, x: 20, z: 0 }, { x: 0, z: 0, dx: 1, dz: 0, radius: 1 })).toBe(false);
  for (let i = 0; i < 6; i++) spawn(w, 'zebra', -2 - i, 0, 'idle');
  const a = start(w, e, 'zebra.stampede'); expect(a.members).toHaveLength(4); expect(a.members).not.toContain(far.id);
});
test('T-E07-19-flamingo-dive @E07-AC19 existing birds steer, locked 3m area, 5 HP/36 tick stagger once, 48 tick obstruction expiry', async () => {
  const w = await arena(); const p = player(w, 2), e = group(w, 'flamingo.dive'), edge = human(w, 2, 3), outside = human(w, 2, -3.001);
  const a = start(w, e, 'flamingo.dive', 2); expect(a.members).toHaveLength(3); expect(a.area).toMatchObject({ x: 2, z: 0, radius: 3 });
  step(w, 35); expect(e.transform.y).toBe(.7); expect(p.health.current).toBe(100); step(w, 1); expect(e.transform.y).toBeCloseTo(.7, 12);
  step(w, 24); expect(p.health.current).toBe(95); expect(p.combat!.staggerUntil).toBe(w.tick + 36); expect(p.survivor!.knockdown).toBeUndefined();
  expect(edge.health.current).toBe(95); expect(outside.health.current).toBe(100); expect(a.obstructionUntil).toBe(w.tick + 48);
  step(w, 47); expect(w.events.events().filter(ev => ev.type === 'infected.attack' && ev.special === 'flamingo.dive' && ev.targetId === 1)).toHaveLength(1);
  step(w, 1); expect(a.obstructionUntil).toBe(w.tick); expect(e.transform.y).toBe(.7); step(w, 12); expect(e.infected!.specialAttack).toBeUndefined();
});
test('T-E07-19-flamingo-dive-wall @E07-AC19 flock cannot affect a target through solid geometry', async () => {
  const w = await arena(); const p = player(w, 8), e = group(w, 'flamingo.dive'); wall(w, 4, 30);
  const a = start(w, e, 'flamingo.dive', 8); step(w, 60); expect(p.health.current).toBe(100); expect(a.obstructionUntil).toBeUndefined();
  for (const id of a.members!) expect(w.entities.get(id)!.transform.x).toBeLessThan(4);
});

const checkpoint: import('../../../src/sim/missions/types').MissionDef = { id: 'zoo-restore', briefing: 'Zoo', anchors: { spawn: { x: 0, z: 0, radius: 2 } }, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: ['C'], cinematics: {}, steps: [{ id: 'wait', type: 'custom', text: 'Wait', anchor: 'spawn', start: { kind: 'start' }, complete: { kind: 'timer', seconds: 1000 }, fail: [] }], finish: ['wait'], onStart: [], onComplete: [] };
for (const move of ['zebra.kick', 'zebra.stampede', 'flamingo.dive'] as const) test(`T-E07-19-${move}-checkpoint @E07-AC05 @E07-AC19 production checkpoint restores group, locked area, hit set and independent cooldowns`, async () => {
  const w = await arena(); player(w, 25); const mission = w.loadMission(checkpoint); mission.begin();
  const e = group(w, move); start(w, e, move); step(w, infectedSpecialMoves[move].windup + 5); mission.checkpoint('C');
  const savedTick = w.tick, saved = structuredClone(e.infected!); step(w, 20); mission.restore('C'); const restored = w.entities.get(e.id)!.infected!;
  expect(restored.specialCooldowns![move]! - w.tick).toBe(saved.specialCooldowns![move]! - savedTick);
  expect(restored.specialAttack!.hitIds).toEqual(saved.specialAttack!.hitIds); expect(restored.specialAttack!.area).toEqual(saved.specialAttack!.area);
  expect(restored.specialAttack!.members).toEqual(saved.specialAttack!.members);
  for (const id of restored.specialAttack!.members ?? []) expect(w.entities.get(id)!.infected!.specialCooldowns![move]).toBe(restored.specialCooldowns![move]);
});

test('T-E07-19-zebra-stampede-player @E07-AC19 every distinct zebra deals 25HP even inside the ordinary hurt grace window', async () => {
  const w = await arena(); const p = player(w, 5), e = group(w, 'zebra.stampede'); const a = start(w, e, 'zebra.stampede', 5);
  step(w, 110); expect(p.health.current).toBe(50);
  const hits = w.events.events().filter(ev => ev.type === 'infected.attack' && ev.special === 'zebra.stampede' && ev.targetId === 1);
  expect(hits).toHaveLength(2); expect(a.hitIds).toContain(1);
});
test('T-E07-19-flamingo-dive-lock @E07-AC19 moving target does not drag the marked area; small/absent flock cannot create a dive', async () => {
  const w = await arena(); const p = player(w, 2), e = group(w, 'flamingo.dive'); const a = start(w, e, 'flamingo.dive', 2);
  step(w, 35); player(w, 5.001); step(w, 25); expect(a.area.x).toBe(2); expect(p.health.current).toBe(100); expect(a.obstructionUntil).toBeUndefined();
  for (const id of a.members!) w.entities.get(id)!.health.current = 0;
  step(w, 1); expect(p.health.current).toBe(100);
});
test('T-E07-19-zoo-stagger-lethal @E07-AC19 lethal kick/dive finishes a civilian instead of leaving a zero-HP moving brain', async () => {
  for (const move of ['zebra.kick', 'flamingo.dive'] as const) {
    const w = await arena(); player(w, 25); const e = group(w, move), victim = human(w, move === 'zebra.kick' ? -1.8 : 2, 0);
    victim.health.current = move === 'zebra.kick' ? 20 : 5;
    start(w, e, move, 2); step(w, move === 'zebra.kick' ? 36 : 60);
    expect(victim.health.current).toBe(0); expect(victim.civilian!.state).toBe('finished'); expect(victim.civilian!.entered).toBe(w.tick);
    const at = { ...victim.transform }; step(w, 10); expect(victim.transform).toEqual(at);
  }
});
