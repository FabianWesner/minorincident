import { expect, test, vi } from 'vitest';
import { NavGrid } from '../../src/sim/ai/NavGrid';
import { infectedDef } from '../../src/data/infected';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { loadLevel } from '../../tools/sim-runner/levels';

test('director pressure brings every native role to its human without replacing its combat role', async () => {
  for (const kind of ['crawler', 'riot', 'firefighter', 'hazmat']) {
    const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena', 3);
    try {
      const ai = world.infected!; for (const e of [...ai.active]) ai.release(e);
      ai.director.ambientTarget = 0; ai.director.queue.length = 0; world.npcs!.setAmbient(0);
      const at = { x: 12, z: 12 }, human = world.npcs!.civilians.spawn('cashier', at, { waypoints: [at] });
      vi.spyOn(world.npcs!.civilians, 'update').mockImplementation(() => {});
      const archetype = `infected.${kind}`, id = ai.spawn(archetype, { x: 12, z: 0 });
      expect(ai.press(id, human, world.tick + 600)).toBe(true);
      for (let tick = 0; tick < 180; tick++) world.update();
      const e = world.entities.get(id)!;
      expect(e.transform.z).toBeGreaterThan(3);
      expect(Math.hypot(e.transform.x - at.x, e.transform.z - at.z)).toBeLessThan(9);
      expect(e.archetype).toBe(archetype);
      expect(e.infected!.special).toBe(infectedDef(archetype).special);
      expect(e.infected!.speed).toBe(infectedDef(archetype).speed);
    } finally { world.dispose(); }
  }
});

// A street doorway has thin jambs beside a wider solid: the closest baked
// cell can be across the jamb even though the body stands on its camp side.
test('native routing clears thin doorways and yields failed shared searches', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena', 3);
  try {
    const ai = world.infected!; for (const e of [...ai.active]) ai.release(e);
    const nav = new NavGrid({ width: 40, depth: 40 }, [
      { x: 0, z: 0, y: .96, halfX: 1.82, halfZ: .485, halfY: .76 },
      { x: -1.74, z: 1.802, y: .915, halfX: 1.241, halfZ: .123, halfY: .735 },
      { x: .74, z: 1.802, y: .915, halfX: 1.241, halfZ: .123, halfY: .735 },
    ]);
    vi.spyOn(ai.navigation, 'grid').mockReturnValue(nav);
    vi.spyOn(ai, 'infectedNav', 'get').mockReturnValue(nav);
    const id = ai.spawn('infected.riot', { x: 6, z: 6 }), e = world.entities.get(id)!;
    Object.assign(e.transform, { x: 1.741, z: 1.329 });
    const b = e.infected!; b.l4ArmyApproach = true;
    b.pathGrid = ai.navigation.district(e.transform); b.goal = nav.nearestCell(-1.1, -8, e.combat!.radius);
    b.path.push(nav.cell(1.75, 2.25), b.goal); b.pathIndex = 0; // stale after a crowd push through the doorway
    const seek = ai as unknown as { budget: number; seek(entity: typeof e, target: { x: number; z: number }): void };
    for (let tick = 0; tick < 900; tick++) { world.tick++; seek.budget = 2000; seek.seek(e, { x: -1.1, z: -8 }); }
    expect(e.transform.z).toBeLessThan(-4);
  } finally { world.dispose(); }
  await failedNativeRouteYieldsBudget();
  await railingRouteKeepsItsStartingStep();
});

async function railingRouteKeepsItsStartingStep(): Promise<void> {
  const world = await loadLevel('L1', 1);
  try {
    const ai = world.infected!, source = ai.navigation.grid({ x: 4, z: 34 });
    const nav = new NavGrid(source.ground, source.walls, source.clearance, source.center, source.mask);
    vi.spyOn(ai.navigation, 'grid').mockReturnValue(nav);
    vi.spyOn(ai, 'infectedNav', 'get').mockReturnValue(nav);
    const e = world.entities.get(ai.spawn('infected.runner', { x: 12, z: 12 }))!;
    Object.assign(e.transform, { x: 4.065538176560123, z: 34.29496506297734 });
    const brain = e.infected!.l1!;
    const steering = ai as unknown as { budget: number; routes: number; steerL1(entity: typeof e, brainState: typeof brain, goal: { x: number; z: number }, speed: number): void };
    for (let tick = 0; tick < 120; tick++) {
      world.tick++; steering.budget = 2000; steering.routes = 0;
      steering.steerL1(e, brain, { x: 28.280864715576172, z: 32.09096145629883 }, 5.3);
      expect(nav.clear(e.transform.x, e.transform.z, e.combat!.radius), 'the full body clears the railing').toBe(true);
    }
    expect(e.transform.x, 'walk back around the first post before continuing east').toBeGreaterThan(8);
  } finally { world.dispose(); }
}

async function failedNativeRouteYieldsBudget(): Promise<void> {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena', 3);
  try {
    const ai = world.infected!; for (const e of [...ai.active]) ai.release(e);
    const first = world.entities.get(ai.spawn('infected.riot', { x: 12, z: 0 }))!;
    const second = world.entities.get(ai.spawn('infected.hazmat', { x: 12, z: 3 }))!;
    first.infected!.l4ArmyApproach = second.infected!.l4ArmyApproach = true;
    const nav = ai.navigation.grid(first.transform);
    vi.spyOn(nav, 'visible').mockReturnValue(false);
    const path = vi.spyOn(nav, 'path').mockImplementation((_from, _to, result, budget) => { result.length = 0; nav.expansions = budget; return false; });
    const seek = ai as unknown as { budget: number; seek(entity: typeof first, target: { x: number; z: number }): void };
    const targetA = { x: -6, z: -8 }, targetB = { x: 6, z: 8 };
    seek.budget = 2000; seek.seek(first, targetA);
    world.tick++; seek.budget = 2000; seek.seek(first, targetA); seek.seek(second, targetB);
    expect(path).toHaveBeenCalledTimes(2);
    expect(path.mock.calls[1][1]).toBe(nav.nearestCell(targetB.x, targetB.z, second.combat!.radius));
  } finally { world.dispose(); }
}

test('a scripted Alpha reaches its charge staging gate without a crowd push', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena', 3);
  try {
    const ai = world.infected!; for (const e of [...ai.active]) ai.release(e);
    const alpha = world.entities.get(ai.spawn('infected.alpha', { x: 12, z: 0 }))!;
    world.scenario = 'L4';
    const target = { x: 12, z: 6 }; alpha.infected!.scripted = target;
    const seek = ai as unknown as { budget: number; seek(entity: typeof alpha, target: { x: number; z: number }): void };
    for (let tick = 0; tick < 600; tick++) { world.tick++; seek.budget = 2000; seek.seek(alpha, target); }
    expect(Math.hypot(alpha.transform.x - target.x, alpha.transform.z - target.z)).toBeLessThan(1.2);
  } finally { world.dispose(); }
});
