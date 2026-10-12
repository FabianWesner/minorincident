import { expect, test } from 'vitest';
import * as RAPIER from '@dimforge/rapier3d-compat';
import type { MissionDef } from '../../../src/sim/missions/types';
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
function wall(w: World, x: number, halfZ = 2) {
  const shape = { x, z: 0, y: 1, halfX: .1, halfZ, halfY: 1 };
  (w.combat!.query.walls as typeof shape[]).push(shape);
  w.infected!.hearing.los.register({ id: 'wall', active: true, source: 'building', shape: { kind: 'aabb', min: { x: x - .1, z: -halfZ }, max: { x: x + .1, z: halfZ } } });
}
for (const move of ['gorilla.grab-throw', 'elephant.charge', 'elephant.swipe'] as const) {
  test(`T-E07-19-${move.replace('.', '-')}-timing @E07-AC05 @E07-AC19 telegraph, pause, recovery and exact restored activation interval`, async () => {
    const w = await arena(); player(w, 25); const e = spawn(w, move.split('.')[0], 0, 0, 'idle');
    const a = start(w, e, move), timing = infectedSpecialMoves[move];
    const clock = new Clock(); clock.pause(); clock.advance(1, () => w.update()); expect(w.tick).toBe(0);
    step(w, timing.windup - 1); expect(a.stage).toBe('telegraph'); expect(e.transform.x).toBe(0); expect(w.entities.get(1)!.health.current).toBe(100);
    expect(w.events.events().filter(ev => ev.type === 'infected.attack')).toHaveLength(0);
    step(w, 1); expect(a.stage).not.toBe('telegraph');
    step(w, 160); expect(e.infected!.specialRecoveryUntil).toBeGreaterThanOrEqual(a.activeTick + 36);
    e.infected = JSON.parse(JSON.stringify(e.infected)); w.tick += 123; w.infected!.restoreSpecialTimers(e.infected!, 123);
    delete e.infected!.specialAttack; e.infected!.state = 'idle'; e.infected!.cooldown = 0; Object.assign(e.transform, { x: 0, z: 0 });
    w.tick = a.cooldownExpiry + 123 - timing.windup - 1;
    expect(w.infected!.startSpecial(e.id, move, a.target, a.area)).toBe(false); w.tick++;
    const next = start(w, e, move); expect(next.activeTick - (a.activeTick + 123)).toBe(timing.cooldown);
    expect(next.attackId).toBeGreaterThan(a.attackId); expect(w.infected!.startSpecial(e.id, move, a.target, a.area)).toBe(false);
  });
}
test('T-E07-19-elephant-charge @E07-AC19 locked 8m/s, 16m range, exact 3.5m sweep, 40 HP and 90 tick knockdown once', async () => {
  const w = await arena(); player(w, 25); const e = spawn(w, 'elephant', 0, 0, 'idle');
  expect(e.health).toEqual({ current: 1200, max: 1200 });
  const inside = human(w, 5, 1.75), outside = human(w, 5, -1.751), a = start(w, e, 'elephant.charge');
  expect(a.area.radius).toBe(1.75); step(w, 53); expect(inside.health.current).toBe(100);
  step(w, 1); expect(e.transform.x).toBeCloseTo(8 / 60); player(w, 25, 8); step(w, 119);
  expect(e.transform.x).toBeCloseTo(16); expect(e.transform.z).toBe(0); expect(e.transform.yaw).toBe(0); expect(a.stage).toBe('recovery');
  expect(inside.health.current).toBe(60); expect(outside.health.current).toBe(100);
  const hits = w.events.events().filter(ev => ev.type === 'combat.hit' && ev.attackId === a.attackId && ev.targetId === inside.id);
  expect(hits).toHaveLength(1); expect(inside.civilian!.knockedUntil).toBe(hits[0].tick + 90);
});
test('T-E07-19-elephant-charge-wall @E07-AC19 wall stops the body and blocks sweep damage', async () => {
  const w = await arena(); player(w, 25); const e = spawn(w, 'elephant', 0, 0, 'idle'), behind = human(w, 5, 0); wall(w, 4);
  start(w, e, 'elephant.charge'); step(w, 100); expect(e.transform.x).toBeLessThan(2.71); expect(behind.health.current).toBe(100);
});
test('T-E07-19-elephant-charge-barricade @E07-AC19 400 HP slot damage clears nav in the impact tick, keeps debris and source logs', async () => {
  const w = await arena(); player(w, 25); const e = spawn(w, 'elephant', 0, 0, 'idle');
  const id = w.barricades!.spawn({ id: 'line', groupId: 'line', a: { x: 4, z: -3 }, b: { x: 4, z: 3 }, height: 1, initialHp: 400 });
  start(w, e, 'elephant.charge'); while (w.entities.get(id)!.barricade!.intact && w.tick < 100) step(w, 1);
  expect(w.entities.get(id)!.barricade!.intact).toBe(false); expect(w.combat!.query.visible({ x: 0, z: 0 }, { x: 8, z: 0 })).toBe(true);
  expect(w.infected!.nav.walls.some(v => v.x === 4 && v.z === 0)).toBe(false);
  expect(w.events.events().find(ev => ev.type === 'barricade.damaged' && ev.id === id)).toMatchObject({ sourceId: e.id, slotId: 'line', previousHp: 400, hp: 0, amount: 400 });
  expect(w.entities.get(id)).toBeDefined(); step(w, 30); expect(e.transform.x).toBeGreaterThan(4);
});
test('T-E07-19-elephant-charge-vehicle @E07-AC19 light E09 chassis takes 80 HP and physical lateral impulse; heavy vehicle unaffected', async () => {
  const w = await arena(); player(w, 25); const e = spawn(w, 'elephant', 0, 0, 'idle');
  const lightId = w.vehicles!.spawn('vehicle.sedan', { x: 7, z: 2 }), light = w.vehicles!.cars.get(lightId)!;
  const heavyId = w.vehicles!.spawn('vehicle.fire-engine', { x: 12, z: -2 }), heavy = w.vehicles!.cars.get(heavyId)!;
  const hp = light.entity.health.current, heavyHp = heavy.entity.health.current; const a = start(w, e, 'elephant.charge');
  step(w, 53); expect(light.entity.health.current).toBe(hp); const origin = { ...light.entity.transform };
  while (!a.hitIds.includes(lightId) && w.tick < 170) step(w, 1);
  expect(a.hitIds).toContain(lightId); expect(light.entity.health.current).toBe(hp - 80); expect(Math.abs(light.physics.body.linvel().z)).toBeGreaterThanOrEqual(3);
  step(w, 60); expect(Math.hypot(light.entity.transform.x - origin.x, light.entity.transform.z - origin.z)).toBeGreaterThanOrEqual(1);
  expect(heavy.entity.health.current).toBe(heavyHp); expect(a.hitIds).not.toContain(heavyId);
  expect(w.events.events().filter(ev => ev.type === 'infected.attack' && ev.targetId === lightId && ev.attackId === a.attackId)).toHaveLength(1);
});
test('T-E07-19-elephant-swipe @E07-AC19 exact forward 120 degree/3m arc, 25 damage, 3m knockback, 48 tick down, wall and protected controls', async () => {
  const w = await arena(); player(w, 25); const e = spawn(w, 'elephant', 0, 0, 'idle');
  const edge = human(w, 1.5, Math.sqrt(6.75)), outside = human(w, 1.499, -Math.sqrt(6.75)), rear = human(w, -2, 0), far = human(w, 3.001, 0), covered = human(w, 2, 0);
  const child = w.entities.get(w.npcs!.escorts.spawn({ x: 2, z: 1 }, true))!; const childHp = child.health.current;
  wall(w, 1, .5); const a = start(w, e, 'elephant.swipe'); step(w, 41); expect(edge.health.current).toBe(100); step(w, 1);
  expect(edge.health.current).toBe(75); expect(Math.hypot(edge.transform.x - 1.5, edge.transform.z - Math.sqrt(6.75))).toBeGreaterThanOrEqual(3 - 1e-8);
  expect(edge.civilian!.knockedUntil).toBe(w.tick + 48); for (const t of [outside, rear, far, covered]) expect(t.health.current).toBe(100); expect(child.health.current).toBe(childHp);
  step(w, 10); expect(w.events.events().filter(ev => ev.type === 'combat.hit' && ev.attackId === a.attackId)).toHaveLength(1);
});
test('T-E07-19-gorilla-throw @E07-AC14 @E07-AC19 nearest corpse within 3m, retained pose/id, 12m/s, first impact 30HP and 48 tick down', async () => {
  const w = await arena(); const p = player(w, 8), e = spawn(w, 'gorilla', 0, 0, 'idle'); let body = spawn(w, 'runner', 0, 3, 'idle');
  body.health.current = 0; body.infected!.state = 'dead'; body.infected!.deadAt = -120; body.infected!.recoverAt = -1; step(w, 1);
  body = w.entities.get(body.id)!; const pose = structuredClone(body.infected), a = start(w, e, 'gorilla.grab-throw', 8), before = { ...body.transform };
  step(w, 47); expect(body.transform).toEqual(before); step(w, 1); expect(a.projectile!.objectId).toBe(body.id); step(w, 1); expect(a.projectile!.distance).toBeCloseTo(.2);
  while (a.stage === 'active') step(w, 1); expect(p.health.current).toBe(70); expect(p.combat!.staggerUntil).toBe(w.tick + 48);
  expect(body.corpse).toBe(true); expect(body.infected).toEqual(pose); expect(body.transform.x).toBeGreaterThan(6); expect(body.transform.y).toBe(.7);
  expect(a.hitIds).toEqual([p.id]); expect(w.infected!.barricadeDamage(e.id, 10)).toBe(60);
});
test('T-E07-19-gorilla-throw-controls @E07-AC19 nearest medium only, 15m range, locked target and no-object cancellation', async () => {
  const w = await arena(); player(w, 25); const e = spawn(w, 'gorilla', 0, 0, 'idle');
  for (const [id, z, cls] of [[900, 1, 'light'], [901, 3, 'medium'], [902, 3.001, 'medium']] as const) {
    const body = w.physics.world!.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, .4, z));
    w.infected!.props.props.push({ id, body, mass: 30, class: cls, radius: .3 });
  }
  const a = start(w, e, 'gorilla.grab-throw'); step(w, 48); expect(a.projectile!.objectId).toBe(901); player(w, 25, 8); step(w, 75);
  expect(a.projectile!.distance).toBe(15); expect(a.hitIds).toEqual([]); step(w, 36);
  e.infected!.state = 'idle'; e.infected!.cooldown = 0; e.infected!.specialCooldowns = {}; Object.assign(e.transform, { x: 0, z: 0 });
  w.infected!.props.props.length = 0; const cancelled = start(w, e, 'gorilla.grab-throw'); step(w, 48); expect(cancelled.projectile).toBeUndefined();
  expect(w.events.events().some(ev => ev.type === 'infected.special' && ev.attackId === cancelled.attackId && ev.stage === 'cancelled')).toBe(true);
});

const checkpoint: MissionDef = { id: 'zoo-restore', briefing: 'Zoo', anchors: { spawn: { x: 0, z: 0, radius: 2 } }, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: ['C'], cinematics: {}, steps: [{ id: 'wait', type: 'custom', text: 'Wait', anchor: 'spawn', start: { kind: 'start' }, complete: { kind: 'timer', seconds: 1000 }, fail: [] }], finish: ['wait'], onStart: [], onComplete: [] };
for (const move of ['gorilla.grab-throw', 'elephant.charge', 'elephant.swipe'] as const) test(`T-E07-19-${move}-checkpoint @E07-AC05 @E07-AC19 production checkpoint restores active state and cooldown`, async () => {
  const w = await arena(); player(w, 25); const m = w.loadMission(checkpoint); m.begin();
  const e = spawn(w, move.split('.')[0], 0, 0, 'idle'), body = spawn(w, 'runner', 0, 2, 'idle');
  body.health.current = 0; body.infected!.state = 'dead'; body.infected!.deadAt = -120; body.infected!.recoverAt = -1; step(w, 1);
  start(w, e, move); step(w, infectedSpecialMoves[move].windup + 5); m.checkpoint('C');
  const savedTick = w.tick, saved = structuredClone(e.infected!); step(w, 20); m.restore('C'); const restored = w.entities.get(e.id)!.infected!;
  expect(restored.specialCooldowns![move]! - w.tick).toBe(saved.specialCooldowns![move]! - savedTick);
  expect(restored.specialAttack!.hitIds).toEqual(saved.specialAttack!.hitIds);
  expect(restored.specialAttack!.area).toEqual(saved.specialAttack!.area);
  if (move === 'gorilla.grab-throw') {
    expect(restored.specialAttack!.projectile!.distance).toBe(saved.specialAttack!.projectile!.distance);
    expect(w.tick - restored.specialAttack!.projectile!.started).toBe(savedTick - saved.specialAttack!.projectile!.started);
    expect(w.entities.get(body.id)!.corpse).toBe(true);
  }
});

test('T-E07-19-gorilla-throw-wall @E07-AC19 intact cover stops a thrown corpse and rejects hidden pickups', async () => {
  const w = await arena(); const p = player(w, 8), e = spawn(w, 'gorilla', 0, 0, 'idle');
  let body = spawn(w, 'runner', 0, 2, 'idle'); body.health.current = 0; body.infected!.state = 'dead'; body.infected!.deadAt = -120; body.infected!.recoverAt = -1;
  step(w, 1); body = w.entities.get(body.id)!; wall(w, 4);
  const a = start(w, e, 'gorilla.grab-throw', 8); step(w, 48); while (a.stage === 'active') step(w, 1);
  expect(a.projectile!.distance).toBeLessThan(4); expect(body.transform.x).toBeLessThan(4); expect(body.corpse).toBe(true); expect(p.health.current).toBe(100); expect(a.hitIds).toEqual([]);
  step(w, 36); Object.assign(e.transform, { x: 0, z: 0 }); e.infected!.cooldown = 0; e.infected!.specialCooldowns = {}; e.infected!.state = 'idle';
  body.transform.x = 3.001; body.transform.z = 0; expect(w.infected!.props.nearestObject(e, 3)).toBeUndefined();
  body.transform.x = 2; wall(w, 1); expect(w.infected!.props.nearestObject(e, 3)).toBeUndefined();
});
test('T-E07-19-elephant-charge-slot-boundary @E07-AC19 full telegraphed width contacts an offset E26 slot', async () => {
  const w = await arena(); player(w, 25); const e = spawn(w, 'elephant', 0, 0, 'idle');
  const id = w.barricades!.spawn({ id: 'edge', groupId: 'edge', a: { x: 5, z: 1.6 }, b: { x: 5, z: 1.8 }, height: 1, initialHp: 400 });
  start(w, e, 'elephant.charge'); step(w, 100);
  expect(w.entities.get(id)!.health.current).toBe(0); expect(w.entities.get(id)!.barricade!.intact).toBe(false);
});
