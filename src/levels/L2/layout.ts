import { l2Anchors } from '../../data/l2';
import type { DistrictLayout, Placement } from '../districts/types';

/** Kinds of the W1 "wounded, but still standing" dressing (E20 section 5.7); counted by the static AC15 test. */
export type DressingKind = 'corpse' | 'abandoned' | 'crashed' | 'bin' | 'belongings' | 'broken-window' | 'blood' | 'emergency' | 'smoking' | 'fighting' | 'station' | 'checkpoint' | 'river';
/** `entity`: not a static placement: an entity the L2 controller spawns (dead bystanders) or L2Props code art (broken windows). */
export interface Dressing { kind: DressingKind; assetId: string; x: number; z: number; yaw?: number; scale?: number; count?: number; lit?: boolean; entity?: boolean }
const H = Math.PI / 2;
/**
 * Static L2 dressing manifest. Asset ids are manifest ids; ids that are not integrated yet (`decay.dropped-belongings`,
 * `decay.broken-glass`) render as registry placeholders until the art lane lands them. Counts per entry default to 1;
 * `inf.corpse-poses` carries four bodies.
 */
export const l2Dressing: readonly Dressing[] = [
  // Corpses: bystanders killed in the first hours, lying where they fell (dead pedestrians of the civilian crowd, spawned by the
  // L2 controller, so they cost no extra batch; the asset is their crowd model).
  ...([[-36.8, 8.4, 'npc.civilian-man-a'], [-35.6, 10.2, 'npc.civilian-woman-b'], [10.4, -35.6, 'npc.civilian-man-b'], [12.2, -36.4, 'npc.civilian-woman-a'], [-24, -34.4, 'npc.civilian-elderly'], [44.2, 26.4, 'npc.civilian-man-a'], [-46.4, 32.8, 'npc.civilian-woman-a']] as const)
    .map(([x, z, assetId], i) => ({ kind: 'corpse' as const, assetId, x, z, yaw: i * 1.7, entity: true })),
  // Abandoned vehicles, doors open, pulled onto the kerb.
  { kind: 'abandoned', assetId: 'veh.sedan-blue', x: -47.5, z: 28.6, yaw: .12 },
  { kind: 'abandoned', assetId: 'veh.suv-dark', x: -12, z: 32.2, yaw: Math.PI - .2 },
  { kind: 'abandoned', assetId: 'veh.pickup-white', x: 4, z: -28.6, yaw: Math.PI + .15 },
  { kind: 'abandoned', assetId: 'veh.sedan-white', x: 30, z: -33.4, yaw: .1 },
  { kind: 'abandoned', assetId: 'veh.courier-van', x: -61.6, z: -22, yaw: H + .1 },
  { kind: 'abandoned', assetId: 'veh.courier-van', x: -70.4, z: -24, yaw: H - .08 },
  // Crashed: into a lamp post, into each other at the Juniper junction, nose into a hydrant.
  { kind: 'crashed', assetId: 'veh.sedan-green', x: -6.6, z: 26.4, yaw: .7 },
  { kind: 'crashed', assetId: 'veh.sedan-red', x: 11.2, z: -2.6, yaw: 2.3 },
  { kind: 'crashed', assetId: 'veh.suv-green', x: 16.4, z: 3.2, yaw: -.9 },
  { kind: 'crashed', assetId: 'veh.sedan-green', x: 46.6, z: -33.6, yaw: -.5 },
  // Exactly one smoking vehicle (E27 small smoke column at its bonnet).
  { kind: 'smoking', assetId: 'veh.sedan-green', x: 33.6, z: 27.6, yaw: 2.9 },
  // Emergency vehicles left with their lights on.
  { kind: 'emergency', assetId: 'veh.police-sedan', x: -20, z: -28.2, yaw: Math.PI - .3, lit: true },
  { kind: 'emergency', assetId: 'veh.police-sedan', x: 52.4, z: 8, yaw: H + .2, lit: true },
  // Knocked-over bins and spilled bags.
  ...([[-60, -34.4], [-41, -26.6], [-24, -34.6], [-2, -26.8], [18, -34.4], [-60, 33.2], [-36, 26.4], [-16, 26.6], [12, 33.3], [40, 33.2], [55, -3.5], [-62, 8]] as const)
    .map(([x, z], i) => ({ kind: 'bin' as const, assetId: i % 2 ? 'prop.trash-bags' : 'prop.trash-bin', x, z, yaw: i * 1.3 })),
  // Scattered belongings.
  // Scattered belongings (stand-ins from the town's own props until `decay.dropped-belongings` lands).
  ...([[-43.6, -35.2], [-28.4, -20], [-8, 34.6], [20, 34.4], [48.4, -20], [-61.6, 20]] as const).map(([x, z], i) => ({ kind: 'belongings' as const, assetId: ['prop.crates', 'prop.broken-chair', 'prop.carpet', 'prop.pallet', 'prop.wheelbarrow', 'prop.recycling-bin'][i], x, z, yaw: i })),
  // Broken shop and house windows (code art in L2Props until `decay.broken-glass` lands: a dark pane and glass on the pavement).
  ...([[-66.2, -38.4, 0], [-35.6, -37.4, 0], [-19.6, -34.6, 0], [5.6, -26.6, Math.PI], [-10.7, 33.6, 0]] as const).map(([x, z, yaw]) => ({ kind: 'broken-window' as const, assetId: 'decay.broken-glass', x, z, yaw, entity: true })),
  // Main Row by the courier depot (the L1 pickup spot): a car run into the kerb, a blood trail, spilled bags.
  { kind: 'crashed', assetId: 'veh.sedan-red', x: -32.4, z: -29.4, yaw: 2.6 },
  { kind: 'blood', assetId: 'decal.blood-trail', x: -35.4, z: -31.4, yaw: 1.2 },
  { kind: 'bin', assetId: 'prop.trash-bags', x: -30.6, z: -35.8, yaw: .4 },
  // Blood trails and pools.
  ...([[-30.6, -12], [-30.6, 16], [0, -31], [-50, 30], [50, -8], [12, 30.4]] as const).map(([x, z], i) => ({ kind: 'blood' as const, assetId: i % 3 === 2 ? 'decal.blood-pool' : 'decal.blood-trail', x, z, yaw: i * .9 })),
  // Small signs of fighting: a dropped baton and a tear-gas canister by the police car.
  { kind: 'fighting', assetId: 'wpn.police-baton', x: -17.6, z: -30.6, yaw: .6 },
  // Fire Station 3 bay: benches for the frightened civilians.
  { kind: 'station', assetId: 'prop.bench', x: -76, z: 44.1, yaw: 0 },
  { kind: 'station', assetId: 'prop.bench', x: -68.7, z: 43.9, yaw: Math.PI },
  // Police bridge checkpoint at the east end of Elm Street: vehicles, barriers, fences, kit, light tower.
  { kind: 'checkpoint', assetId: 'veh.police-suv', x: 78.4, z: 25.9, yaw: .05, lit: true },
  { kind: 'checkpoint', assetId: 'veh.police-sedan', x: 83.3, z: 27.6, yaw: H + .06, lit: true },
  { kind: 'checkpoint', assetId: 'veh.police-sedan', x: 69.6, z: 26.3, yaw: Math.PI + .1, lit: true },
  ...([[75.4, 25.2], [75.4, 34.8], [84, 24.6]] as const).map(([x, z]) => ({ kind: 'checkpoint' as const, assetId: 'prop.barricade', x, z, yaw: x < 80 ? 0 : H })),
  ...([[72.6, 27.6], [72.6, 32.6], [71.2, 30.1]] as const).map(([x, z]) => ({ kind: 'checkpoint' as const, assetId: 'prop.traffic-cone', x, z })),
  ...([[86.6, 30.2]] as const).map(([x, z]) => ({ kind: 'river' as const, assetId: 'bld.river-bridge', x: x + 8, z, yaw: 0 })),
];

/** D-GROVE placements the L2 dressing replaces, matched by asset and position: the numeric suffix of a placement id shifts
 * whenever the generator adds or removes a prop before it (a regenerated layout moved all of these by four). */
const SUPERSEDED: readonly (readonly [asset: string, x: number, z: number])[] = [
  ['bld.mainstreet-brick', -55.64, -42.19], ['kit.edge-roadwork', 82.8, 30], ['veh.courier-van', -48.79, -37.15], ['prop.bench', -53.5, -37.5],
  ['prop.privacy-fence', 80.37, 26.44], ['prop.privacy-fence', 80.37, 28.81], ['prop.privacy-fence', 80.37, 31.19], ['prop.privacy-fence', 80.37, 33.56], ['prop.privacy-fence', 81.5, 35],
];
const supersededIds = (layout: DistrictLayout): Set<string> => new Set(layout.placements.filter(p => SUPERSEDED.some(([asset, x, z]) => p.id.startsWith(`${asset}:`) && Math.abs(p.position[0] - x) < .05 && Math.abs(p.position[2] - z) < .05)).map(p => p.id));
/** The supermarket (Grove Market) replaces the eastern Main Row shop: its open east and south sides are the front and loading doors. */
const MARKET: Placement = { id: 'l2-market', assetId: 'bld.supermarket', position: [-55.6, 0, -42.2], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: false, lightGroup: 'block-2', visualAabb: { min: [-59.8, 0, -46.7], max: [-51.4, 3.5, -37.7] } };

/**
 * L2 copy of the D-GROVE layout (same town as L1, a few hours later): authored L2 anchors, the market, the W1 dressing,
 * the checkpoint at the east end of Elm Street, and no courier bicycle. Feeds collision, navigation and rendering alike.
 */
export function levelTwoLayouts(layouts: DistrictLayout[]): DistrictLayout[] {
  return structuredClone(layouts).map(layout => {
    if (layout.district !== 'D-GROVE') return layout;
    delete layout.anchors['bike-start'];
    layout.anchors['player-start'] = { position: [l2Anchors['l2-start'][0], 0, l2Anchors['l2-start'][1]], yaw: 0 };
    for (const [name, [x, z]] of Object.entries(l2Anchors)) layout.anchors[name] = { position: [x, 0, z], yaw: 0 };
    // Extra toys for the escape: a dumpster at the alley neck off Larch Street and the car alarm by the cluster.
    layout.anchors['dumpster-3'] = { position: [53.2, 0, 15], yaw: 0 }; layout.anchors['dumpster-3-end'] = { position: [55.8, 0, 15], yaw: 0 };
    layout.anchors['alarm-car-5'] = { position: [48.6, 0, 12.4], yaw: 0 };
    const superseded = supersededIds(layout);
    layout.placements = layout.placements.filter(p => !superseded.has(p.id));
    layout.colliders = layout.colliders.filter(c => !superseded.has(c.id));
    layout.placements.push(MARKET);
    for (const [i, d] of l2Dressing.entries()) {
      if (d.entity) continue;
      const s = d.scale ?? 1, decal = d.assetId.startsWith('decal.');
      layout.placements.push({ id: `l2-${d.kind}-${i}`, assetId: d.assetId, position: [d.x, decal ? .06 : 0, d.z], yaw: d.yaw ?? 0, scale: decal ? [1.4, 1, 2.6] : [s, s, s], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: 'l2', visualAabb: { min: [d.x - 1, 0, d.z - 1], max: [d.x + 1, 1.5, d.z + 1] } });
    }
    layout.placements.push({ id: 'l2-alarm-car-5', assetId: 'veh.sedan-white', position: [48.6, 0, 12.4], yaw: H, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: 'l2', visualAabb: { min: [47.6, 0, 10.2], max: [49.6, 1.6, 14.6] } });
    layout.lightGroups.push({ id: 'l2', offAt: 5 });
    return layout;
  });
}
