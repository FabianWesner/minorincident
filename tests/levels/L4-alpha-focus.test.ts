import { expect, test, vi } from 'vitest';
import { regularInfectedModels } from '../../src/data/crowdAppearance';
import { updateAlly } from '../../src/sim/outbreak/Allies';
import { loadL4 } from '../../tools/sim-runner/l4Bots';

test('@E22 breached Alphas take soldier priority over closer outside Alphas and ordinary infected, without HP changes', async () => {
  const { world, mission } = await loadL4(3, 'low');
  try {
    // Isolate target priority from scenery/cover; range, real soldier state,
    // infected archetypes and the inside/outside wall classification stay live.
    vi.spyOn(world.combat!.query, 'shotVisible').mockReturnValue(true);
    const outside = world.infected!.spawn('infected.alpha', { x: -8, z: -5 });
    const inside = world.infected!.spawn('infected.alpha', { x: -22, z: -5 });
    world.infected!.spawn('infected.runner', { x: -12, z: -5 });
    Object.assign(world.entities.get(outside)!.transform, { x: -8, z: -5 });
    Object.assign(world.entities.get(inside)!.transform, { x: -22, z: -5 });
    const hp = [inside, outside].map(id => world.entities.get(id)!.health.max);
    for (const [index, id] of mission.state.l4!.soldierIds.slice(0, 2).entries()) {
      const guard = world.entities.get(id)!, ally = guard.civilian!.ally!;
      Object.assign(guard.transform, { x: -13, z: -5 + index * 3 });
      Object.assign(ally, { engaged: true, hold: false, run: null, post: null, targetId: 0 });
      delete ally.cover;
      updateAlly(world, guard, () => true);
      expect(ally.targetId).toBe(inside);
    }
    expect([inside, outside].map(id => world.entities.get(id)!.health.max)).toEqual(hp);
  } finally { vi.restoreAllMocks(); world.dispose(); }
});

test('@E22 a nearby L4 soldier steps in and shoots a downed breached Alpha permanently', async () => {
  const { world, mission } = await loadL4(3, 'low');
  try {
    vi.spyOn(world.combat!.query, 'shotVisible').mockReturnValue(true);
    vi.spyOn(world.combat!.query, 'alliedShotClear').mockReturnValue(true);
    const guard = world.entities.get(mission.state.l4!.soldierIds[0])!, ally = guard.civilian!.ally!;
    Object.assign(guard.transform, { x: -20, z: -3 });
    Object.assign(ally, { engaged: true, hold: false, run: null, post: null, targetId: 0, nextAttack: 0 }); delete ally.cover;
    const alpha = world.entities.get(world.infected!.spawn('infected.alpha', { x: -25, z: -3 }))!;
    Object.assign(alpha.transform, { x: -25, z: -3 }); alpha.health.current = 0;
    world.infected!.down(alpha, false);
    const recovery = alpha.infected!.recoverAt, shots: number[] = [], kills: number[] = [];
    world.events.on('ally.attack', e => { if (e.type === 'ally.attack' && e.targetId === alpha.id) shots.push(e.sourceId); });
    world.events.on('combat.kill', e => { if (e.type === 'combat.kill' && e.targetId === alpha.id) kills.push(e.sourceId); });
    const start = { ...guard.transform };
    for (; world.tick < Math.min(recovery, 300) && alpha.infected!.recoverAt >= 0; world.tick++) updateAlly(world, guard, () => true);
    expect(Math.hypot(guard.transform.x - start.x, guard.transform.z - start.z), 'visible approach to the body').toBeGreaterThan(2);
    expect(shots).toContain(guard.id); expect(kills).toEqual([guard.id]);
    expect(guard.civilian!.story?.clip).toBe('shoot');
    expect(alpha.infected!.recoverAt).toBe(-1); expect(alpha.health.current).toBe(0);
  } finally { vi.restoreAllMocks(); world.dispose(); }
});

test('@E22 player-only and outside-wall Alpha knockdowns retain ordinary recovery', async () => {
  const { world, mission } = await loadL4(3, 'low');
  try {
    const guard = world.entities.get(mission.state.l4!.soldierIds[0])!, ally = guard.civilian!.ally!;
    Object.assign(guard.transform, { x: -11, z: -3 }); Object.assign(ally, { engaged: true, run: null, post: null, targetId: 0 }); delete ally.cover;
    const outside = world.entities.get(world.infected!.spawn('infected.alpha', { x: -7, z: -3 }))!;
    Object.assign(outside.transform, { x: -7, z: -3 }); outside.health.current = 0; world.infected!.down(outside, false);
    const alone = world.entities.get(world.infected!.spawn('infected.alpha', { x: -30, z: -3 }))!;
    Object.assign(alone.transform, { x: -30, z: -3 }); alone.health.current = 0; world.infected!.down(alone, false);
    const recoveries = [outside, alone].map(e => e.infected!.recoverAt);
    for (; world.tick < 120; world.tick++) updateAlly(world, guard, () => true);
    expect([outside, alone].map(e => e.infected!.recoverAt)).toEqual(recoveries);
    // The player's ordinary bullet still extends a knockdown; it cannot finish it.
    world.combat!.damage.apply({ attackId: 0, actionId: 'weapon.pistol', sourceId: 1, targetId: alone.id, origin: { x: -31, z: -3 }, direction: { x: 1, z: 0 }, base: 20, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
    expect(alone.infected!.recoverAt).toBeGreaterThan(world.tick);
    world.tick = Math.max(...[outside, alone].map(e => e.infected!.recoverAt)) + 1; world.update();
    expect(outside.health.current).toBeGreaterThan(0); expect(alone.health.current).toBeGreaterThan(0);
  } finally { world.dispose(); }
});


test('@E22 newly arriving infected use shared model batches while camp people keep their own appearance', async () => {
  const { world } = await loadL4(3, 'low');
  try {
    const people = [...world.entities.iterate()].filter(e => e.civilian && e.appearance);
    const looks = people.map(e => structuredClone(e.appearance));
    const arrivals = Array.from({ length: 14 }, () => world.infected!.spawn('infected.runner', { x: -56.6, z: 6 }));
    world.npcs!.civilians.outbreak!.dressInfected();
    for (const id of arrivals) {
      const e = world.entities.get(id)!;
      expect(regularInfectedModels).toContain(e.appearance!.asset);
      expect(e.appearance!.bornInfected).toBe(true);
      expect(e.health.max).toBe(60);
    }
    expect(people.map(e => e.appearance)).toEqual(looks);
  } finally { world.dispose(); }
});
