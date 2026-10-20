import { expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';

test('a shot behind an idle Alpha bypasses both the sight gate and its territory leash', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena');
  try {
    world.scenario = 'L5'; world.combat!.damage.god = true;
    const id = world.infected!.spawn('infected.alpha', { x: 32, z: 0 }, { yaw: 0 });
    const infected = world.entities.get(id)!;
    infected.infected!.territory = { x: 32, z: 0, radius: 6 };
    for (let i = 0; i < 5; i++) world.update();
    expect(infected.infected!.state).toBe('idle');
    world.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: 9001, actionId: 'weapon.pistol', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 3, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
    for (let i = 0; i < 180; i++) world.update();
    expect(infected.transform.x).toBeLessThan(28);
    expect(infected.infected!.state).not.toBe('idle');
    expect(Math.cos(infected.transform.yaw)).toBeLessThan(-.5);
  } finally { world.dispose(); }
}, 120_000);

test('a hit sends an unaware outbreak infected to the shot position without repeatedly revealing the shooter', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena');
  try {
    world.combat!.damage.god = true;
    world.infected!.configureL1v2();
    const courier = world.entities.get(1)!;
    const shot = { x: courier.transform.x, z: courier.transform.z };
    const id = world.infected!.spawn('infected.runner', { x: shot.x + 32, z: shot.z }, { yaw: 0 });
    const infected = world.entities.get(id)!, brain = infected.infected!.l1!;
    world.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: 9001, actionId: 'weapon.pistol', origin: shot, direction: { x: 1, z: 0 }, base: 3, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
    expect(brain.mode).toBe('attracted');
    expect([brain.search.originX, brain.search.originZ]).toEqual([shot.x, shot.z]);
    expect(brain.focusId ?? 0, 'a hit does not bias subsequent perception toward the shooter').toBe(0);
    const until = brain.search.until;
    for (let i = 0; i < 30; i++) world.update();
    world.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: 9002, actionId: 'weapon.pistol', origin: shot, direction: { x: 1, z: 0 }, base: 3, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
    expect(brain.search.until).toBeGreaterThan(until);
    const goal = [brain.goalX, brain.goalZ]; // Navigation scatters arrival points around the remembered origin.
    Object.assign(courier.transform, { z: shot.z + 25 });
    world.physics.playerBody!.setTranslation(courier.transform, true); world.spatial.set(1, courier.transform.x, courier.transform.z);
    const before = infected.transform.x;
    for (let i = 0; i < 90; i++) world.update();
    expect(infected.transform.x).toBeLessThan(before - 1);
    expect([brain.goalX, brain.goalZ]).toEqual(goal);
    expect([brain.search.originX, brain.search.originZ]).toEqual([shot.x, shot.z]);
  } finally { world.dispose(); }
}, 120_000);

test('a hit respects an active director attack move', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena');
  try {
    world.infected!.configureL1v2();
    const id = world.infected!.spawn('infected.runner', { x: 32, z: 0 });
    const brain = world.entities.get(id)!.infected!.l1!;
    expect(world.infected!.press(id, 1, world.tick + 720)).toBe(true);
    const goal = [brain.goalX, brain.goalZ], until = brain.focusUntil;
    Object.assign(world.entities.get(1)!.transform, { z: 25 });
    world.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: 9001, actionId: 'weapon.pistol', origin: { x: 0, z: 25 }, direction: { x: 1, z: 0 }, base: 3, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
    expect([brain.goalX, brain.goalZ]).toEqual(goal);
    expect(brain.focusUntil).toBe(until);
    expect(brain.focusId).toBe(1);
  } finally { world.dispose(); }
}, 120_000);

for (const outbreak of [false, true]) test(`a recycled ${outbreak ? 'outbreak' : 'archetype'} brain forgets the previous actor being hit`, async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena');
  try {
    if (outbreak) world.infected!.configureL1v2();
    const id = world.infected!.spawn('infected.runner', { x: 32, z: 0 });
    const infected = world.entities.get(id)!;
    if (outbreak) world.infected!.press(id, 1, world.tick + 720);
    world.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: 9001, actionId: 'weapon.pistol', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 3, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
    expect(infected.infected!.provoked).toBeDefined();
    world.infected!.release(infected);
    const next = world.entities.get(world.infected!.spawn('infected.runner', { x: -32, z: 0 }))!;
    expect(next.infected).toBe(infected.infected);
    expect(next.infected!.provoked).toBeUndefined();
    expect(next.infected!.l1?.focusId ?? 0).toBe(0);
  } finally { world.dispose(); }
}, 120_000);
