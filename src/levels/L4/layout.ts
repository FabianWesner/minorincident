import { moveFairhavenCellar } from '../fairhavenCellar';
import { freestanding, moveOffSolids } from '../placementClearance';
import { l4, l4Anchors, l4CollapseGroups, l4Edges, l4Line } from '../../data/l4';
import type { DistrictLayout, Placement } from '../districts/types';

/** Kinds of the W0 "clean, intact, alive" dressing and the army's orderly reception (E22 section 5.2); counted by the static AC05 test. */
export type L4DressingKind = 'reception' | 'sandbag' | 'nest' | 'light' | 'barrier' | 'parked' | 'water';
export interface L4Dressing { kind: L4DressingKind; assetId: string; x: number; z: number; yaw?: number; scale?: number; lit?: boolean }
const H = Math.PI / 2, PI = Math.PI;
const d = (kind: L4DressingKind, assetId: string, x: number, z: number, more: Partial<L4Dressing> = {}): L4Dressing => ({ kind, assetId, x, z, ...more });

/** Static L4 dressing manifest (clean, intact: no wrecks, damage decals or corpses before the first turn). */
export const l4Dressing: readonly L4Dressing[] = [
  // ---------------------------------------------------------------- the army reception (registration, triage, quartermaster, water)
  d('reception', 'kit.reception-plaza', -26.0, -8.8, { yaw: 0 }),
  d('reception', 'prop.armory-table', -25.2, 0.6, { yaw: H }),
  // PO #41: the first tent stands flush against the west pallet run (it was a 0.7 m gap, exactly a courier wide), so the dead-end alley down to the light tower is gone and nobody can wedge in it.
  d('reception', 'prop.tent', -30.8, 12.6, { yaw: H }), d('reception', 'prop.tent', -26.8, 12.6, { yaw: H }), d('reception', 'prop.tent', -22.8, 12.6, { yaw: H }),
  d('water', 'prop.crates', -30.6, 3.4, { yaw: .2 }), d('water', 'prop.crates', -30.6, 4.7, { yaw: -.1 }), d('water', 'prop.crates', -29.2, 3.6, { yaw: .1 }), d('water', 'prop.crates', -20.8, 3.4, { yaw: 0 }),
  d('light', 'prop.light-tower', -31.2, 15.4, { yaw: 0 }), d('light', 'prop.light-tower', -16.6, -12.2, { yaw: PI }),
  // ---------------------------------------------------------------- the sandbag line (north, west and south runs; the east side is the convoy)
  ...l4Line.map(p => d('sandbag', 'prop.sandbag-pallet', p.x, p.z, { yaw: p.yaw === 0 ? 0 : H })),
  d('nest', 'prop.hmg-nest', l4Anchors['l4-hmg-1'][0], l4Anchors['l4-hmg-1'][1], { yaw: PI + .8 }),
  d('nest', 'prop.hmg-nest', l4Anchors['l4-hmg-2'][0], l4Anchors['l4-hmg-2'][1], { yaw: -.6 }),
  // ---------------------------------------------------------------- the army gate (Lakeshore, west end): shoulder barriers, nests and light towers around an open 6 m lane
  ...([-78.5, -75.5, -72.5, -69.5] as const).flatMap(x => [d('barrier', 'prop.jersey-barrier', x, 42.1, { yaw: 0 }), d('barrier', 'prop.jersey-barrier', x, 50.9, { yaw: 0 })]),
  d('sandbag', 'prop.sandbag-pallet', -67.2, 40.8, { yaw: 0 }), d('sandbag', 'prop.sandbag-pallet', -65.8, 40.8, { yaw: 0 }), d('sandbag', 'prop.sandbag-pallet', -67.2, 52.3, { yaw: 0 }), d('sandbag', 'prop.sandbag-pallet', -65.8, 52.3, { yaw: 0 }),
  d('light', 'prop.light-tower', -73.2, 40.6, { yaw: 0 }), d('light', 'prop.light-tower', -73.2, 52.4, { yaw: PI }),
  // ---------------------------------------------------------------- army barriers at the street ends (a gap stays open): traffic is held by soldiers
  ...([[-81.2, -43.4, H], [-81.2, -42.1, H], [-81.2, -36.6, H], [-81.2, -35.2, H]] as const).map(([x, z, yaw]) => d('barrier', 'prop.jersey-barrier', x, z, { yaw })),
  ...([[81.2, -43.4, H], [81.2, -42.1, H], [81.2, -36.6, H], [81.2, -35.2, H], [81.2, 42.2, H], [81.2, 43.5, H], [81.2, 49.0, H], [81.2, 50.3, H]] as const).map(([x, z, yaw]) => d('barrier', 'prop.jersey-barrier', x, z, { yaw })),
  // Keep the relocated Harbor Street cellar doorway clear of the street-end pallet.
  d('sandbag', 'prop.sandbag-pallet', 79.4, -44.4, { yaw: H }), d('sandbag', 'prop.sandbag-pallet', -79.4, -36.8, { yaw: H }),
  // ---------------------------------------------------------------- Fairhaven's own cars, parked in the lanes the convoy does not use (traffic held by soldiers)
  // (the six that the war sets alight are real vehicles spawned by the controller: l4Cars)
  ...([[-40, 43.3, 'veh.sedan-blue', 0], [24, 43.3, 'veh.sedan-white', .02], [44, 43.3, 'veh.sedan-green', 0],
    [-46, -42.6, 'veh.sedan-red', PI], [-8, -42.6, 'veh.suv-green', PI], [40, -42.6, 'veh.sedan-white', PI],
    [-59.7, -8, 'veh.sedan-green', H], [15.8, 30, 'veh.suv-dark', H],
    [51.8, -22, 'veh.sedan-white', H], [51.8, 5, 'veh.sedan-blue', -H]] as const).map(([x, z, assetId, yaw]) => d('parked', assetId, x, z, { yaw })),
];

/**
 * The Alphas (PO 10-13: "add more alphas. The current one has zero chance."), in spawn order: when (seconds after the turn), from which
 * street mouth or door (`at`, or an `l4Edges` id), and their job (src/sim/missions/L4Collapse.ts): `line` goes for the standing soldiers of
 * the line that holds now, `west` / `north` / `south` charge through that authored E26 slot first (the north and south ones wait for the
 * gun-nest beat), `armor` waits for the armour beat. `high`: high tier only (the low tier has six). No actor is spawned by the layout.
 */
export const l4AlphaEmergence: readonly { anchor: string; edgeId?: string; at?: readonly [number, number]; job: 'line' | 'west' | 'north' | 'south' | 'armor'; afterTurnS: number; high?: boolean }[] = [
  // Line 1: one Alpha through the west slot; the next (high tier) goes for the line that holds after the first break.
  { anchor: 'l4-alpha-west-slot', at: [-46, 21], job: 'west', afterTurnS: 32 },
  { anchor: 'l4-alpha-nw', edgeId: 'nw-alley', job: 'line', afterTurnS: 56, high: true },
  // The two gun-nest Alphas (south-east, north), staggered, then two more at the nests line (the first of them high tier only).
  { anchor: 'l4-alpha-south', edgeId: 'south-east', job: 'south', afterTurnS: 84 },
  { anchor: 'l4-alpha-north', edgeId: 'north', job: 'north', afterTurnS: 92 },
  { anchor: 'l4-alpha-east', edgeId: 'east', job: 'line', afterTurnS: 100, high: true },
  { anchor: 'l4-alpha-sw', edgeId: 'south-west', job: 'line', afterTurnS: 120 },
  // The armour beat: from the west and out of the shop door north-east of the plaza.
  { anchor: 'l4-alpha-west', edgeId: 'west', job: 'armor', afterTurnS: 138 },
  { anchor: 'l4-alpha-ne', at: [.9, -23.3], job: 'armor', afterTurnS: 148 },
];

/**
 * Three existing pallets with clear ground on both sides. Systems resolve the named endpoints into E26 slots and own HP,
 * blockers and broken visuals; placementId identifies the intact static pallet they replace (never leave both blockers).
 * Indices address the existing north, west and south l4Line runs, preserving the reception and convoy dressing.
 */
export const l4BreakableLine = ([['north', 6], ['west', 13], ['south', 20]] as const).map(([side, index]) => {
  const pallet = l4Line[index];
  const dressingIndex = l4Dressing.findIndex(d => d.kind === 'sandbag' && d.x === pallet.x && d.z === pallet.z);
  const id = `l4-line-${side}`;
  return { id, lineIndex: index, placementId: `l4-sandbag-${dressingIndex}`, emergenceAnchor: `l4-alpha-${side}`,
    anchors: { center: `${id}-center`, a: `${id}-a`, b: `${id}-b`, inside: `${id}-inside`, outside: `${id}-outside` } };
});

/**
 * L4 copy of the D-FAIR layout: authored L4 anchors (the cellar anchors come from the layout's own cellar and door placements)
 * and the clean army/city dressing. Feeds collision, navigation and rendering alike (the same pattern as the L2/L3 layout copies).
 */
export function levelFourLayouts(layouts: DistrictLayout[]): DistrictLayout[] {
  return structuredClone(layouts).map(layout => {
    if (layout.district !== 'D-FAIR') return layout;
    moveFairhavenCellar(layout);
    const door = layout.anchors['kessler-cellar-door'], inner = layout.anchors['cellar-interior'];
    for (const [name, [x, z]] of Object.entries(l4Anchors)) layout.anchors[name] = { position: [x, 0, z], yaw: 0 };
    for (const [i, [x, z]] of l4CollapseGroups.entries()) layout.anchors[`l4-street-edge-${i}`] = { position: [x, 0, z], yaw: 0 };
    for (const entry of l4AlphaEmergence) {
      const [x, z] = entry.at ?? l4Edges.find(e => e.id === entry.edgeId)!.at;
      layout.anchors[entry.anchor] = { position: [x, 0, z], yaw: -Math.atan2(l4.map.centre.z - z, l4.map.centre.x - x) };
    }
    for (const line of l4BreakableLine) {
      const p = l4Line[line.lineIndex], yaw = p.yaw === 0 ? 0 : H;
      const inward = p.yaw === 0 ? [0, p.z < 0 ? 1 : -1] : [1, 0];
      const set = (name: string, dx = 0, dz = 0) => { layout.anchors[name] = { position: [p.x + dx, 0, p.z + dz], yaw }; };
      set(line.anchors.center);
      // The existing pallet is 1.4 m along local X; the approach anchors clear its 1.19 m depth plus character radius.
      set(line.anchors.a, -.7 * Math.cos(yaw), .7 * Math.sin(yaw));
      set(line.anchors.b, .7 * Math.cos(yaw), -.7 * Math.sin(yaw));
      set(line.anchors.inside, 2.4 * inward[0], 2.4 * inward[1]);
      set(line.anchors.outside, -2.4 * inward[0], -2.4 * inward[1]);
    }
    const metro = layout.anchors['metro-entrance'];
    if (metro) for (const name of ['photo-l4-metro-entrance-safe', 'pair-metro-entrance']) layout.anchors[name] = { position: [metro.position[0], 0, metro.position[2]], yaw: 0 };
    if (door) layout.anchors['l4-cellar-door'] = { position: [...door.position], yaw: l4.cellar.outwardYaw };
    // The cellar yard: the player arrives at the stair foot, the brace socket is on the back wall (model local (-3.1, -0.4), yaw pi/2).
    if (inner) {
      const [cx, , cz] = inner.position;
      layout.anchors['l4-cellar-in'] = { position: [cx + .3, 0, cz - 2.4], yaw: 0 };
      layout.anchors['l4-brace'] = { position: [cx - .4, 0, cz + 2.6], yaw: 0 };
    }
    const add = (id: string, assetId: string, x: number, z: number, yaw = 0, scale = 1) => {
      const p: Placement = { id, assetId, position: [x, 0, z], yaw, scale: [scale, scale, scale], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: 'l4', visualAabb: { min: [x - 1, 0, z - 1], max: [x + 1, 1.5, z + 1] } };
      layout.placements.push(p);
    };
    for (const [i, e] of l4Dressing.entries()) add(`l4-${e.kind}-${i}`, e.assetId, e.x, e.z, e.yaw ?? 0, e.scale ?? 1);
    // The convoy parks along x = -11: the planter (and its flowers) that D-FAIR puts at (-10, -19) sat in the APC's lane.
    layout.colliders = layout.colliders.filter(c => c.id !== 'dressing:planter:22');
    layout.decorations = layout.decorations?.filter(f => Math.hypot(f.position[0] + 10, f.position[2] + 19) > 1);
    layout.lightGroups.push({ id: 'l4', offAt: 5 });
    moveOffSolids(layout, freestanding);
    return layout;
  });
}
