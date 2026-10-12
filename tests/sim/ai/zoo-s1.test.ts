import { expect, test } from 'vitest';
import { infectedSpecialMoves, type InfectedSpecialMove } from '../../../src/data/infected';
import { Clock } from '../../../src/core/Clock';
import { emptyInput } from '../../../src/input/InputFrame';
import { arena, hit, spawn, step } from './helpers';
import type { EntitySnapshot } from '../../../src/sim/world/types';

type World = Awaited<ReturnType<typeof arena>>;
function start(w: World, e: EntitySnapshot, move: InfectedSpecialMove, x = 8, z = 0, id = 1) {
  expect(w.infected!.startSpecial(e.id, move, { id, x, z }, { x: 999, z: 999, radius: 99, dx: 0, dz: 1 })).toBe(true);
  return e.infected!.specialAttack!;
}
function teleport(w: World, x: number, z = 0) {
  const p = w.entities.get(1)!; Object.assign(p.transform, { x, z, y: .705 });
  w.physics.playerBody!.setTranslation(p.transform, true); w.player!.locomotion.reset(); w.spatial.set(1, x, z);
}
function human(w: World, x: number, z: number) {
  const e = w.entities.get(w.npcs!.civilians.spawn('officer', { x, z }))!;
  e.civilian!.state = 'annoyed'; e.civilian!.until = 10000;
  return e;
}
const moves = ['lion.pounce', 'lion.flank', 'gorilla.roar', 'gorilla.pound'] as const;
for (const move of moves) test(`T-E07-19-${move.replace('.', '-')} @E07-AC05 @E07-AC19 telegraph, cooldown, recovery, restore`, async () => {
  const w = await arena(); teleport(w, 8);
  const e = spawn(w, move.split('.')[0], 0, 0, 'idle'), a = start(w, e, move), timing = infectedSpecialMoves[move];
  expect(a.activeTick - a.startTick).toBe(timing.windup); expect(a.cooldownExpiry - a.activeTick).toBe(timing.cooldown);
  const clock = new Clock(); clock.pause(); const pausedTick = w.tick; clock.advance(1, () => w.update()); expect(w.tick).toBe(pausedTick);
  step(w, timing.windup - 1); expect(a.stage).toBe('telegraph'); expect(e.transform.x).toBe(0); expect(w.entities.get(1)!.health.current).toBe(100);
  expect(w.events.events().filter(ev => ev.type === 'infected.roar-buff')).toHaveLength(0);
  step(w, 1); expect(a.stage).not.toBe('telegraph');
  step(w, 125); expect(a.stage).toBe('recovery'); expect(a.recoveryUntil).toBeGreaterThanOrEqual(a.activeTick + 36);
  // Stop ordinary AI and advance the serialized checkpoint clock, retaining activation intervals.
  e.infected = JSON.parse(JSON.stringify(e.infected)); w.tick += 123; w.infected!.restoreSpecialTimers(e.infected!, 123);
  delete e.infected!.specialAttack; e.infected!.state = 'idle'; e.infected!.cooldown = 0; e.infected!.grabUntil = 0;
  Object.assign(e.transform, { x: 0, z: 0, yaw: 0 });
  const expiry = a.cooldownExpiry + 123; w.tick = expiry - timing.windup - 1;
  expect(w.infected!.startSpecial(e.id, move, a.target, a.area)).toBe(false);
  w.tick++; const second = start(w, e, move);
  expect(second.activeTick - (a.activeTick + 123)).toBe(timing.cooldown); expect(second.attackId).toBeGreaterThan(a.attackId);
});

test('T-E07-19-lion-pounce-impact @E07-AC19 10m/s, locked target, 30 damage once, 90 tick pin and mash rescue', async () => {
  const w = await arena(); teleport(w, 6); const p = w.entities.get(1)!, e = spawn(w, 'lion', 0, 0, 'idle');
  const a = start(w, e, 'lion.pounce', 6); step(w, 36); expect(e.transform.x).toBeCloseTo(10 / 60);
  step(w, 30); expect(p.health.current).toBe(70); expect(w.infected!.playerPinned()).toBe(true);
  const impact = w.events.events().find(ev => ev.type === 'infected.attack' && ev.attackId === a.attackId)!;
  expect(e.infected!.grabUntil).toBe(impact.tick + 90);
  const frame = emptyInput(); frame.move = { x: 0, z: 1 }; w.applyInput(frame, 'keyboard'); const z = p.transform.z; step(w, 1); expect(p.transform.z).toBe(z);
  w.events.emit({ type: 'combat.attack', tick: w.tick, sourceId: 1, attackId: 999, actionId: 'weapon.bat', side: 'LEFT', position: { ...p.transform }, direction: { x: 1, z: 0 } });
  w.events.emit({ type: 'combat.attack', tick: w.tick, sourceId: 1, attackId: 1000, actionId: 'weapon.bat', side: 'LEFT', position: { ...p.transform }, direction: { x: 1, z: 0 } });
  expect(w.infected!.playerPinned()).toBe(false);
  expect(w.events.events().filter(ev => ev.type === 'combat.hit' && ev.attackId === a.attackId)).toHaveLength(1);
});

test('T-E07-19-lion-pounce-wall @E07-AC19 maximum 8m, no homing, intact wall, rescue by hitting lion', async () => {
  const w = await arena(); teleport(w, 20); const e = spawn(w, 'lion', 0, 0, 'idle');
  start(w, e, 'lion.pounce', 20); step(w, 83); expect(e.transform.x).toBeCloseTo(8); expect(e.transform.z).toBe(0);
  const w2 = await arena(); teleport(w2, 6); const lion = spawn(w2, 'lion', 0, 0, 'idle');
  (w2.combat!.query.walls as { x: number; z: number; y: number; halfX: number; halfZ: number; halfY: number }[]).push({ x: 3, z: 0, y: 1, halfX: .2, halfZ: 5, halfY: 1 });
  start(w2, lion, 'lion.pounce', 6); step(w2, 70); expect(lion.transform.x).toBeLessThan(3); expect(w2.entities.get(1)!.health.current).toBe(100);
  const w3 = await arena(); teleport(w3, 20); const attacker = spawn(w3, 'lion', 0, 0, 'idle'), target = human(w3, 4, 0);
  start(w3, attacker, 'lion.pounce', 4, 0, target.id); step(w3, 60); expect(target.health.current).toBe(70); expect(target.civilian!.knockedUntil).toBeGreaterThan(w3.tick);
  step(w3, 40); expect(attacker.infected!.grabUntil).toBeGreaterThan(w3.tick);
  hit(w3, attacker.id); hit(w3, attacker.id); expect(target.civilian!.knockedUntil).toBe(w3.tick);
});

test('T-E07-19-lion-flank-path @E07-AC19 75 degree side approach, 10m/s cap, no damage, expires to base speed', async () => {
  const w = await arena(); teleport(w, 8); const e = spawn(w, 'lion', 0, 0, 'idle'), base = e.infected!.speed;
  const a = start(w, e, 'lion.flank'), d = a.destination!;
  expect(Math.atan2(Math.abs(d.z), 8 - d.x) * 180 / Math.PI).toBeCloseTo(75);
  step(w, 36); expect(e.motion!.speed).toBeCloseTo(10); teleport(w, 8, 7); step(w, 120);
  expect(a.stage).toBe('recovery'); expect(e.infected!.speed).toBe(base); expect(w.entities.get(1)!.health.current).toBe(100);
  expect(e.transform.z * d.z).toBeGreaterThan(0); expect(w.events.events().filter(ev => ev.type === 'combat.hit' && ev.attackId === a.attackId)).toHaveLength(0);
  const w2 = await arena(); teleport(w2, 8); const blocked = spawn(w2, 'lion', 0, 0, 'idle');
  start(w2, blocked, 'lion.flank');
  // A gate closes during the windup. Register both collision and navigation, as production doors do.
  const wall = { x: 3, z: 0, y: 1, halfX: .2, halfZ: 50, halfY: 1 };
  (w2.combat!.query.walls as typeof wall[]).push(wall); w2.infected!.nav.setBlocker(999, wall, true);
  step(w2, 160); expect(blocked.transform.x).toBeLessThan(3);
});

test('T-E07-19-gorilla-pound-boundary @E07-AC19 exact 5m radius, occlusion, 30 damage and 72 tick knockdown', async () => {
  const w = await arena(); teleport(w, 20); const e = spawn(w, 'gorilla', 0, 0, 'idle');
  const inside = human(w, 0, 5), outside = human(w, 0, -5.001), behind = human(w, 3, 0);
  (w.combat!.query.walls as { x: number; z: number; y: number; halfX: number; halfZ: number; halfY: number }[]).push({ x: 1.5, z: 0, y: 1, halfX: .2, halfZ: 1, halfY: 1 });
  const a = start(w, e, 'gorilla.pound'); expect(a.area.radius).toBe(5); step(w, 59); expect(inside.health.current).toBe(100);
  step(w, 1); expect(inside.health.current).toBe(70); expect(inside.civilian!.knockedUntil).toBe(w.tick + 72); expect(outside.health.current).toBe(100); expect(behind.health.current).toBe(100);
  step(w, 20); expect(inside.health.current).toBe(70);
});

test('T-E07-19-gorilla-roar-origin @E07-AC19 20m convergence, no zoo/Alpha buff, no speed stacking or live-player revelation, 5s expiry', async () => {
  const w = await arena(); teleport(w, 25); const e = spawn(w, 'gorilla', 0, 0, 'idle');
  const regular = spawn(w, 'runner', 0, 20, 'idle'), outside = spawn(w, 'runner', 0, -20.001, 'idle'), alpha = spawn(w, 'alpha', -5, 0, 'idle'), lion = spawn(w, 'lion', -6, 0, 'idle');
  start(w, e, 'gorilla.roar'); step(w, 59); expect(regular.infected!.roar).toBeUndefined();
  step(w, 1); expect(regular.infected!.roar).toMatchObject({ x: 0, z: 0, until: w.tick + 300, speedScale: 1 });
  for (const other of [outside, alpha, lion]) expect(other.infected!.roar).toBeUndefined();
  expect(regular.infected!.heardTargetId).toBe(0); teleport(w, 30, 30); step(w, 299); expect(regular.infected!.roar).toBeDefined(); step(w, 1); expect(regular.infected!.roar).toBeUndefined();
});

test('T-E07-19-lion-pounce-dodge @E07-AC19 a moving target cannot bend the telegraphed leap', async () => {
  const w = await arena(); teleport(w, 6); const e = spawn(w, 'lion', 0, 0, 'idle');
  const a = start(w, e, 'lion.pounce', 6); step(w, 36); teleport(w, 6, 3); step(w, 36);
  expect(e.transform.x).toBeCloseTo(6); expect(e.transform.z).toBe(0); expect(e.transform.y).toBeCloseTo(.7);
  expect(a.hitIds).toHaveLength(0); expect(w.entities.get(1)!.health.current).toBe(100); expect(w.infected!.playerPinned()).toBe(false);
});

test('T-E07-19-gorilla-roar-overlap @E07-AC19 convergence never stacks or extends Alpha speed boost', async () => {
  const w = await arena(); teleport(w, 25); const alpha = spawn(w, 'alpha', 0, 0, 'idle'), gorilla = spawn(w, 'gorilla', 0, 2, 'idle'), regular = spawn(w, 'runner', 0, 10, 'idle');
  expect(w.infected!.startSpecial(alpha.id, 'alpha.roar', { id: 1, x: 25, z: 0 }, { x: 0, z: 0, radius: 18, dx: 1, dz: 0 })).toBe(true); step(w, 48); const speedExpiry = regular.infected!.roar!.speedUntil!;
  expect(regular.infected!.roar!.speedScale).toBe(1.25); step(w, 120);
  start(w, gorilla, 'gorilla.roar'); step(w, 60); const roar = regular.infected!.roar!;
  expect(roar.speedScale).toBe(1.25); expect(roar.speedUntil).toBe(speedExpiry); expect(roar.until).toBe(w.tick + 300);
  const saved = JSON.parse(JSON.stringify(regular.infected!)); w.infected!.restoreSpecialTimers(saved, 123);
  expect(saved.roar.until).toBe(roar.until + 123); expect(saved.roar.speedUntil).toBe(speedExpiry + 123);
});
