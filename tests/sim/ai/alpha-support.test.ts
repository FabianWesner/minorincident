import { expect, test, vi } from 'vitest';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { arena, spawn, step } from './helpers';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { allyState } from '../../../src/sim/outbreak/Allies';
import type { MissionDef } from '../../../src/sim/missions/types';
import { PropSystem } from '../../../src/sim/interact/PropSystem';
import { pushableProps } from '../../../src/data/pushableProps';

function movePlayer(w: SimWorld, x: number, z = 0) {
  Object.assign(w.entities.get(1)!.transform, { x, z });
  w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); w.spatial.set(1, x, z);
}
function corpse(w: SimWorld, x: number, z = 0) {
  const e = spawn(w, 'runner', x, z, 'idle');
  e.health.current = 0; e.infected!.state = 'dead'; e.infected!.deadAt = -120; e.infected!.recoverAt = -1;
  step(w, 1); return w.entities.get(e.id)!;
}
function start(w: SimWorld, id: number, move: 'alpha.roar' | 'alpha.grab-throw', target = { id: 1, x: 8, z: 0 }) {
  const e = w.entities.get(id)!;
  return w.infected!.startSpecial(id, move, target, { x: e.transform.x, z: e.transform.z, radius: move === 'alpha.roar' ? 18 : 1, dx: 1, dz: 0 });
}
function wall(w: SimWorld, x: number) {
  w.infected!.hearing.los.register({ id: 'throw-wall', active: true, source: 'building', shape: { kind: 'aabb', min: { x: x - .1, z: -3 }, max: { x: x + .1, z: 3 } } });
}
const checkpoint: MissionDef = { id: 'support-restore', briefing: 'Support', anchors: { spawn: { x: 0, z: 0, radius: 2 } }, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: ['C'], cinematics: {}, steps: [{ id: 'wait', type: 'custom', text: 'Wait', anchor: 'spawn', start: { kind: 'start' }, complete: { kind: 'timer', seconds: 1000 }, fail: [] }], finish: ['wait'], onStart: [], onComplete: [] };

test('T-E07-06-grab-throw @E07-AC05 @E07-AC06 @E07-AC14 locked 12m/s corpse flight, first human impact once, retained pose/id, 0.8s knockdown', async () => {
  const w = await arena(); movePlayer(w, 8);
  const e = spawn(w, 'alpha', 0, 0, 'idle'), body = await corpse(w, 1, 1), pose = structuredClone(body.infected);
  e.transform.yaw = Math.PI;
  expect(start(w, e.id, 'alpha.grab-throw')).toBe(true);
  const a = e.infected!.specialAttack!, initial = { ...body.transform };
  step(w, 47); expect(body.transform).toEqual(initial); expect(w.entities.get(1)!.health.current).toBe(100);
  step(w, 1); expect(a.projectile!.objectId).toBe(body.id); expect(body.transform.y).toBeGreaterThan(1);
  step(w, 1); expect(a.projectile!.distance).toBeCloseTo(.2);
  while (a.stage === 'active') step(w, 1);
  const player = w.entities.get(1)!;
  expect(player.health.current).toBe(70); expect(player.combat!.staggerUntil - w.tick).toBe(48);
  expect(a.hitIds).toEqual([1]); expect(body.corpse).toBe(true); expect(body.transform.y).toBe(.7);
  expect(body.infected).toEqual(pose); expect(body.transform.x).toBeGreaterThan(6);
  step(w, 36); expect(w.events.events().filter(ev => ev.type === 'infected.attack' && ev.attackId === a.attackId)).toHaveLength(1);
  const expiry = e.infected!.specialCooldowns!['alpha.grab-throw']!;
  e.infected!.state = 'idle'; e.infected!.cooldown = 0; Object.assign(e.transform, { x: 0, z: 0 }); Object.assign(body.transform, { x: 1, z: 1 });
  w.tick = expiry - 49; expect(start(w, e.id, 'alpha.grab-throw')).toBe(false);
  w.tick++; expect(start(w, e.id, 'alpha.grab-throw')).toBe(true);
  const second = e.infected!.specialAttack!; step(w, 48);
  expect(second.activeTick - a.activeTick).toBe(720);
  while (second.stage === 'active') step(w, 1);
  expect(second.hitIds).toEqual([1]); expect(w.events.events().filter(ev => ev.type === 'infected.prop-thrown')).toHaveLength(2);
  expect(w.events.events().filter(ev => ev.type === 'infected.attack' && ev.attackId === second.attackId)).toHaveLength(1);
});

test('T-E07-06-grab-throw-target @E07-AC06 locked target, <=15m range, wall control and no valid object cancellation', async () => {
  const w = await arena(); movePlayer(w, 20);
  const e = spawn(w, 'alpha', 0, 0, 'idle'), body = await corpse(w, 1, 1); e.transform.yaw = Math.PI;
  expect(start(w, e.id, 'alpha.grab-throw', { id: 1, x: 30, z: 0 })).toBe(true);
  const a = e.infected!.specialAttack!;
  step(w, 48); movePlayer(w, 0, 8); step(w, 75);
  expect(a.projectile!.distance).toBe(15); expect(body.transform.x).toBe(15); expect(body.transform.z).toBe(0); expect(w.entities.get(1)!.health.current).toBe(100);
  step(w, 36); await corpse(w, 1, 1); e.infected!.specialCooldowns = {}; wall(w, 4);
  expect(start(w, e.id, 'alpha.grab-throw', { id: 1, x: 8, z: 0 })).toBe(true);
  const blocked = e.infected!.specialAttack!; step(w, 100);
  expect(blocked.projectile!.distance).toBeLessThan(4); expect(blocked.hitIds).toEqual([]);
  step(w, 36); e.infected!.specialCooldowns = {}; // An attempt explicitly outside the pickup boundary.
  for (const b of w.entities.iterate()) if (b.corpse) b.transform.x = 2.01;
  expect(start(w, e.id, 'alpha.grab-throw')).toBe(true); step(w, 48);
  expect(w.events.events().filter(ev => ev.type === 'infected.special' && ev.stage === 'cancelled')).toHaveLength(1);
});

test('T-E07-06-grab-throw-prop @E07-AC06 nearest medium prop, first soldier hit and exact authored knockdown', async () => {
  const w = await arena(); movePlayer(w, 20);
  const e = spawn(w, 'alpha', 0, 0, 'idle'); e.transform.yaw = Math.PI;
  const medium = w.physics.world!.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(1, .5, 1));
  w.infected!.props.props.push({ id: 900, body: medium, mass: 20, class: 'medium', radius: .5 });
  const far = await corpse(w, 1.8, 0);
  const soldier = w.entities.get(w.npcs!.civilians.spawn('officer', { x: 5, z: 0 }))!;
  soldier.civilian!.ally = allyState('soldier'); soldier.civilian!.pauseUntil = 10000;
  expect(start(w, e.id, 'alpha.grab-throw', { id: soldier.id, x: 8, z: 0 })).toBe(true);
  const a = e.infected!.specialAttack!;
  step(w, 48); expect(a.projectile!.objectId).toBe(900);
  while (a.stage === 'active') step(w, 1);
  expect(soldier.health.current).toBe(70); expect(soldier.civilian!.knockedUntil - w.tick).toBe(48);
  expect(a.hitIds).toEqual([soldier.id]); expect(far.transform.x).toBe(1.8);
});

test('T-E07-06-roar @E07-AC05 @E07-AC06 18m regular-only convergence, 1.25x for exactly 300 ticks, overlap does not stack', async () => {
  const w = await arena(); movePlayer(w, -25);
  const e = spawn(w, 'alpha', 0, 0, 'idle'), inside = spawn(w, 'runner', 17.99, 0, 'idle'), outside = spawn(w, 'runner', 18.01, 2, 'idle'), zoo = spawn(w, 'lion', 10, 2, 'idle'), alpha = spawn(w, 'alpha', 10, -2, 'idle');
  for (const other of [inside, outside, zoo, alpha]) other.combat!.staggerUntil = 10000;
  expect(start(w, e.id, 'alpha.roar')).toBe(true); const firstActive = e.infected!.specialAttack!.activeTick; step(w, 47); expect(inside.infected!.roar).toBeUndefined();
  step(w, 1); const r = inside.infected!.roar!;
  expect(r).toMatchObject({ x: 0, z: 0, until: w.tick + 300 });
  expect(outside.infected!.roar).toBeUndefined(); expect(zoo.infected!.roar).toBeUndefined(); expect(alpha.infected!.roar).toBeUndefined();
  const base = inside.infected!.speed; inside.combat!.staggerUntil = 0;
  step(w, 60); // Existing crowd acceleration must settle before measuring the speed scale.
  const x = inside.transform.x; step(w, 30);
  expect(x - inside.transform.x).toBeGreaterThan(base * .5); expect(inside.motion!.speed).toBeCloseTo(base * 1.25, 1); expect(inside.infected!.speed).toBe(base);
  expect(w.entities.get(1)!.health.current).toBe(100);
  // A second Alpha refreshes the same single buff; target remains the roar origin, never the unseen player.
  alpha.combat!.staggerUntil = 0;
  expect(start(w, alpha.id, 'alpha.roar')).toBe(true); step(w, 48);
  expect(inside.infected!.roar).toMatchObject({ x: 10, z: -2, until: w.tick + 300 }); expect(inside.infected!.speed).toBe(base);
  inside.combat!.staggerUntil = 10000;
  step(w, 299); expect(inside.infected!.roar).toBeDefined(); step(w, 1); expect(inside.infected!.roar).toBeUndefined(); expect(inside.infected!.speed).toBe(base);
  expect(w.events.events().filter(ev => ev.type === 'infected.roar-buff' && ev.targetId === inside.id && ev.stage === 'expiry')).toHaveLength(1);
  e.infected!.state = 'idle'; e.infected!.cooldown = 0;
  w.tick = firstActive + 900 - 49; expect(start(w, e.id, 'alpha.roar')).toBe(false);
  w.tick++; expect(start(w, e.id, 'alpha.roar')).toBe(true);
  const second = e.infected!.specialAttack!; step(w, 48); expect(second.activeTick - firstActive).toBe(900); expect(second.stage).toBe('recovery');
});

for (const move of ['alpha.grab-throw', 'alpha.roar'] as const) test(`T-E07-06-${move}-restore @E07-AC05 checkpoint restores flight/buff and activation-to-activation cooldown`, async () => {
  const w = await arena(); movePlayer(w, 20);
  const m = w.loadMission(checkpoint); m.begin(); const e = spawn(w, 'alpha', 0, 0, 'idle'); e.transform.yaw = Math.PI;
  await corpse(w, 1, 1); const recipient = spawn(w, 'runner', 12, 2, 'idle'); recipient.combat!.staggerUntil = 10000;
  expect(start(w, e.id, move, { id: 1, x: 15, z: 0 })).toBe(true); step(w, 55); m.checkpoint('C');
  const savedTick = w.tick, saved = structuredClone(e.infected!), roar = structuredClone(recipient.infected!.roar);
  step(w, 20); m.restore('C'); const restored = w.entities.get(e.id)!.infected!;
  expect(restored.specialCooldowns![move]! - w.tick).toBe(saved.specialCooldowns![move]! - savedTick);
  if (move === 'alpha.grab-throw') {
    expect(restored.specialAttack!.projectile!.distance).toBe(saved.specialAttack!.projectile!.distance);
    expect(w.tick - restored.specialAttack!.projectile!.started).toBe(savedTick - saved.specialAttack!.projectile!.started);
  } else expect(w.entities.get(recipient.id)!.infected!.roar!.until - w.tick).toBe(roar!.until - savedTick);
});


test('T-E07-06-roar-wall @E07-AC06 a large occluded horde routes toward the roar without consuming the unseen-player flow field', async () => {
  const w = await arena(); movePlayer(w, -25);
  const e = spawn(w, 'alpha', 0, 0, 'idle'), regular = spawn(w, 'runner', 12, 0, 'idle');
  regular.combat!.staggerUntil = 10000;
  for (let i = 0; i < 20; i++) spawn(w, 'runner', 20 + (i % 4), 8 + Math.floor(i / 4), 'idle').combat!.staggerUntil = 10000;
  w.infected!.nav.setBlocker(900, { x: 5, y: 1.5, z: 0, halfX: 1, halfY: 1.5, halfZ: 3 }, true);
  const flow = vi.spyOn(w.infected!.nav, 'flowNext');
  expect(start(w, e.id, 'alpha.roar')).toBe(true); step(w, 48); regular.combat!.staggerUntil = 0;
  for (let tick = 0; tick < 299; tick++) {
    step(w, 1);
    expect(regular.transform.x > 4 && regular.transform.x < 6 && Math.abs(regular.transform.z) < 3).toBe(false);
  }
  expect(Math.hypot(regular.transform.x, regular.transform.z)).toBeLessThan(12);
  expect(flow).not.toHaveBeenCalled(); expect(regular.infected!.heardTargetId).toBe(0);
});


test('T-E07-06-grab-throw-e26 @E07-AC06 authored medium body keeps entity identity and synchronized pose', async () => {
  const w = await arena(); movePlayer(w, 25);
  const e = spawn(w, 'alpha', 0, 0, 'idle');
  w.props = new PropSystem(w);
  const assetId = Object.keys(pushableProps).find(id => pushableProps[id].class === 'medium')!;
  const prop = w.props.spawn({ id: 'alpha-throw-fixture', assetId, position: [1, 0, 1], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [0, 0, 0], max: [1, 1, 1] } });
  prop.braced = true; expect(w.infected!.props.nearestObject(e, 2)).toBeUndefined();
  prop.braced = false; expect(w.infected!.props.nearestObject(e, 2)).toEqual({ id: prop.entityId, corpse: false });
  expect(start(w, e.id, 'alpha.grab-throw', { id: 1, x: 15, z: 0 })).toBe(true);
  step(w, 48); const a = e.infected!.specialAttack!;
  expect(a.projectile!.objectId).toBe(prop.entityId);
  while (a.stage === 'active') step(w, 1);
  expect(a.projectile!.distance).toBe(15);
  expect(prop.pose.p).toEqual([15, 0, 0]);
  expect(prop.body.translation().x).toBeCloseTo(15, 4);
  expect(w.entities.get(prop.entityId)!.transform.x).toBe(15);
});
