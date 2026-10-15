import { l7Contains } from '../../levels/L7/layout';
import { SimPhase } from '../../core/EventBus';
import { InfectedSystem } from '../ai/InfectedSystem';
import { Combat } from '../combat/Combat';
import type { SimWorld } from '../world/SimWorld';
import type { ScenarioDefinition } from '../../levels/loader';
import { Npcs } from './Npcs';
import type { DistrictWorld } from '../world/DistrictWorld';
import { inside } from '../../levels/districts/validate';
import { isOutbreakDistrict } from '../../levels/districts/types';
/** Minimal campaign integration: assemble navigation from the loaded, decayed district colliders. */
export function installCampaignNpcs(world: SimWorld): void {
  const districts = world.districts!;
  // L1 v2 (D-GROVE): systems + corgi only; `installL1Outbreak` adds the pedestrians (lane D).
  // L2 also plays on D-GROVE: keep the level for the per-level density/cap tables (E08-AC11 fixture: L2 = 40).
  // L3 (D-CORRIDOR) runs the same outbreak rules: systems + corgi, its controller adds the people.
  if (districts.districts.some(d => isOutbreakDistrict(d.id))) {
    installNpcSystems(world); if (/^L[1-6]$/.test(districts.composition.id)) world.npcs!.civilians.level = Number(districts.composition.id[1]);
    world.npcs!.companion.spawn(); return;
  }
  if (districts.composition.id === 'L10') { installNpcSystems(world); world.combat!.setLoadout(['weapon.fire-axe'], ['weapon.fire-axe']); world.npcs!.companion.forceSafe = true; world.npcs!.companion.spawn(); return; }
  if (districts.composition.id === 'L8' || districts.composition.id === 'L9') { installNpcSystems(world); return; }
  if (!/^L[1-6]$/.test(districts.composition.id)) return;
  installNpcSystems(world); const { min, max } = districts.nav;
  world.npcs!.configure(Number(districts.composition.id[1])); world.npcs!.companion.spawn();
  // W0/W1 ambient traffic is authored only on collision-safe street lanes.
  if (districts.composition.tier <= 1) {
    for (let z = min[1] + 5; z < max[1] - 5; z += 10) {
      const a = { x: min[0] + 5, z }, b = { x: min[0] + 25, z };
      if (world.infected!.nav.visible(a, b, 2) && !world.npcs!.traffic.overlaps(a)) { world.npcs!.traffic.spawn([a, b], districts.composition.tier === 1); break; }
    }
  }
}
/** Combat, infected brains and NPC systems on the loaded district colliders, without any population. */
export function installNpcSystems(world: SimWorld): void {
  const districts = world.districts!;
  const { min, max } = districts.nav, walls = world.chunks?.walls ?? campaignWalls(world);
  // Grid cells need room for the survivor's .45 m corner-steering clearance.
  const definition: ScenarioDefinition = { name: districts.composition.id, survivor: true, combat: true, infected: true, navigationClearance: .5, ground: { width: max[0] - min[0], depth: max[1] - min[1], center: { x: (min[0] + max[0]) / 2, z: (min[1] + max[1]) / 2 } }, player: { ...world.entities.get(1)!.transform }, walls };
  if (world.chunks) definition.ground = world.chunks.bounds();
  // Steering samples this boundary every 20 cm. Authored rectangular districts
  // need only range checks, preserving inside()'s inclusive minimum/exclusive maximum.
  const masks = districts.districts.map(d => {
    const p = d.layout.bounds;
    if (districts.composition.id === 'L7') return (x: number, z: number) => l7Contains(x - d.origin[0], z - d.origin[1]);
    const rectangle = p.length === 5 && p[0][0] === p[4][0] && p[0][1] === p[4][1] &&
      ((p[0][0] === p[1][0] && p[1][1] === p[2][1] && p[2][0] === p[3][0] && p[3][1] === p[0][1]) ||
       (p[0][1] === p[1][1] && p[1][0] === p[2][0] && p[2][1] === p[3][1] && p[3][0] === p[0][0]));
    if (!rectangle) return (x: number, z: number) => inside([x - d.origin[0], z - d.origin[1]], p);
    const minX = Math.min(...p.map(v => v[0])), maxX = Math.max(...p.map(v => v[0]));
    const minZ = Math.min(...p.map(v => v[1])), maxZ = Math.max(...p.map(v => v[1]));
    return (x: number, z: number) => {
      x -= d.origin[0]; z -= d.origin[1];
      return x >= minX && x < maxX && z >= minZ && z < maxZ;
    };
  });
  const mask = (x: number, z: number) => { for (const contains of masks) if (contains(x, z)) return true; return false; };
  // Bake the final footprint once. No navigation queries run in these constructors.
  world.combat = new Combat(world, definition); world.infected = new InfectedSystem(world, definition, world.chunks ? null : districts.composition.id === 'L7' && masks.length === 1 ? masks[0] : mask); world.npcs = new Npcs(world);
  if (world.chunks) world.infected.director.strict = true;
  world.events.on('sim.tick', () => world.infected?.update(), SimPhase.ai); world.events.on('sim.tick', () => world.npcs?.update(), SimPhase.ai);
}

function campaignWalls(world: SimWorld, districts: DistrictWorld = world.districts!): NonNullable<ScenarioDefinition['walls']> {
  const walls: NonNullable<ScenarioDefinition['walls']> = [];
  for (const d of districts.districts) for (const c of d.decay.colliders.filter(c => !c.walkable).map(c => c.aabb).concat(d.blockers)) {
    const x = (c.min[0] + c.max[0]) / 2 + d.origin[0], z = (c.min[2] + c.max[2]) / 2 + d.origin[1];
    // Raised roads retain their wrecks as route obstacles. The ordinary ground
    // height cutoff would otherwise steer followers straight into those hulls.
    const floor = c.min[1] >= 1.8 ? districts.groundHeight(x, z) : 0;
    const raised = floor > 1.8 && c.min[1] < floor + 1.8 && c.max[1] > floor + .05;
    walls.push({ ...(c.navBlocker || raised ? {navBlocker:true} : {}), x, z, y: (c.min[1] + c.max[1]) / 2, halfX: (c.max[0] - c.min[0]) / 2, halfZ: (c.max[2] - c.min[2]) / 2, halfY: (c.max[1] - c.min[1]) / 2 });
  }
  for (const c of districts.boundaries) walls.push({ ...(c.navBlocker ? {navBlocker:true} : {}), x: (c.min[0] + c.max[0]) / 2, z: (c.min[2] + c.max[2]) / 2, y: .525, halfX: (c.max[0] - c.min[0]) / 2, halfZ: (c.max[2] - c.min[2]) / 2, halfY: .525 });
  return walls;
}
/** Refresh collision and paths after E10 swaps decay; W2+ parks ambient traffic. */
export function rebuildNpcNavigation(world: SimWorld): void {
  if (!world.npcs || !world.infected || !world.districts) return;
  const walls = world.combat!.definition.walls!;
  walls.splice(0, walls.length, ...campaignWalls(world)); world.combat!.query.invalidate(); world.infected.nav.rebake(world.preparedNpcNavigation.get(world.districts.composition.tier));
  for (const e of world.entities.iterate()) {
    const brain = e.civilian ?? e.escort ?? e.companion ?? e.infected;
    if (brain) { brain.path.length = 0; brain.goal = -1; }
    if (e.traffic) {
      if (world.districts.composition.tier > 1) { e.traffic.speed = e.traffic.desired = 0; e.traffic.stopped = true; e.traffic.panic = false; }
      else { e.traffic.panic = world.districts.composition.tier === 1; e.traffic.desired = e.traffic.panic ? 9 : 6; }
    }
  }
}

/** Static occupancy only: dynamic doors/barricades are reconciled at the actual swap. */
export function prepareNpcNavigation(world: SimWorld, districts: DistrictWorld): Uint8Array | undefined {
  return world.infected?.nav.prepare(campaignWalls(world, districts));
}
