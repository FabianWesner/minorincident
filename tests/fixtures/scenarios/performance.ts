import type { ScenarioDefinition } from '../../../src/levels/loader';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { InfectedSystem } from '../../../src/sim/ai/InfectedSystem';
import { Combat } from '../../../src/sim/combat/Combat';
import { SimPhase } from '../../../src/core/EventBus';
import type { QualityTier } from '../../../src/core/Quality';
const arena: ScenarioDefinition = { name: 'perf-horde-200', survivor: true, combat: true, infected: true, ground: { width: 120, depth: 120 }, player: { x: 0, y: .705, z: 0 } };
export const performanceScenarios: Record<string, ScenarioDefinition> = {
  'perf-horde-200': arena, 'perf-horde-100': { ...arena, name: 'perf-horde-100' },
};
export const performanceLevels: Record<string, { level: string; spot: string }> = {
  'perf-l1-foliage-200': { level: 'L1', spot: 'V5' },
  'perf-l6-mainstreet': { level: 'L6', spot: 'D-MAIN/W5/overview' },
  'perf-l5-bridge': { level: 'L5', spot: 'D-EDGE/W4/overview' },
  /** E25 night budget: L1's town at night, 41 street lamps (plus windows/signs) in the high light-field window, 60 runners. */
  'perf-night-street': { level: 'night-street', spot: '' },
};
/** Street-lamp-densest point of D-GROVE for the 80 m high-tier light-field window. */
export const nightStreetFocus = { x: -12, z: 4 };
/** Identical seeded, active runner load for browser counters and the Node runner. */
export function populateHorde(world: SimWorld, count: number): void {
  world.combat!.damage.god = true;
  const p = world.entities.get(1)!.transform;
  for (let i = 0; i < count; i++) world.infected!.spawn('infected.runner', { x: p.x + (i % 20) * .8 - 8, z: p.z + Math.floor(i / 20) * .8 - 12 }, { state: 'chase' });
}
/** The perf level includes real campaign geometry/colliders and a worst-cap crowd at its photo spot.
 * Only the debug scenario installs this load; campaign ownership remains with its level epic. */
export function installPerformanceLevel(world: SimWorld, tier: QualityTier, name: string): void {
  if (name === 'perf-night-street') { installNightStreet(world); return; }
  const district = world.districts!.districts.find(d => d.id === (name === 'perf-l1-foliage-200' || name === 'perf-l6-mainstreet' ? 'D-MAIN' : 'D-EDGE'))!;
  const { min, max } = world.districts!.nav;
  const walls: NonNullable<ScenarioDefinition['walls']> = [];
  for (const d of world.districts!.districts) for (const box of d.decay.colliders.map(c => c.aabb).concat(d.blockers)) walls.push({ x: (box.min[0] + box.max[0]) / 2 + d.origin[0], y: (box.min[1] + box.max[1]) / 2, z: (box.min[2] + box.max[2]) / 2 + d.origin[1], halfX: (box.max[0] - box.min[0]) / 2, halfY: (box.max[1] - box.min[1]) / 2, halfZ: (box.max[2] - box.min[2]) / 2 });
  const alreadyUpdating = world.infected !== null;
  world.infected = new InfectedSystem(world, { ...arena, name, ground: { width: max[0] - min[0], depth: max[1] - min[1], center: { x: (min[0] + max[0]) / 2, z: (min[1] + max[1]) / 2 } }, walls });
  world.infected.director.tier = name === 'perf-l1-foliage-200' ? 'high' : tier;
  if (!alreadyUpdating) world.events.on('sim.tick', () => world.infected!.update(), SimPhase.ai);
  world.combat!.damage.god = true;
  const target = name === 'perf-l1-foliage-200' || tier === 'high' ? 200 : 100;
  const player = world.entities.get(1)!;
  if (!world.infected.nav.clear(district.origin[0], district.origin[1], .4)) throw new Error('Perf photo spot is blocked');
  Object.assign(player.transform, { x: district.origin[0], z: district.origin[1] });
  world.previousPlayer = { ...player.transform }; world.spatial.set(1, player.transform.x, player.transform.z); world.physics.playerBody!.setTranslation(player.transform, true);
  world.missions?.begin();
  if (name === 'perf-l1-foliage-200') {
    world.scenario = name;
    // Hold the stress load at V5: overlapping crowd capsules must not push the
    // survivor and the entire attacking crowd out of the measurement frustum.
    world.events.on('sim.tick', () => {
      Object.assign(player.transform, { x: district.origin[0], y: .705, z: district.origin[1] });
      world.physics.playerBody!.setTranslation(player.transform, true);
      world.physics.playerBody!.setLinvel({ x: 0, y: 0, z: 0 }, true);
      world.spatial.set(1, player.transform.x, player.transform.z);
    }, SimPhase.input);
    // Deliberately stress both render tiers with 200 nearby actors, beyond the campaign's low-tier cap.
    const points = [];
    for (let z = -3; z <= 3; z += .45) for (let x = -7; x <= 7; x += .45) points.push({ x: x + player.transform.x, z: z + player.transform.z });
    points.sort((a, b) => Math.hypot(a.x - player.transform.x, a.z - player.transform.z) - Math.hypot(b.x - player.transform.x, b.z - player.transform.z));
    for (const point of points) if (world.infected.director.count < target && world.infected.nav.clear(point.x, point.z, .4)) world.infected.spawn('infected.runner', point, { state: 'chase' });
    if (world.infected.director.count !== target) throw new Error('Foliage combat stress scene lacks crowd positions');
    return;
  }
  // Authored colliders constrain placement; a grid scan yields reproducible legal positions.
  for (let z = -24; z < 24 && world.infected.director.count < target; z += 1.2) for (let x = -24; x < 24 && world.infected.director.count < target; x += 1.2) {
    const p = { x: x + district.origin[0], z: z + district.origin[1] };
    if (world.infected.nav.clear(p.x, p.z, .4)) world.infected.spawn('infected.runner', p, { state: 'chase' });
  }
  if (world.infected.director.count !== target) throw new Error('Perf district lacks legal crowd positions');
}

/** 60 idle runners around the survivor at the lamp-dense focus; god mode keeps the measurement stable. */
function installNightStreet(world: SimWorld): void {
  const { min, max } = world.districts!.nav;
  world.combat ??= new Combat(world, { ...arena, name: 'perf-night-street', player: { ...world.entities.get(1)!.transform } });
  const alreadyUpdating = world.infected !== null;
  world.infected = new InfectedSystem(world, { ...arena, name: 'perf-night-street', ground: { width: max[0] - min[0], depth: max[1] - min[1], center: { x: (min[0] + max[0]) / 2, z: (min[1] + max[1]) / 2 } } });
  if (!alreadyUpdating) world.events.on('sim.tick', () => world.infected!.update(), SimPhase.ai);
  world.combat!.damage.god = true;
  const player = world.entities.get(1)!, nav = world.infected.nav;
  let at = nightStreetFocus;
  for (let r = 0; r < 12 && !nav.clear(at.x, at.z, .4); r++) at = { x: nightStreetFocus.x + r * .7, z: nightStreetFocus.z };
  Object.assign(player.transform, { x: at.x, z: at.z });
  world.previousPlayer = { ...player.transform }; world.spatial.set(1, at.x, at.z); world.physics.playerBody!.setTranslation(player.transform, true);
  for (let z = -10; z < 12 && world.infected.director.count < 60; z += 1.3) for (let x = -12; x < 12 && world.infected.director.count < 60; x += 1.3) {
    const p = { x: at.x + x, z: at.z + z };
    if (Math.hypot(x, z) > 3 && nav.clear(p.x, p.z, .4)) world.infected.spawn('infected.runner', p, { state: 'idle' });
  }
  if (world.infected.director.count !== 60) throw new Error('Night street lacks crowd positions');
}
