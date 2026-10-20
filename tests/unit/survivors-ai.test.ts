import { afterEach, expect, test } from 'vitest';
import { SimPhase } from '../../src/core/EventBus';
import { barEligible } from '../../src/render/HealthBars';
import { healthFraction } from '../../src/ui/health';
import { Outbreak } from '../../src/sim/outbreak/Outbreak';
import { allyState } from '../../src/sim/outbreak/Allies';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { npcWorld, step, teleport } from '../sim/npc/helpers';

let w: SimWorld;
afterEach(() => w?.dispose());
async function fixture(outbreak = true) {
  w = await npcWorld('turning-probe'); teleport(w, 8, 0);
  if (outbreak) w.npcs!.civilians.outbreak = new Outbreak(w, { refuges: [] });
  const id = outbreak ? w.npcs!.civilians.outbreak!.spawnPedestrian({ x: 0, z: 0 }) : w.npcs!.civilians.spawn('cashier', { x: 0, z: 0 });
  const e = w.entities.get(id)!;
  const zid = w.infected!.spawn('infected.runner', { x: -2, z: 0 }), z = w.entities.get(zid)!;
  z.combat!.staggerUntil = 10000;
  return { e, z };
}

test.each([false, true])('@E08-AC02 attacked pedestrians leave a frozen routine within 0.5 seconds (outbreak=%s)', async outbreak => {
  const { e, z } = await fixture(outbreak);
  e.civilian!.panicReaction = 'freeze'; e.civilian!.story = { clip: 'npc-cower', start: 0 };
  w.events.emit({ type: 'infected.attack', tick: w.tick, sourceId: z.id, targetId: e.id, attackId: 1, special: 'melee', amount: 0 });
  step(w, 30);
  expect(e.civilian!.state).toBe('flee');
  expect(e.transform.x).toBeGreaterThan(.2);
  expect(Math.hypot(e.transform.x - 8, e.transform.z)).toBeLessThan(8);
});

test('@E08-AC02 shared follower escapes contact instead of holding cover', async () => {
  const { e, z } = await fixture();
  w.events.emit({ type: 'infected.attack', tick: w.tick, sourceId: z.id, targetId: e.id, attackId: 1, special: 'melee', amount: 0 });
  e.civilian!.survivor = { key: 'qa', slot: 0, leader: 1, mode: 'follow', cover: true, waitAt: 0, foundAt: 0 };
  step(w, 30);
  expect(e.transform.x).toBeGreaterThan(.2);
  expect(e.civilian!.survivor.cover).toBe(false);
});

test('@E08-AC12 released follower flees within 0.5 seconds and the authored 1-second grab still bites if unrescued', async () => {
  const { e, z } = await fixture();
  e.civilian!.survivor = { key: 'qa', slot: 0, leader: 1, mode: 'follow', cover: false, waitAt: 0, foundAt: 0 };
  const outbreak = w.npcs!.civilians.outbreak!;
  outbreak.grab(e, z); expect(e.civilian!.until - w.tick).toBe(60);
  step(w, 1); expect(e.civilian!.state).toBe('flee');
  step(w, 29); expect(e.transform.x).toBeGreaterThan(.2); expect(e.infection).toBeUndefined();
  z.combat!.staggerUntil = 0; Object.assign(z.transform, { x: e.transform.x - .9, z: e.transform.z });
  outbreak.grab(e, z); step(w, 59); expect(e.civilian!.state).toBe('grabbed');
  step(w, 1); expect(e.infection).toBeDefined();
});

test('@E08 armed followers fight back in range within 0.5 seconds; following resumes without a stale aim', async () => {
  const { e, z } = await fixture(); w.scenario = 'L7';
  e.civilian!.survivor = { key: 'qa', slot: 0, leader: 1, mode: 'follow', cover: false, waitAt: 0, foundAt: 0 };
  e.civilian!.ally = { ...allyState('civilian'), gun: { damage: 20, shotS: .5, rangeM: 18, nearM: 12, hitNear: 1, hitFar: 1 }, weapon: 'pistol', engaged: true };
  step(w, 30);
  expect(w.events.events().some(event => event.type === 'ally.attack' && event.sourceId === e.id)).toBe(true);
  w.infected!.release(z); teleport(w, 20, 0); step(w, 60);
  expect(e.civilian!.ally.targetId).toBe(0);
  expect(e.civilian!.story?.clip).not.toBe('shoot');
  expect(e.motion!.speed).toBeGreaterThan(.5);
  const v = e.motion!.velocity, dot = (Math.cos(e.transform.yaw) * v.x - Math.sin(e.transform.yaw) * v.z) / e.motion!.speed;
  expect(dot).toBeGreaterThan(.95);
});

test('@E23 @E24 nearby ground firearms arm each survivor once; courier, melee, raised and discarded pickups are excluded', async () => {
  const { e, z } = await fixture(); w.scenario = 'L5'; w.infected!.release(z);
  e.civilian!.survivor = { key: 'qa', slot: 0, leader: 1, mode: 'follow', cover: false, waitAt: 0, foundAt: 0 };
  const p = w.combat!.pickups;
  const reserved = p.spawn('weapon.shotgun', { x: 0, z: 0 }, false, { retain: true, interactTicks: 36 });
  p.spawn('weapon.bat', { x: 0, z: 0 });
  p.spawn('weapon.handgun', { x: 0, z: 0 }, true);
  const high = p.spawn('weapon.handgun', { x: 0, z: 0 }, false, { surfaceY: 3 });
  const far = p.spawn('weapon.handgun', { x: 2.01, z: 0 });
  expect(p.armSurvivor(e)).toBe(false);
  const gun = p.spawn('weapon.assault-rifle', { x: 2, z: 0 }, false, { survivorOnly: true });
  expect(p.armSurvivor(e)).toBe(true);
  expect(e.civilian!.ally).toMatchObject({ actionId: 'weapon.assault-rifle', weapon: 'rifle' });
  expect(e.appearance!.handProp).toBe('rifle');
  expect(w.entities.get(gun)).toBeUndefined();
  expect(p.armSurvivor(e)).toBe(false);
  for (const id of [reserved, high, far]) expect(w.entities.get(id)).toBeDefined();
});

test('@E23 @E29 dead civilians have no bar; grabbed and downed survivors use their actual HP', async () => {
  const { e } = await fixture();
  e.civilian!.survivor = { key: 'qa', slot: 0, leader: 1, mode: 'follow', cover: false, waitAt: 0, foundAt: 0 };
  for (const state of ['grabbed', 'down'] as const) {
    e.civilian!.state = state; e.health.current = 27;
    expect(barEligible(e, { x: 0, z: 0 }, false)).toBe(true);
    expect(healthFraction(e.health.current, e.health.max)).toBe(.27);
  }
  e.civilian!.state = 'finished'; e.health.current = 100;
  expect(barEligible(e, { x: 0, z: 0 }, false)).toBe(false);
  e.civilian!.state = 'calm'; e.health.current = 0;
  expect(barEligible(e, { x: 0, z: 0 }, false)).toBe(false);
});

test('@E29 a fatal bite at a full director cap leaves zero HP and a persistent body', async () => {
  const { e, z } = await fixture();
  w.infected!.director.levelCap = 1; w.infected!.director.strict = true;
  z.combat!.staggerUntil = 0; z.transform.x = -.9;
  w.npcs!.civilians.outbreak!.grab(e, z); step(w, 60);
  expect(e.civilian!.state).toBe('finished'); expect(e.health.current).toBe(0);
  step(w, 300); expect(w.entities.get(e.id)).toBe(e);
});


test('@E08 moving shooters face travel on reload/out-of-range and never backpedal more than two seconds continuously', async () => {
  const { e, z } = await fixture();
  z.transform.x = 8; z.transform.z = 4; z.health.current = 10000;
  const a = e.civilian!.ally = { ...allyState('civilian'), weapon: 'pistol', engaged: true, targetId: z.id,
    gun: { damage: 0, shotS: .5, rangeM: 30, nearM: 20, hitNear: 0, hitFar: 0 } };
  // A sustained retreat order while shooting at a stable in-range target. This exercises the final post-movement facing rule.
  const off = w.events.on('sim.tick', () => {
    e.civilian!.story = { clip: 'shoot', start: w.tick }; a.targetId = z.id; a.reloadUntil = 0;
    e.transform.yaw = -Math.atan2(z.transform.z - e.transform.z, z.transform.x - e.transform.x);
    w.npcs!.moveStep(e, -.025, 0);
  }, SimPhase.missions);
  const restShots: number[] = [];
  w.events.on('ally.attack', event => { if (event.type === 'ally.attack' && event.sourceId === e.id && w.tick < (a.aimMoveRestUntil ?? 0)) restShots.push(w.tick); });
  let backwards = 0, worst = 0, turned = 0;
  for (let i = 0; i < 210; i++) {
    w.update(); const v = e.motion!.velocity;
    if (e.motion!.speed < .5) continue;
    const dot = (Math.cos(e.transform.yaw) * v.x - Math.sin(e.transform.yaw) * v.z) / e.motion!.speed;
    backwards = dot < .5 ? backwards + 1 : 0; worst = Math.max(worst, backwards); if (dot > .95) turned++;
  }
  off(); expect(worst).toBeLessThanOrEqual(120); expect(turned).toBeGreaterThan(10); expect(restShots).toEqual([]);
  a.reloadUntil = w.tick + 1000;
  const reload = w.events.on('sim.tick', () => {
    e.civilian!.story = { clip: 'shoot', start: w.tick }; a.targetId = z.id; a.reloadUntil = w.tick + 100;
    e.transform.yaw = 0; w.npcs!.moveStep(e, -.025, 0);
  }, SimPhase.missions);
  step(w, 20); reload();
  const v = e.motion!.velocity;
  expect((Math.cos(e.transform.yaw) * v.x - Math.sin(e.transform.yaw) * v.z) / e.motion!.speed).toBeGreaterThan(.95);
});


test('@E08 attacked officers with the legacy built-in pistol fight within its range instead of fleeing', async () => {
  const { e, z } = await fixture(); z.transform.x = 4;
  e.civilian!.ally = { ...allyState('officer'), engaged: true };
  w.events.emit({ type: 'infected.attack', tick: w.tick, sourceId: z.id, targetId: e.id, attackId: 1, special: 'melee', amount: 0 });
  step(w, 30);
  expect(e.civilian!.state).toBe('calm');
  expect(w.events.events().some(event => event.type === 'ally.attack' && event.sourceId === e.id)).toBe(true);
});


test('@E08 repeated attacks preserve an engaged fighter’s existing weapon cadence', async () => {
  const { e, z } = await fixture();
  e.civilian!.ally = { ...allyState('officer'), engaged: true, targetId: z.id, nextAttack: 90 };
  w.events.emit({ type: 'infected.attack', tick: w.tick, sourceId: z.id, targetId: e.id, attackId: 1, special: 'melee', amount: 0 });
  expect(e.civilian!.ally.nextAttack).toBe(90);
  e.civilian!.ally.targetId = 0;
  w.events.emit({ type: 'infected.attack', tick: w.tick, sourceId: z.id, targetId: e.id, attackId: 2, special: 'melee', amount: 0 });
  expect(e.civilian!.ally.nextAttack).toBeLessThanOrEqual(15);
});


test('@E08 a stationary gunner keeps its facing when separation nudges its body', async () => {
  const { e, z } = await fixture(); w.infected!.release(z);
  e.civilian!.ally = { ...allyState('officer'), hold: true };
  const off = w.events.on('sim.tick', () => {
    e.transform.x -= .02; e.transform.yaw = 0;
    w.solids.wrote(e, 'test.separation-nudge');
  }, SimPhase.cleanup + .35);
  step(w, 2); off(); expect(e.transform.yaw).toBe(0);
});


test('@E08 escape retains the safe sideways component toward the courier', async () => {
  const { e, z } = await fixture(); teleport(w, 0, 8);
  w.events.emit({ type: 'infected.attack', tick: w.tick, sourceId: z.id, targetId: e.id, attackId: 1, special: 'melee', amount: 0 });
  step(w, 30);
  expect(e.transform.x).toBeGreaterThan(.2); expect(e.transform.z).toBeGreaterThan(.2);
  expect(Math.hypot(e.transform.x, e.transform.z - 8)).toBeLessThan(8);
});
