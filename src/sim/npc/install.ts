import { SimPhase } from '../../core/EventBus';
import { InfectedSystem } from '../ai/InfectedSystem';
import { Combat } from '../combat/Combat';
import type { SimWorld } from '../world/SimWorld';
import type { ScenarioDefinition } from '../../levels/loader';
import { Npcs } from './Npcs';
/** Minimal campaign integration: assemble navigation from the loaded, decayed district colliders. */
export function installCampaignNpcs(world: SimWorld): void {
  const districts = world.districts!;
  if (!/^L[1-6]$/.test(districts.composition.id)) return;
  const { min, max } = districts.nav, walls = campaignWalls(world);
  const definition: ScenarioDefinition = { name: districts.composition.id, survivor: true, combat: true, infected: true, ground: { width: max[0] - min[0], depth: max[1] - min[1], center: { x: (min[0] + max[0]) / 2, z: (min[1] + max[1]) / 2 } }, player: { ...world.entities.get(1)!.transform }, walls };
  world.combat = new Combat(world, definition); world.infected = new InfectedSystem(world, definition); world.npcs = new Npcs(world);
  world.infected.nav.mask = (x, z) => { const nav = world.districts!.nav; return nav.cells[nav.index(x, z)] === 1; }; world.infected.nav.rebake();
  world.events.on('sim.tick', () => world.infected?.update(), SimPhase.ai); world.events.on('sim.tick', () => world.npcs?.update(), SimPhase.ai);
  world.events.on('objective.completed', event => { if (event.type === 'objective.completed' && event.id === 'breakfast' && world.missions?.def.id === 'L1') { if(world.missions.def.slice)world.npcs?.civilians.alarm(world.missions.def.anchors.diner); else world.npcs?.dinerIncident(world.missions.def.anchors.diner); } });
  world.npcs.configure(Number(districts.composition.id[1])); world.npcs.companion.spawn();
  // W0/W1 ambient traffic is authored only on collision-safe street lanes.
  if (districts.composition.tier <= 1) {
    for (let z = min[1] + 5; z < max[1] - 5; z += 10) {
      const a = { x: min[0] + 5, z }, b = { x: min[0] + 25, z };
      if (world.infected.nav.visible(a, b, 2) && !world.npcs.traffic.overlaps(a)) { world.npcs.traffic.spawn([a, b], districts.composition.tier === 1); break; }
    }
  }
}

function campaignWalls(world: SimWorld): NonNullable<ScenarioDefinition['walls']> {
  const districts = world.districts!, walls: NonNullable<ScenarioDefinition['walls']> = [];
  for (const d of districts.districts) for (const c of d.decay.colliders.map(c => c.aabb).concat(d.blockers)) {
    walls.push({ x: (c.min[0] + c.max[0]) / 2 + d.origin[0], z: (c.min[2] + c.max[2]) / 2 + d.origin[1], y: (c.min[1] + c.max[1]) / 2, halfX: (c.max[0] - c.min[0]) / 2, halfZ: (c.max[2] - c.min[2]) / 2, halfY: (c.max[1] - c.min[1]) / 2 });
  }
  return walls;
}
/** Refresh collision and paths after E10 swaps decay; W2+ removes ambient traffic. */
export function rebuildNpcNavigation(world: SimWorld): void {
  if (!world.npcs || !world.infected || !world.districts) return;
  const walls = world.combat!.definition.walls!;
  walls.splice(0, walls.length, ...campaignWalls(world)); world.infected.nav.rebake();
  for (const e of world.entities.iterate()) {
    const brain = e.civilian ?? e.escort ?? e.companion ?? e.infected;
    if (brain) { brain.path.length = 0; brain.goal = -1; }
    if (e.traffic) {
      if (world.districts.composition.tier > 1) { world.spatial.delete(e.id); world.entities.delete(e.id); }
      else { e.traffic.panic = world.districts.composition.tier === 1; e.traffic.desired = e.traffic.panic ? 9 : 6; }
    }
  }
}
