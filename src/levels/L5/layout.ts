import { moveFairhavenCellar } from '../fairhavenCellar';
import { l4, l4FuelCrater, l4Anchors, l4Cars, l4ConvoyStations, l4Line, l4Route, l4RoutePose } from '../../data/l4';
import subwayLayout from '../../../public/assets/layouts/D-SUBWAY.layout.json' with { type: 'json' };
import { l5, l5Anchors, l5Survivors } from '../../data/l5';
import { findClearSpot, footprints, moveOffSolids, freestanding, obstaclesOf } from '../placementClearance';
import type { DistrictLayout, Placement } from '../districts/types';
import { l4Dressing } from '../L4/layout';

/**
 * Kinds of the W5 "devastated twin" dressing (E23 section 5.1), counted by the static AC06 test. Everything is static: nothing here
 * moves or shoots. `corpse` entries are entities the controller spawns (finished pedestrians); the fires and smoke columns (E27 hazards) are `l5Fires` in the data.
 */
export type L5DressingKind = 'burned-car' | 'military' | 'bus' | 'glass' | 'collapse' | 'corpse'
  | 'belongings' | 'weapon' | 'barricade' | 'nest' | 'crater' | 'rubble' | 'cue' | 'barrier' | 'block';
export interface L5Dressing {
  kind: L5DressingKind; assetId: string; x: number; z: number; yaw?: number; scale?: number; decay?: string; entity?: boolean;
  /** Corpses: in army uniform (the national-guard skin). */
  uniform?: boolean;
  /** Free-standing deliberate blockers keep their spot (no clear-spot search). */
  fixed?: boolean;
}
/** Buildings with a reviewed devastated `w5` shell (manifest `decayVariants`; the static test keeps this list equal to the manifest). */
export const l5ShellAssets: readonly string[] = ['bld.apartment-block-a', 'bld.apartment-block-b', 'bld.church', 'bld.kessler-hardware', 'bld.metro-entrance', 'bld.storefront-row', 'bld.town-hall'];
const H = Math.PI / 2, PI = Math.PI;
const d = (kind: L5DressingKind, assetId: string, x: number, z: number, more: Partial<L5Dressing> = {}): L5Dressing => ({ kind, assetId, x, z, ...more });
const corpse = (x: number, z: number, model: string, yaw: number, uniform = false) => d('corpse', model, x, z, { yaw, entity: true, uniform });

/** Only some vehicle models ship `wrecked` / `burned` shells (manifest `decayVariants`): the others (green sedan and SUV, white pickup) stand in as their burnable sibling. */
const burnable = (assetId: string, i = 0): string => assetId.startsWith('veh.sedan') ? ['veh.sedan-red', 'veh.sedan-blue', 'veh.sedan-white'][i % 3] : assetId.startsWith('veh.suv') ? 'veh.suv-dark' : assetId.startsWith('veh.pickup') ? 'veh.pickup-red' : assetId;
const route = l4Route(), stations = l4ConvoyStations(route.length);
const pose = (i: number) => l4RoutePose(route, stations.end[i]);

/** The parked column at the plaza: what the L4 convoy left, now burned out. */
const convoy = (() => {
  const out: L5Dressing[] = [];
  const kinds = [['military', 'veh.military-apc', 'wrecked', 1], ['military', 'veh.military-truck', 'wrecked', 1], ['bus', 'veh.school-bus', 'burned', .92], ['military', 'veh.military-truck', 'wrecked', 1], ['bus', 'veh.school-bus', 'burned', .92]] as const;
  for (const [i, [kind, assetId, decay, scale]] of kinds.entries()) { const p = pose(i); out.push(d(kind, assetId, p.x, p.z, { yaw: p.yaw + (i % 2 ? .06 : -.05), decay, scale, fixed: true })); }
  return out;
})();

/** Fairhaven's own cars (the parked ones and the six the war set alight in L4), now burned out or wrecked: ten of them exactly where they stood. */
const carModels: Record<string, string> = { 'vehicle.sedan': 'veh.sedan-white', 'vehicle.suv': 'veh.suv-dark', 'vehicle.pickup': 'veh.pickup-red' };
const burnedCars: L5Dressing[] = [
  ...l4Dressing.filter(e => e.kind === 'parked' && !(e.x > 36 && e.x < 44 && e.z < -40)).map((e, i) => d('burned-car', burnable(e.assetId, i), e.x, e.z, { yaw: e.yaw, decay: i % 3 === 2 ? 'wrecked' : 'burned' })),
  ...l4Cars.map((c, i) => d('burned-car', burnable(carModels[c.def] ?? 'veh.sedan-white', i + 1), c.at[0], c.at[1], { yaw: c.yaw + (i % 2 ? .2 : -.15), decay: 'burned' })),
];

/** Static W5 dressing manifest (the broken glass and the bullet damage at the frontages are derived from the layout, see below). */
export const l5Dressing: readonly L5Dressing[] = [
  // ---------------------------------------------------------------- the war's wrecks: the convoy column, the tank where it stopped, the fuel-truck crater
  ...convoy,
  d('military', 'veh.tank', l4.tank.path[3][0] + .4, l4.tank.path[3][1] + 1.5, { yaw: H + .35, decay: 'wrecked', fixed: true }),
  d('crater', 'decay.fuel-truck-crater', l4FuelCrater.x, l4FuelCrater.z, { yaw: l4FuelCrater.yaw, fixed: true }),
  d('crater', 'decay.crater', -24.5, 6.5, { yaw: .3, fixed: true }), d('crater', 'decay.crater', -27, -5, { yaw: 1.2, fixed: true }), d('crater', 'decay.crater', -8, 14.5, { yaw: 2.1, fixed: true }),
  ...burnedCars,
  // ---------------------------------------------------------------- blown sandbag lines, abandoned nests, barriers pushed aside, wreckage
  ...([[-27, -14.4, 0], [-20.6, -14.6, .2], [-33.4, -9.6, H], [-33.4, 5.6, H + .15], [-33.2, 11.6, H], [-29, 17.8, 0], [-22.5, 17.6, -.2], [-18, 17.9, 0]] as const).map(([x, z, yaw]) => d('barricade', 'decay.blown-sandbags', x, z, { yaw, fixed: true })),
  ...l4Line.filter((_, i) => i % 3 === 1).map(p => d('barricade', 'prop.sandbag-pallet', p.x + (p.yaw ? .3 : 0), p.z + (p.yaw ? 0 : .35), { yaw: (p.yaw === 0 ? 0 : H) + .5 })),
  d('nest', 'prop.hmg-nest', l4Anchors['l4-hmg-1'][0], l4Anchors['l4-hmg-1'][1], { yaw: PI + 1.2 }), d('nest', 'prop.hmg-nest', l4Anchors['l4-hmg-2'][0], l4Anchors['l4-hmg-2'][1], { yaw: -1.1 }),
  ...([[-78.5, 42.1, .5], [-75.5, 49.9, -.4], [-72.5, 42.3, 0], [81.2, -43.4, H + .2], [81.2, 43.5, H - .3]] as const).map(([x, z, yaw]) => d('barrier', 'prop.jersey-barrier', x, z, { yaw })),
  ...([[-36, 20.6], [-5, 8.6], [-30, 28], [8.4, 3.4], [-14, -17.4], [40, -37.4], [-48, 38.6], [52, 30.4]] as const).map(([x, z], i) => d('rubble', 'decay.rubble-pile', x, z, { yaw: i * 1.3 })),
  ...([[-17, 9], [-23, -9], [-28, 14], [-9, -8], [12, 4], [30, 35], [-40, 40], [20, -37]] as const).map(([x, z], i) => d('rubble', 'decay.rubble-pile', x, z, { yaw: i * 0.9, scale: .45 + (i % 3) * .1 })),
  // ---------------------------------------------------------------- three street segments narrowed by wreckage (a 1.4 m or wider gap stays open: the detour round the kerb)
  d('block', 'veh.military-truck', 31, -42.2, { yaw: H + .12, decay: 'wrecked', fixed: true }), d('block', 'veh.sedan-red', 12.6, 24.6, { yaw: .1, decay: 'burned', fixed: true }),
  d('block', 'veh.pickup-red', -18, 44.4, { yaw: H - .2, decay: 'wrecked', fixed: true }),
  // ---------------------------------------------------------------- the hiding place that is a wreck on the street: the bus on Lakeshore Avenue (Dale hides in the plaza's convoy truck)
  d('bus', 'veh.school-bus', -45, 46.3, { yaw: .04, decay: 'wrecked', fixed: true }),
  // ---------------------------------------------------------------- the dead: ~36 corpses (a quarter or more in uniform), body bags, belongings, dropped weapons
  corpse(-27.4, -12.6, 'npc.national-guard', 1.1, true), corpse(-23, -13.4, 'npc.national-guard', 4.0, true), corpse(-31, -8.6, 'npc.national-guard', 2.7, true), corpse(-32.4, 2.4, 'npc.national-guard', 0.3, true),
  corpse(-31.2, 11.2, 'npc.national-guard', 5.1, true), corpse(-26, 18.6, 'npc.national-guard', 3.4, true), corpse(-19.6, 19, 'npc.national-guard', 1.9, true), corpse(-9.6, 10.6, 'npc.national-guard', 2.2, true),
  corpse(-9.4, -3, 'npc.national-guard', 0.9, true), corpse(-13.2, -13.8, 'npc.national-guard', 4.7, true), corpse(-71.2, 41.6, 'npc.national-guard', 3.1, true), corpse(-68, 49.6, 'npc.national-guard', 0.6, true),
  corpse(-21, 20.4, 'npc.national-guard', 5.5, true), corpse(8.2, -9.6, 'npc.national-guard', 2.4, true),
  corpse(-28, 4.5, 'npc.civilian-man-a', 1.2), corpse(-22.6, 1.8, 'npc.civilian-woman-b', 2.8), corpse(-25.4, -3.6, 'npc.civilian-man-b', 0.4), corpse(-30.2, -4.4, 'npc.civilian-woman-a', 3.9),
  corpse(-20.4, -5.8, 'npc.civilian-elderly', 5.2), corpse(-15.2, 6.2, 'npc.civilian-man-a', 1.7), corpse(-26.6, 9.2, 'npc.civilian-woman-b', 4.4), corpse(-12.6, 15.8, 'npc.civilian-man-b', 0.1),
  corpse(-5.6, 3.8, 'npc.civilian-woman-a', 2.1), corpse(1.4, -7.4, 'npc.civilian-man-a', 3.3), corpse(-34.6, 24.4, 'npc.civilian-man-b', 5.9), corpse(-44, 6, 'npc.civilian-woman-b', 0.8),
  corpse(-56.6, 6.4, 'npc.civilian-man-a', 2.3), corpse(-18, -36.6, 'npc.civilian-woman-a', 4.2), corpse(0.6, -41.6, 'npc.civilian-man-b', 1.5), corpse(24, -36.8, 'npc.civilian-elderly', 3.6),
  corpse(12.4, 6, 'npc.civilian-woman-b', 5.7), corpse(14.8, 36, 'npc.civilian-man-a', 0.2), corpse(-6, 45.2, 'npc.civilian-woman-a', 2.9), corpse(26, 44.2, 'npc.civilian-man-b', 4.6),
  corpse(48.6, 8, 'npc.civilian-man-a', 1.0), corpse(51.8, -20, 'npc.civilian-woman-b', 3.0), corpse(62.4, 29.6, 'npc.civilian-elderly', 5.0),
  ...([[-22, 7], [-14.4, -8], [-30, 0.4], [-8, 8.6], [6, 20], [16, -20], [-47, 2.4], [-16, 38], [34, -42], [58, 30.6]] as const).map(([x, z], i) => d('belongings', 'decay.dropped-belongings', x, z, { yaw: i * 1.9 })),
  ...([[-26.2, -11.4, 'wpn.assault-rifle'], [-24.6, 16, 'wpn.assault-rifle'], [-13.4, -2.6, 'wpn.assault-rifle'], [-31.6, 5.4, 'wpn.machine-gun'], [-9, 12.4, 'wpn.assault-rifle'], [7, -8.4, 'wpn.pistol'], [-20, 4, 'wpn.shotgun'], [-72, 44.8, 'wpn.assault-rifle']] as const)
    .map(([x, z, assetId], i) => d('weapon', assetId, x, z, { yaw: i * 2.1 })),
  // ---------------------------------------------------------------- signs of life (visible cues): the chalk sign and a flashlight + radio at the hiding places
  d('cue', 'decay.damaged-sign', -74.6, -45.6, { yaw: 3.0 }), d('cue', 'util.flashlight', -47.4, 43.3, { yaw: 1.3 }), d('cue', 'util.radio', -79.6, -45.2, { yaw: .4 }),
];

/** Collapsed facades: whole street fronts that are down, against four buildings (the shops without a `w5` shell take glass, fires and rubble instead). */
const collapses: readonly (readonly [number, number, number])[] = [
  [18.4, -25.9, 3.14], [18.4, 25.9, 3.14], [54.8, -8.5, 0], [-53.4, -15.5, -H], [-38.4, 10.2, 0],
];
/** Doors of the street-facing buildings and which face they are on (for the broken glass and the bullet damage). */
export function l5Frontages(layout: DistrictLayout): { x: number; z: number; axis: 'x' | 'z'; yaw: number; plaza: boolean; asset: string }[] {
  const doors = Object.entries(layout.anchors).filter(([n]) => n.startsWith('refuge-door-')).map(([, a]) => a.position);
  const bld = layout.placements.filter(p => p.assetId.startsWith('bld.') && p.assetId !== 'bld.metro-entrance' && p.assetId !== 'bld.kessler-hardware');
  const out: { x: number; z: number; axis: 'x' | 'z'; yaw: number; plaza: boolean; asset: string }[] = [];
  for (const door of doors) {
    let best: Placement | undefined, bestD = Infinity;
    for (const p of bld) { const dd = Math.hypot(p.position[0] - door[0], p.position[2] - door[2]); if (dd < bestD) { bestD = dd; best = p; } }
    if (!best || bestD > 12) continue;
    const dx = door[0] - best.position[0], dz = door[2] - best.position[2], axis = Math.abs(dx) > Math.abs(dz) ? 'x' : 'z';
    const sign = Math.sign(axis === 'x' ? dx : dz) || 1, shift = 1.3;
    const x = axis === 'x' ? door[0] - sign * shift : door[0], z = axis === 'z' ? door[2] - sign * shift : door[2];
    const plaza = x > -40 && x < 8 && z > -26 && z < 40;
    out.push({ x, z, axis, yaw: axis === 'x' ? H : 0, plaza, asset: best.assetId });
  }
  return out;
}

/**
 * L5 copy of the D-FAIR layout (E23 section 5.1): the same placements at the same transforms, every `w5` building in its devastated variant,
 * the W5 dressing, broken glass on every frontage, the power out. The army's L4 dressing is not here.
 */
export function levelFiveLayouts(layouts: DistrictLayout[]): DistrictLayout[] {
  return structuredClone(layouts).map(layout => {
    if (layout.district !== 'D-FAIR') return layout;
    moveFairhavenCellar(layout);
    const door = layout.anchors['kessler-cellar-door'], inner = layout.anchors['cellar-interior'];
    for (const [name, [x, z]] of Object.entries(l5Anchors)) layout.anchors[name] = { position: [x, 0, z], yaw: 0 };
    for (const name of ['pair-plaza', 'pair-harbor-street', 'pair-kessler-lane']) layout.anchors[name] = { position: [l4Anchors[name][0], 0, l4Anchors[name][1]], yaw: 0 };
    const metro = layout.anchors['metro-entrance'];
    const canopy = layout.placements.find(p => p.assetId === 'bld.metro-entrance');
    if (canopy) canopy.collisionId = 'l5.metro-ingress';
    if (canopy) layout.anchors['l5-metro-shutter'] = { position: [canopy.position[0], 1.2, canopy.position[2] + 2.43], yaw: 0 };
    if (metro) layout.anchors['pair-metro-entrance'] = { position: [metro.position[0], 0, metro.position[2]], yaw: 0 };
    if (door) layout.anchors['l5-cellar-door'] = { position: [...door.position], yaw: l4.cellar.outwardYaw };
    if (door) {
      const x = door.position[0] + Math.cos(l4.cellar.outwardYaw), z = door.position[2] - Math.sin(l4.cellar.outwardYaw);
      layout.anchors['l5-out'] = { position: [x, 0, z], yaw: l4.cellar.outwardYaw };
      layout.anchors['photo-l5-basement-exit'] = structuredClone(layout.anchors['l5-out']);
    }
    // The cellar yard (an island): the courier starts at the stair foot, the barred door is on the back wall (as in L4).
    if (inner) {
      const [cx, , cz] = inner.position;
      layout.anchors['l5-cellar-in'] = { position: [cx + .3, 0, cz - 1.4], yaw: 0 };
      // Lower shelf: board top .685 m minus the cellar placement's 0.3 m sink.
      layout.anchors['l5-shotgun'] = { position: [cx - 1.93, .385, cz + .55], yaw: H };
      layout.anchors['l5-brace'] = { position: [cx - .4, 0, cz + 2.6], yaw: 0 };
    }
    // The five hiding places: the ring where the courier stands and where the survivor steps out.
    for (const s of l5Survivors) {
      layout.anchors[`l5-ring-${s.key}`] = { position: [s.ringAt[0], 0, s.ringAt[1]], yaw: 0 };
      layout.anchors[`l5-hide-${s.key}`] = { position: [s.hideAt[0], 0, s.hideAt[1]], yaw: 0 };
      layout.anchors[`l5-out-${s.key}`] = { position: [s.outAt[0], 0, s.outAt[1]], yaw: 0 };
    }
    // The same buildings, devastated: every placement with a reviewed `w5` variant.
    for (const p of layout.placements) if (l5ShellAssets.includes(p.assetId)) p.decay = 'w5';
    const obstacles = obstaclesOf(layout, 5);
    const add = (id: string, assetId: string, x: number, z: number, yaw = 0, scale = 1, decay?: string, fixed = false) => {
      const decal = /^decal\.|decay\.broken-glass/.test(assetId);
      const p: Placement = { id, assetId, position: [x, decal ? .06 : 0, z], yaw, scale: [scale, scale, scale], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: /^util\./.test(assetId) ? 'l5-cue' : 'l5', visualAabb: { min: [x - 1, 0, z - 1], max: [x + 1, 1.5, z + 1] } };
      if (decay) p.decay = decay;
      if (!decal && !fixed && assetId.startsWith('veh.') && footprints(p, 0, true).length) {
        const spot = findClearSpot(layout, p, obstacles, { slide: true, margin: .1, maxRadius: 5 });
        if (spot) { p.position = [spot[0], 0, spot[1]]; p.visualAabb = { min: [spot[0] - 1, 0, spot[1] - 1], max: [spot[0] + 1, 1.5, spot[1] + 1] }; }
      }
      if (!decal && footprints(p, 0, true).length) obstacles.push(...footprints(p, 0, true));
      layout.placements.push(p);
    };
    for (const [i, e] of l5Dressing.entries()) if (!e.entity) add(`l5-${e.kind}-${i}`, e.assetId, e.x, e.z, e.yaw ?? 0, e.scale ?? 1, e.decay, e.fixed);
    for (const [i, c] of collapses.entries()) add(`l5-collapse-${i}`, 'decay.collapsed-facade', c[0], c[1], c[2], 1, undefined, true);
    const fronts = l5Frontages(layout);
    // Bullet damage: the `w5` shells carry their own impacts (`bulletImpact` nodes); the three shop types without a `w5` shell take the burned facade overlay.
    for (const [i, f] of fronts.entries()) add(`l5-glass-${i}`, 'decay.broken-glass', f.x, f.z, f.yaw);
    // Power is out everywhere (W5): no street lamp, shop or window is lit; only the cues (a flashlight, the radio) and the fires give light.
    layout.lightGroups.push({ id: 'l5', offAt: 5 }, { id: 'l5-cue', offAt: 5 });
    const w5 = layout.layers.find(l => l.tier === 5);
    if (w5) w5.disableLights.push(...layout.lightGroups.map(g => g.id).filter(id => id !== 'l5-cue'));
    // Reuse the cutaway concourse already shipped for L6, north of the street.
    // Its platform is visible from the entrance before the campaign cut.
    const station = structuredClone(subwayLayout.placements[0]) as Placement;
    station.id = 'l5-station'; station.position = [l5.metro.stationX, -.45, l5.metro.stationZ]; station.lightGroup = 'l5-cue';
    station.visualAabb = { min: [station.position[0] - 30, -.45, station.position[2] - 18], max: [station.position[0] + 30, 5.3, station.position[2] + 26] };
    layout.placements.push(station);
    for (const c of subwayLayout.colliders.filter(c => c.id.startsWith('l6-0/'))) {
      layout.colliders.push({ ...c, minTier: 0, maxTier: 5, id: c.id.replace('l6-0/', 'l5-station/'), aabb: { min: [c.aabb.min[0] + station.position[0], c.aabb.min[1] - .45, c.aabb.min[2] + station.position[2]], max: [c.aabb.max[0] + station.position[0], c.aabb.max[1] - .45, c.aabb.max[2] + station.position[2]] } });
    }
    moveOffSolids(layout, p => freestanding(p) || p.assetId === 'decay.fuel-truck-crater');
    return layout;
  });
}
