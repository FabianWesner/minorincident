import { expect, test, vi } from 'vitest';
import { NavGrid } from '../../../src/sim/ai/NavGrid';
import { infectedDef } from '../../../src/data/infected';
import { SimWorld } from '../../../src/sim/world/SimWorld';

for (const kind of ['crawler', 'riot', 'firefighter', 'hazmat']) test(`director pressure brings a native ${kind} to its assigned human without replacing its combat role`, async () => {
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
});

// A street doorway has thin jambs beside a wider solid: the closest baked
// cell can be across the jamb even though the body stands on its camp side.
test('native routing starts on its own side of a thin street doorway', async () => {
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
    const seek = ai as unknown as { budget: number; seek(entity: typeof e, target: { x: number; z: number }): void };
    for (let tick = 0; tick < 900; tick++) { world.tick++; seek.budget = 2000; seek.seek(e, { x: -1.1, z: -8 }); }
    expect(e.transform.z).toBeLessThan(-4);
  } finally { world.dispose(); }
});
