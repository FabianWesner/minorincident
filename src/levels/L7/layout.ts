import subway from '../../../public/assets/layouts/D-SUBWAY.layout.json' with { type: 'json' };
import { l5Fires } from '../../data/l5';
import { l7Rocket } from '../../data/l7';
import manifest from '../../assets/manifest.json' with { type: 'json' };
import type { DistrictLayout, Placement, PlacementTransform, Point } from '../districts/types';
import { levelFiveLayouts, l5ShellAssets } from '../L5/layout';
import { l7CorridorAnchors, l7CorridorItems } from './corridor';

/** The authored city and Northgate strip; fast mask matches the stepped bounds exactly. */
export const l7Areas = [{ min: [-85, -65], max: [94, 65] }, { min: [94, -15], max: [290, 45] }] as const;
export function l7Contains(x: number, z: number): boolean {
  const [city, strip] = l7Areas;
  return (x >= city.min[0] && x < city.max[0] && z >= city.min[1] && z < city.max[1]) ||
    (x >= strip.min[0] && x < strip.max[0] && z >= strip.min[1] && z < strip.max[1]);
}

/** Exact L6 world-space handover; neither the exit nor Fairhaven's landmarks move. */
export const l7Exit = structuredClone(subway.anchors['night-exit']) as PlacementTransform;
export const l7Fires = [...l5Fires, ...([
  [271, 23], [247, 4], [211, 27], [173, 3], [135, 27], [95, 5],
  [-34, -19], [5, 14], [57, -26],
] as Point[]).map(at => ({ at, r: 1.8, deep: true }))];
/** Four destroyed segments retain broad kerb detours, not invisible gates. */
export const l7StreetDamage: readonly Point[] = [[232, 15], [194, 15], [156, 15], [118, 15]];

/** Rear-yard fences that closed the west alley: its inner row and the two end rows (the outer edge fence stays). */
const westYardFence = ({ position: [x, , z] }: Placement) => x > -84 && x < -64 && z > -36 && z < 42 &&
  (Math.abs(x + 73.2) < .1 || Math.abs(z + 34.6) < .1 || Math.abs(z - 40.6) < .1);

export function levelSevenLayouts(layouts: DistrictLayout[]): DistrictLayout[] {
  return levelFiveLayouts(layouts).map(layout => {
    if (layout.district !== 'D-FAIR') return layout;
    // Explicit W5 retention: keep city shells, road furniture, rubble, wrecks and
    // their colliders. The underground concourse and signs of rescue expire.
    const remove = new Set(layout.placements.filter(p => p.id === 'l5-station' || p.id.startsWith('l5-cue-') || p.assetId === 'prop.hmg-nest' || p.assetId === 'int.basement-cellar' || (p.assetId === 'prop.privacy-fence' && (p.position[0] > 80 || westYardFence(p)))).map(p => p.id));
    // The Kessler cellar's walls would close the west corridor: W6 buries it with the rest of the yard.
    for (const c of layout.colliders) if (c.id.startsWith('dressing:cellar-')) remove.add(c.id);
    for (const p of layout.placements) if (p.maxTier === 5 && !remove.has(p.id)) p.maxTier = 6;
    for (const c of layout.colliders) if (c.maxTier === 5 && ![...remove].some(id => c.id === id || c.id.startsWith(id + '/'))) c.maxTier = 6;
    for (const p of layout.placements) if (l5ShellAssets.includes(p.assetId)) p.decay = 'w6';
    layout.layers.push({ tier: 6, remove: [...remove], disableLights: [...layout.lightGroups.map(g => g.id), 'l7-dead'] });
    const add = (id: string, assetId: string, x: number, z: number, yaw = 0, scale = 1, decay?: string, y = 0) => {
      const dim = manifest.find(a => a.id === assetId)!.dimensions, c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
      const hx = (c * dim.x + s * dim.z) * scale / 2, hz = (s * dim.x + c * dim.z) * scale / 2;
      const p: Placement = { id, assetId, position: [x, y, z], yaw, scale: [scale, scale, scale], minTier: 6, maxTier: 6, allowRoad: true, lightGroup: 'l7-dead', visualAabb: { min: [x - hx, y, z - hz], max: [x + hx, y + dim.y * scale, z + hz] } };
      if (decay) p.decay = decay;
      layout.placements.push(p);
    };
    layout.lightGroups.push({ id: 'l7-dead', offAt: 6 });
    layout.anchors['l7-night-exit'] = structuredClone(l7Exit);
    layout.anchors['pair-northgate-exit'] = structuredClone(subway.anchors['photo-l6-exit-night']) as PlacementTransform;
    layout.anchors['player-start'] = structuredClone(l7Exit);
    layout.anchors['l7-rocket'] = { position: [l7Exit.position[0] + l7Rocket.exitOffset[0], l7Exit.position[1], l7Exit.position[2] + l7Rocket.exitOffset[1]], yaw: 0 };
    layout.anchors['l7-route-junction'] = { position: [78, 0, 28.6], yaw: 0 };
    // The east extension is only 26 m wide. Two branches enter the retained
    // Harbor/Lakeshore network; D2 owns their far-end corridor and bus dressing.
    layout.bounds = [[-85, -65], [94, -65], [94, -15], [290, -15], [290, 45], [94, 45], [94, 65], [-85, 65], [-85, -65]];
    for (const [id, point] of [['l7-exit', [273, 15]], ['l7-east', [88, 15]]] as [string, Point][]) layout.roads.nodes.push({ id, point });
    layout.roads.edges.push(
      { id: 'l7-northgate', start: 'l7-exit', end: 'l7-east', points: [[273, 15], [88, 15]], laneWidth: 10 },
      { id: 'l7-harbor-link', start: 'l7-east', end: 'n9', points: [[88, 15], [88, -40], [78, -40]], laneWidth: 6 },
      { id: 'l7-lakeshore-link', start: 'l7-east', end: 'n4', points: [[88, 15], [88, 46], [76, 46]], laneWidth: 6 },
    );
    // Keep Northgate's elevated exit apron; shallow terrace supports descend to
    // Fairhaven without a teleport. The matching W6 paving is baked by build-ground.
    for (let i = 0; i < 40; i++) {
      const x = 85 + i * 5, h = Math.min(3.9, Math.max(0, (x - 85) / 130 * 3.9));
      layout.surfaces.push({ surface: 'tile', height: h, polygon: [[x, 2], [x + 5, 2], [x + 5, 30], [x, 30], [x, 2]] });
    }
    const mouth = structuredClone(subway.placements.find(p => p.assetId === 'int.metro-exit')) as Placement;
    mouth.id = 'l7-northgate-mouth'; mouth.minTier = 6; mouth.maxTier = 6; mouth.lightGroup = 'l7-dead';
    layout.placements.push(mouth);
    add('l7-rocket-wreck', l7Rocket.vehicle, l7Exit.position[0] + l7Rocket.vehicleExitOffset[0], l7Exit.position[2] + l7Rocket.vehicleExitOffset[1], 0, 1, l7Rocket.decay, 3.9);
    for (const [i, x] of [252, 214, 176, 138, 100].entries()) {
      const y = Math.min(3.9, Math.floor((x - 85) / 5) * 5 / 130 * 3.9);
      add(`l7-military-${i}`, i % 2 ? 'veh.military-truck' : 'veh.military-apc', x, i % 2 ? 25 : 6, .18 * (i % 3 - 1), 1, 'wrecked', y);
      add(`l7-edge-shell-${i}`, i % 2 ? 'bld.storefront-row' : 'bld.apartment-block-a', x, i % 2 ? 36 : -5, Math.PI / 2, 1, 'w6');
    }
    for (const [i, [x, z]] of l7StreetDamage.entries()) {
      const y = Math.min(3.9, Math.floor((x - 85) / 5) * 5 / 130 * 3.9);
      add(`l7-crater-${i}`, 'decay.crater', x, z, i * .7, 1, undefined, y + .01);
      add(`l7-road-rubble-${i}`, 'decay.rubble-pile', x, z + (i % 2 ? 4 : -4), i * .8, .8, undefined, y);
    }
    // Extra collapses at existing frontages; recognizable footprints stay exact.
    for (const [i, [x, z, yaw]] of [[18.4, 8.6, Math.PI], [54.8, 8.6, 0], [-38.4, -15.5, 0], [-13.7, -23.7, -Math.PI / 2]].entries())
      add(`l7-collapse-${i}`, 'decay.collapsed-facade', x, z, yaw);
    // D2: west evacuation corridor, working bus and two-sided approach.
    for (const [id, anchor] of Object.entries(l7CorridorAnchors)) layout.anchors[id] = structuredClone(anchor);
    for (const [id, assetId, x, z, yaw, scale, decay] of l7CorridorItems) add(`l7-corridor-${id}`, assetId, x, z, yaw, scale, decay);
    // The working bus is a set piece spawned by LevelSevenDeparture (it has to drive away), not a static placement.
    return layout;
  });
}
