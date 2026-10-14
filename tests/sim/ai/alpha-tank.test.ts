import { expect, test } from 'vitest';
import { allyState } from '../../../src/sim/outbreak/Allies';
import { infectedRecovery } from '../../../src/data/infected';
import { arena, spawn, step } from './helpers';

for (const tier of ['high', 'low'] as const) {
  test(`Alpha routes to its soldier, not the courier flow field (${tier}) @E07`, async () => {
    const w = await arena(), ai = w.infected!;
    ai.director.setTier(tier);
    const p = w.entities.get(1)!;
    Object.assign(p.transform, { x: -8, z: 0 }); w.physics.playerBody!.setTranslation(p.transform, true);
    const soldier = w.entities.get(w.npcs!.civilians.spawn('officer', { x: 8, z: 0 }))!;
    soldier.civilian!.ally = allyState('soldier'); soldier.health = { current: 10000, max: 10000 };
    // Freeze only the target's movement/shooting; the real infected brain remains live.
    soldier.civilian!.knockedUntil = 10000;
    const e = spawn(w, 'alpha', 1, 0);
    e.infected!.heardTargetId = soldier.id;
    e.infected!.specialCooldowns = { 'alpha.charge': 10000, 'alpha.ground-slam': 10000, 'alpha.roar': 10000, 'alpha.grab-throw': 10000 };
    const wall = { x: 4, z: 0, y: 1, halfX: 1.5, halfZ: 2.5, halfY: 1 };
    w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 909090, wall, blocked: true });
    // More than twenty agents enables the shared courier flow field.
    for (let i = 0; i < 21; i++) spawn(w, 'runner', -20 + i, -20, 'idle');
    const start = { ...e.transform };
    step(w, 120);
    expect(Math.hypot(e.transform.x - start.x, e.transform.z - start.z)).toBeGreaterThan(1);
    step(w, 600);
    expect(soldier.health.current).toBeLessThan(soldier.health.max);
    expect(e.transform.x).toBeGreaterThan(5);
  });
  for (const scenario of ['L1', 'L3', 'L4'] as const) test(`recoverable infected cannot become a static corpse (${scenario}, ${tier}) @E07`, async () => {
    const w = await arena(); w.scenario = scenario; w.infected!.configureL1v2(); w.infected!.director.setTier(tier);
    const e = spawn(w, 'runner', 10, 0, 'idle');
    w.combat!.damage.apply({ sourceId: 1, targetId: e.id, attackId: 900, actionId: 'weapon.bat', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 999, multiplier: 1, type: 'melee', stagger: 0, knockback: 0 });
    const id = e.id, at = e.infected!.recoverAt;
    expect(at).toBeGreaterThanOrEqual(w.tick + infectedRecovery.downS[0] * 60);
    step(w, 121); w.infected!.settle(e);
    expect(w.entities.get(id)).toBe(e); expect(e.corpse).toBeFalsy();
    step(w, at - w.tick);
    expect(e.health.current).toBe(e.health.max); expect(e.infected!.recoverAt).toBe(-1);
    expect(w.events.events().some(ev => ev.type === 'infected.recovered' && ev.sourceId === id && ev.tick === at)).toBe(true);
  });
}

for (const region of ['research-campus', 'destroyed-corridor'] as const) test(`L10 ${region} seed 1 Alpha paths around a parked hull @E32-AC09`, async () => {
  const w = await arena(); w.scenario = 'L10'; w.combat!.damage.god = true;
  const ai = w.infected!, id = ai.spawn('infected.alpha', { x: -6, z: 0 }, { cureRegion: region, state: 'chase', yaw: 0 });
  const e = w.entities.get(id)!;
  e.infected!.specialCooldowns = { 'alpha.charge': 10000, 'alpha.ground-slam': 10000, 'alpha.roar': 10000, 'alpha.grab-throw': 10000 };
  const wall = { x: -3, z: 0, y: 1, halfX: 1, halfZ: 2, halfY: 1 };
  w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 909091, wall, blocked: true });
  let still = 0, worst = 0;
  for (let i = 0; i < 600; i++) {
    const at = { ...e.transform }; w.update();
    still = e.infected!.state !== 'attack' && !e.infected!.specialAttack && Math.hypot(e.transform.x - at.x, e.transform.z - at.z) < .005 ? still + 1 : 0;
    worst = Math.max(worst, still);
  }
  expect(worst).toBeLessThanOrEqual(180);
  expect(w.events.events().some(ev => ev.type === 'infected.attack' && ev.sourceId === id)).toBe(true);
});
