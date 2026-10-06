import type { ScenarioDefinition } from '../../../src/levels/loader';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { InfectedSystem } from '../../../src/sim/ai/InfectedSystem';
import { SimPhase } from '../../../src/core/EventBus';
import type { QualityTier } from '../../../src/core/Quality';
const arena: ScenarioDefinition = { name: 'perf-horde-200', survivor: true, combat: true, infected: true, ground: { width: 120, depth: 120 }, player: { x: 0, y: .705, z: 0 } };
export const performanceScenarios: Record<string, ScenarioDefinition> = {
  'perf-horde-200': arena, 'perf-horde-100': { ...arena, name: 'perf-horde-100' },
};
export const performanceLevels: Record<string, { level: string; spot: string }> = {
  'perf-l6-mainstreet': { level: 'L6', spot: 'D-MAIN/W5/overview' },
  'perf-l5-bridge': { level: 'L5', spot: 'D-EDGE/W4/overview' },
};
/** Identical seeded, active runner load for browser counters and the Node runner. */
export function populateHorde(world: SimWorld, count: number): void {
  world.combat!.damage.god = true;
  const p = world.entities.get(1)!.transform;
  for (let i = 0; i < count; i++) world.infected!.spawn('infected.runner', { x: p.x + (i % 20) * .8 - 8, z: p.z + Math.floor(i / 20) * .8 - 12 }, { state: 'chase' });
}
/** The perf level includes real campaign geometry/colliders and a worst-cap crowd at its photo spot.
 * Only the debug scenario installs this load; campaign ownership remains with its level epic. */
export function installPerformanceLevel(world: SimWorld, tier: QualityTier, name: string): void {
  const district = world.districts!.districts.find(d => d.id === (name === 'perf-l6-mainstreet' ? 'D-MAIN' : 'D-EDGE'))!;
  const { min, max } = world.districts!.nav;
  const walls: NonNullable<ScenarioDefinition['walls']> = [];
  for (const d of world.districts!.districts) for (const box of d.decay.colliders.map(c => c.aabb).concat(d.blockers)) walls.push({ x: (box.min[0] + box.max[0]) / 2 + d.origin[0], y: (box.min[1] + box.max[1]) / 2, z: (box.min[2] + box.max[2]) / 2 + d.origin[1], halfX: (box.max[0] - box.min[0]) / 2, halfY: (box.max[1] - box.min[1]) / 2, halfZ: (box.max[2] - box.min[2]) / 2 });
  world.infected = new InfectedSystem(world, { ...arena, name, ground: { width: max[0] - min[0], depth: max[1] - min[1], center: { x: (min[0] + max[0]) / 2, z: (min[1] + max[1]) / 2 } }, walls });
  world.infected.director.tier = tier;
  world.events.on('sim.tick', () => world.infected!.update(), SimPhase.ai);
  world.combat!.damage.god = true;
  const target = tier === 'high' ? 200 : 100;
  const player = world.entities.get(1)!;
  if (!world.infected.nav.clear(district.origin[0], district.origin[1], .4)) throw new Error('Perf photo spot is blocked');
  Object.assign(player.transform, { x: district.origin[0], z: district.origin[1] });
  world.previousPlayer = { ...player.transform }; world.spatial.set(1, player.transform.x, player.transform.z); world.physics.playerBody!.setTranslation(player.transform, true);
  world.missions?.begin();
  // Authored colliders constrain placement; a grid scan yields reproducible legal positions.
  for (let z = -24; z < 24 && world.infected.director.count < target; z += 1.2) for (let x = -24; x < 24 && world.infected.director.count < target; x += 1.2) {
    const p = { x: x + district.origin[0], z: z + district.origin[1] };
    if (world.infected.nav.clear(p.x, p.z, .4)) world.infected.spawn('infected.runner', p, { state: 'chase' });
  }
  if (world.infected.director.count !== target) throw new Error('Perf district lacks legal crowd positions');
}
