/**
 * Level 4 "The Safe City Falls" tuning table (specs/epic-22-level-4-the-safe-city-falls.md, sections 4 and 5). Data only.
 * Coordinates are world metres on D-FAIR (layouts/D-FAIR/layout.py; origin at the map centre, X east, Z south). The convoy enters
 * from the army gate at the west end of Lakeshore Avenue, tours the clean city and parks in the Reception Plaza; the war is
 * fought on the plaza and the streets around it; the player runs east to Kessler's Hardware and its cellar. Times in seconds,
 * speeds in m/s. Every number is read by the L4 controller, bots and tests.
 */
type P = readonly [number, number];
export type L4Weapon = 'pistol' | 'hunting-rifle' | 'pipe' | 'bat' | 'crowbar';

export const l4 = {
  map: {
    /** The open plaza square, the ring inside the sandbag line (the "inside" of the line-break rule) and the street edges. */
    plaza: { x0: -36, x1: 2, z0: -22, z1: 35.5 },
    ring: { x0: -33, x1: -12, z0: -14, z1: 17 },
    /** Gameplay centre of the plaza (camera, helicopter orbit, "where the war is"). */
    centre: { x: -17, z: 3 },
  },
  /** Beat 1: the five-vehicle convoy (head first), kinematic along the Lakeshore - Church Road - Harbor - Plaza Way route. */
  convoy: {
    speedMs: 13.5, accelMs2: 3.6, brakeMs2: 4.5, lateralMs2: 13, gapM: 3, leftRadiusM: 7, rightRadiusM: 3.6, laneM: 1.75, laneNsM: 1.25,
    /** `len` is the hull length (manifest), `player` the bus the courier rides in (last in line, so she passes the gate first). */
    vehicles: [
      { id: 'apc', asset: 'veh.military-apc', len: 5.69, wid: 2.95 },
      { id: 'truck-1', asset: 'veh.military-truck', len: 6.93, wid: 2.9 },
      { id: 'bus-2', asset: 'veh.evac-bus', len: 9.36, wid: 2.96 },
      { id: 'truck-2', asset: 'veh.military-truck', len: 6.93, wid: 2.9 },
      { id: 'bus-1', asset: 'veh.evac-bus', len: 9.36, wid: 2.96, player: true },
    ] as readonly { id: string; asset: string; len: number; wid: number; player?: boolean }[],
    /** The ride must take 20-35 s for the courier's bus (E22-AC04). */
    rideS: [20, 35] as P,
    /** Control returns this long after the bus stops (<= 0.5 s, AC04). */
    controlS: .3,
  },
  /** Beat 2: free walk, the quartermaster issues the machine gun. */
  calm: {
    /** Civilians already in the city before the convoy arrives, and the evacuees who step off the buses. */
    residents: { high: 40, low: 20 }, evacuees: { high: 8, low: 4 }, turners: 2,
    soldiers: { high: 20, low: 10 },
    /** Radio line (loudspeaker) once the convoy has stopped, and the quartermaster's interact time. */
    welcomeAtS: 1.5, issueS: .6,
  },
  /** The machine gun (E06 section 5.3 campaign values): 14 per round, 10 rounds/s, 4 degrees, 26 m, pierce 1, no ammunition. */
  machineGun: { id: 'weapon.army-mg', damage: 14, fireRate: 10, spreadDeg: 4, rangeM: 26, pierce: 1 },
  /** Beat 3: the first turn fires 40-50 s after the gun is issued (seeded), at the latest this long after the arrival. */
  turn: { afterGunS: [40, 50] as P, latestAfterArrivalS: 100 },
  /** Beat 4: the outbreak follows the convoy. From turn + `fromS` infected come from the street edges, escalating. */
  war: {
    fromS: 0, waveEveryS: 11,
    /** Infected per wave per street edge, the first waves small. */
    waveSize: [6, 9, 12, 14, 14, 14, 14, 14, 14, 14] as readonly number[], edgesPerWave: 3,
    /** Seconds the streets keep emerging after the line break (collapse). */
    collapseWaveEveryS: 9, collapseWaveSize: 3, collapseCapInfected: 80,
    caps: { infected: { high: 120, low: 60 }, characters: { high: 190, low: 95 } },
    /** Infected hit like L3's (the PO found earlier levels too hard: a sensible player finishes with few deaths). */
    infectedDamage: 1.5,
    emergeLeashM: 26,
  },
  /**
   * The base alarm at the first turn (PO 2026-10-12: "when contact starts, play an alarm sound (typical for military)"): a rising and falling klaxon
   * from the camp loudspeakers (positional, at the light towers and the reception) plus a quiet non-positional bed so it is always audible.
   * Full level for `holdS`, then it fades out over `fadeS` under the fight music (total 20-40 s). Synthesised in src/audio/synthesis.ts.
   */
  /** The in-bus radio (PO 2026-10-12): low, muffled, from the bus until the alarm; `scoreTrim` lowers the adaptive score while it plays. */
  radio: { gain: .2, cabHz: 3000, openHz: 1600, rangeM: 30, fadeS: 2.5, scoreTrim: .3 },
  alarm: { holdS: 24, fadeS: 8, periodS: 6, lowHz: 420, highHz: 640, speakerGain: 1.1, bedGain: .22, speakers: [[-31.2, 15.4], [-16.6, -12.2], [-26, -8.8]] as readonly P[] },
  /** First Alphas use the district street mouths on both quality tiers, inside the ordinary caps. */
  alphas: { count: { high: 3, low: 2 }, afterTurnS: [10, 22, 34] as readonly number[], lineHp: 300 },
  /** Section 5.6: the line breaks at the first of these. */
  lineBreak: { defenseS: 75, soldiersLeft: .5, inside: 15, mockupLatestS: 120 },
  /** Section 5.4: allied fighters v3. */
  soldiers: {
    hp: 120,
    rifle: { damage: 18, shotS: .4, rangeM: 26, nearM: 20, hitNear: .65, hitFar: .35 },
    hmg: { damage: 30, shotS: .16, rangeM: 40, nearM: 30, hitNear: .7, hitFar: .4 },
    /** Engagement radius around the post: the line holds ground. */
    postRangeM: 24, hmgRangeM: 36, moveMs: 3.8,
  },
  civilians: {
    hp: 80, armedShare: .4, panicInfected: 3, panicRadiusM: 4, panicS: 6,
    pistol: { damage: 20, shotS: .7, rangeM: 18, nearM: 12, hitNear: .5, hitFar: .25 },
    rifle: { damage: 60, shotS: .6 / 1, rangeM: 32, nearM: 24, hitNear: .6, hitFar: .4 },
    /** Improvised melee (bat, pipe, crowbar): the firefighter swing with these numbers. */
    melee: { damage: 24, reachM: 1.9, swingS: .8 },
  },
  /** Section 5.5: military spectacle (sim-light, view-heavy). */
  tank: {
    /** Enters at turn + enterAfterS from the army gate along Lakeshore, then north through the lake garden gap. */
    enterAfterS: 22, speedMs: 3.6, fireEveryS: [8, 12] as P, minDistM: 15, shellId: 'explosion.tank-shell', turnRate: 2.2,
    path: [[-70, 43.9], [-26, 43.9], [-20, 37.9], [-20, 22]] as readonly P[],
  },
  heli: { alt: 17, orbitR: 30, omega: .26, centre: [-14, 4] as P, burstEveryS: [2.2, 3.6] as P, burst: { shots: 5, shotS: .09, damage: 22, hit: .6, rangeM: 60 }, startR: 95, arriveS: 7, withdrawS: 7 },
  /** Fuel truck at the plaza edge (Plaza Way, by the convoy gap): the tank shell sets it off at the line break (mega chain). */
  fuelTruck: { x: 8, z: -9.5, yaw: Math.PI / 2, blast: 'explosion.fuel-truck' },
  /** Beat 5-6: live damage and the collapse (soft marker for the hiding place after `markerAfterS`). */
  collapse: {
    markerAfterS: 15, fires: 4, burningCars: 3, pendingPerTick: 3,
    /** Soldiers pockets along both routes fight turned soldiers and infected (sim-light). */
    pockets: 2,
  },
  /** Beat 7: the cellar. After the door is barred the battle goes on above for at least this long. */
  cellar: { interactS: .6, barS: 1.0, battleAfterBarredS: 7 },
  medkits: { heal: 40, positions: [
    [-30.5, -2], [-22, 15], [-16, -11], [-26, 24], [-40.5, 8],                         // plaza ring and west
    [-56, 18], [-44, -37.5], [-4, -37.2], [30, -37.2], [52.5, -2], [60, 22], [58, 43],   // both routes to Kessler Lane
    [38, 43.2], [18, 43.2], [-6, 43.4],
  ] as readonly P[] },
  checkpoints: ['arrival', 'turn', 'line-break'] as const,
  /** Bots (section 8). Bands are provisional until the first green run (staging decision section 6). */
  bots: { seeds: 20, completeMedianS: [150, 330] as P, newbieMedianS: [165, 360] as P, newbieMinSeeds: 18, newbieMaxMedianDeaths: 2 },
} as const;

/** Convoy parking: the column ends along the plaza at x = -11, head (APC) in the north. See `l4Route`. */
export const l4Convoy = { endX: -11 } as const;

/** Named world points authored into the L4 layout copy (resolved through the ordinary mission anchor lookup). */
export const l4Anchors: Record<string, P> = {
  'l4-start': [-84, 47.9],
  'l4-quartermaster': [-23.2, 0.6],
  'l4-qm-npc': [-26.6, 0.6],
  'l4-registration': [-26, -8],
  'l4-plaza': [-17, 3],
  'l4-cellar-door': [0, 0],            // replaced by the layout's kessler-cellar-door at load (see levelFourLayouts)
  'l4-brace': [0, 0],                  // replaced from the cellar placement
  'l4-fuel': [8, -9.5],
  'l4-hmg-1': [-32.4, -14.1], 'l4-hmg-2': [-14.6, 17.3],
  'l4-tank-stop': [-20, 22],
  'photo-l4-convoy-arrival': [-6, 3], 'photo-l4-plaza-safe': [-20, 4], 'photo-l4-harbor-street-safe': [-12, -38], 'photo-l4-metro-entrance-safe': [57, -42],
  'photo-l4-first-turn': [-26, -4], 'photo-l4-war-line': [-22, 4], 'photo-l4-tank': [-18, 22], 'photo-l4-collapse': [4, -6], 'photo-l4-basement': [75, -4],
  'pair-plaza': [-17, 3], 'pair-harbor-street': [-10, -39], 'pair-metro-entrance': [57, -41], 'pair-kessler-lane': [68, 28.6],
};
/** Sandbag runs of the line (centre, yaw degrees, count along the run): north, west and south, each with a 3 m gap in the middle. */
export const l4Line: readonly { x: number; z: number; yaw: number }[] = (() => {
  const out: { x: number; z: number; yaw: number }[] = [];
  const run = (x0: number, z0: number, x1: number, z1: number, yaw: number, gap: [number, number]) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 1.45);
    for (let i = 0; i < n; i++) { const t = (i + .5) / n, d = t * len; if (d > gap[0] && d < gap[1]) continue; out.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, yaw }); }
  };
  run(-31, -14.4, -15, -14.4, 0, [7, 10]);        // north run (long axis along x)
  run(-33.4, -12, -33.4, -9.2, 90, [99, 99]);     // west run north of the church steps (long axis along z)
  run(-33.4, 3.4, -33.4, 15, 90, [4.5, 7.5]);     // ...and south of them, with a 3 m gap
  run(-31, 17.8, -15, 17.8, 0, [7, 10]);          // south run
  return out;
})();
/** Soldier posts (hold positions with the direction they face), in the order the controller spawns them. */
export const l4Posts: readonly { name: string; at: P; face: P; role: 'qm' | 'line' | 'hmg' | 'truck' | 'gate' }[] = [
  { name: 'qm', at: [-26.6, 0.6], face: [-18, 0.6], role: 'qm' },
  { name: 'n1', at: [-27, -15.8], face: [-27, -30], role: 'line' }, { name: 'n2', at: [-22, -15.8], face: [-22, -30], role: 'line' }, { name: 'n3', at: [-17, -15.8], face: [-17, -30], role: 'line' },
  { name: 'w1', at: [-31.8, -10.6], face: [-50, -10.6], role: 'line' }, { name: 'w2', at: [-33.6, -3], face: [-50, -3], role: 'line' }, { name: 'w3', at: [-31.8, 9.4], face: [-50, 9.4], role: 'line' },
  { name: 's1', at: [-27, 19.4], face: [-27, 34], role: 'line' }, { name: 's2', at: [-22, 19.4], face: [-22, 34], role: 'line' }, { name: 's3', at: [-17, 19.4], face: [-17, 34], role: 'line' },
  { name: 'hmg-1', at: [-32.4, -14.1], face: [-40, -26], role: 'hmg' }, { name: 'hmg-2', at: [-14.6, 17.3], face: [-4, 30], role: 'hmg' },
  { name: 'e1', at: [-8.6, -12], face: [4, -12], role: 'truck' }, { name: 'e2', at: [-8.6, 12], face: [4, 12], role: 'truck' },
  { name: 'g1', at: [-71, 42.6], face: [-71, 30], role: 'gate' }, { name: 'g2', at: [-71, 49.4], face: [-71, 58], role: 'gate' }, { name: 'g3', at: [-67.5, 44.5], face: [-50, 44], role: 'gate' },
  { name: 't1', at: [-8, 24], face: [4, 30], role: 'truck' }, { name: 't2', at: [-6.5, -16], face: [-10, -34], role: 'truck' }, { name: 'e3', at: [-12, 2.2], face: [4, 4], role: 'truck' },
];
/** Registration tables of the reception kit and the places the residents and evacuees queue, chat and sit. */
export const l4Crowd = {
  /** One line along the front of the reception kit's registration tables (people face north, to the tables). */
  queue: { line1: [-31.4, -29.9, -28.4, -26.9, -25.4, -23.9, -22.4, -20.9].map(x => [x, -3.2] as P), line2: [] as P[], table: [-25.5, -6.6] as P },
  chats: [[-27, 8], [-20, 8], [-30, 24], [-4, 24], [-28, -17.5], [-16, 28]] as readonly P[],
  benches: [[-32.8, 18], [-32.8, 10], [-26, 33.8], [-4, 33.8], [-14, -19.5], [-8, -19.5]] as readonly P[],
  /** Sidewalk beats (start, end) of the strollers, kept clear of the convoy lanes. */
  walks: [
    [[-52, -35.2], [-18, -35.2]], [[-14, -35.2], [8, -35.2]], [[18, -35.2], [46, -35.2]], [[54, -35.2], [80, -35.2]],
    [[-52, 41.2], [-20, 41.2]], [[-12, 41.2], [10, 41.2]], [[18, 41.2], [44, 41.2]], [[54, 41.2], [80, 41.2]],
    [[-54.4, -30], [-54.4, 36]], [[10.2, -30], [10.2, 36]], [[46.6, -30], [46.6, 36]],
    [[-70, 54], [-30, 54]], [[-24, 54], [20, 54]], [[26, 54], [78, 54]],
  ] as readonly (readonly [P, P])[],
} as const;
/**
 * Street-edge emergence points of the outbreak (always out of view when used), six around the plaza at the mouths of the streets and
 * alleys 25-45 m from the sandbag line (at least three of them >= 60 degrees apart): the army gate side (west), the NW alley, Harbor
 * Street (north), Plaza Way (east), and the two lake-garden gaps (south). `metro` is the last, used for the collapse on the Metro Road route.
 */
export const l4Edges: readonly { id: string; at: P }[] = [
  { id: 'west', at: [-56.6, 6] }, { id: 'nw-alley', at: [-39.2, -35] }, { id: 'north', at: [-18, -38.4] }, { id: 'east', at: [13.4, -3] },
  { id: 'south-east', at: [-5.5, 42.6] }, { id: 'south-west', at: [-23, 42.6] }, { id: 'metro', at: [50.5, -37.4] },
];
/** Fairhaven's own parked cars that are real vehicles (E09): the war sets some of them alight (never drivable: the courier is on foot in L4). */
export const l4Cars: readonly { at: P; yaw: number; def: string }[] = [
  { at: [-30, 43.3], yaw: 0, def: 'vehicle.sedan' }, { at: [-6, 43.3], yaw: 0, def: 'vehicle.suv' }, { at: [-38, -42.6], yaw: Math.PI, def: 'vehicle.pickup' },
  { at: [30, -42.6], yaw: Math.PI, def: 'vehicle.sedan' }, { at: [15.8, 14], yaw: -Math.PI / 2, def: 'vehicle.suv' }, { at: [-59.7, 20], yaw: -Math.PI / 2, def: 'vehicle.pickup' },
];
/** Shop frontages whose glass the shockwaves of the line break shatter (live damage): x, z, yaw of the broken-glass decal at the kerb. */
export const l4Glass: readonly (readonly [number, number, number])[] = [
  [3.4, -17.5, Math.PI / 2], [3.4, -9, Math.PI / 2], [3.4, -1.2, Math.PI / 2], [3.4, 18.75, Math.PI / 2], [3.4, 33.5, Math.PI / 2],
  [17.6, -25.9, Math.PI / 2], [17.6, -8.5, Math.PI / 2], [17.6, 8.6, Math.PI / 2], [17.6, 25.9, Math.PI / 2],
  [-3, -44.8, 0], [12, -44.8, 0], [28, -44.8, 0], [-12, 39.2, 0], [-44, 39.2, 0], [26, 39.2, 0], [-30, -22.6, 0],
];
/** The collapse: groups of infected waiting out of view along both routes to Kessler Lane (x, z, size), emerging from the nearest doors. */
export const l4CollapseGroups: readonly (readonly [number, number, number])[] = [
  [-46, -37.4, 3], [-24, -37.4, 4], [-4, -37.4, 4], [18, -37.4, 4], [38, -37.4, 3], [50, -22, 4], [50, -6, 4], [50, 12, 3],
  [-46, 44, 3], [-20, 44, 4], [4, 44, 4], [26, 44, 3], [45, 44, 4], [58, 44, 3], [62, 28.6, 3],
];
/** Soldier pockets of the collapse (hold, engaged) with the infected that rush them, along the two routes. */
export const l4Pockets: readonly { at: P[]; foes: P }[] = [
  { at: [[24, -36.8], [26.4, -37.6], [28.8, -36.6]], foes: [8, -38] },
  { at: [[40, 42.8], [42.6, 43.8], [38.4, 44.4]], foes: [22, 44] },
];
/** Photo spots (section 6): name and camera offset, same framing scale as the L2/L3 spots. */
export const l4PhotoSpots: readonly (readonly [string, readonly [number, number, number]])[] = [
  ['l4-convoy-arrival', [18, 22, 18]], ['l4-plaza-safe', [20, 24, 20]], ['l4-harbor-street-safe', [16, 19, 16]], ['l4-metro-entrance-safe', [14, 17, 14]],
  ['l4-first-turn', [14, 17, 14]], ['l4-war-line', [22, 26, 22]], ['l4-tank', [20, 24, 20]], ['l4-collapse', [-26, 28, 26]], ['l4-basement', [9, 11, 9]],
  // E23: Harbor Street and Kessler Lane are seen from where the rooflines do not hide them (down the street from the west; from the north-west over the lane).
  // The shared W0/W5 plaza overview includes the surrounding burning blocks:
  // the old tight pose framed only one of L5's thirteen smoke-column tops.
  ['pair-plaza', [50, 40, 50]], ['pair-harbor-street', [-22, 13, 4]], ['pair-metro-entrance', [14, 17, 14]], ['pair-kessler-lane', [-14, 17, -14]],
];

// ------------------------------------------------------------------------------------------------ the convoy route
export interface RoutePoint { x: number; z: number; yaw: number; s: number; /** Speed limit of the corner this point is on (Infinity on straights). */ limit: number }
/**
 * The convoy centre line (right-hand lanes), arc-length parametrised: Lakeshore eastbound from the gate, Church Road north,
 * Harbor Street east, Plaza Way south, west through the plaza gap, then north along x = `l4Convoy.endX`. The first corner is a wide left
 * turn, the others tight right turns that stay inside the intersections (their inside corners are building corners). Corner speeds follow
 * the lateral acceleration limit. Pure data (no sim): the controller, the Scene Lab and the tests share it.
 */
export function l4Route(): { pts: RoutePoint[]; length: number } {
  const c = l4.convoy, RL = c.leftRadiusM, RR = c.rightRadiusM, ew = c.laneM, ns = c.laneNsM;
  const zL = 46 + ew, xC = -58 + ns, zH = -40 + ew, xP = 14 - ns, zG = 5.7, xE = l4Convoy.endX;
  const pts: RoutePoint[] = []; let s = 0;
  const push = (x: number, z: number, limit = Infinity) => {
    const last = pts[pts.length - 1];
    if (last) { const d = Math.hypot(x - last.x, z - last.z); if (d < 1e-6) return; s += d; last.yaw = -Math.atan2(z - last.z, x - last.x); }
    pts.push({ x, z, yaw: last ? last.yaw : 0, s, limit });
  };
  const line = (x0: number, z0: number, x1: number, z1: number) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 2)); for (let i = 0; i <= n; i++) push(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n); };
  const arc = (cx: number, cz: number, R: number, a0: number, a1: number) => { const n = 12, limit = Math.sqrt(c.lateralMs2 * R); for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; push(cx + Math.cos(a) * R, cz + Math.sin(a) * R, limit); } };
  const H = Math.PI / 2;
  line(-84, zL, xC - RL, zL);
  arc(xC - RL, zL - RL, RL, H, 0);                 // left turn: east -> north
  line(xC, zL - RL, xC, zH + RR);
  arc(xC + RR, zH + RR, RR, Math.PI, 3 * H);       // right turn: north -> east
  line(xC + RR, zH, xP - RR, zH);
  arc(xP - RR, zH + RR, RR, -H, 0);                // right turn: east -> south
  line(xP, zH + RR, xP, zG - RR);
  arc(xP - RR, zG - RR, RR, 0, H);                 // right turn: south -> west
  line(xP - RR, zG, xE + RR, zG);
  arc(xE + RR, zG - RR, RR, H, Math.PI);           // right turn: west -> north
  line(xE, zG - RR, xE, -21);
  // The last yaw repeats the previous segment's.
  if (pts.length > 1) pts[pts.length - 1].yaw = pts[pts.length - 2].yaw;
  return { pts, length: s };
}
/** Pose on the route at arc length `s` (clamped). */
export function l4RoutePose(route: ReturnType<typeof l4Route>, s: number): { x: number; z: number; yaw: number; limit: number } {
  const pts = route.pts, at = Math.max(0, Math.min(route.length, s));
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const k = (lo + hi) >>> 1; if (pts[k].s < at) lo = k; else hi = k; }
  const a = pts[lo], b = pts[hi], f = (at - a.s) / ((b.s - a.s) || 1);
  const delta = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, yaw: a.yaw + delta * f, limit: Math.min(a.limit, b.limit) };
}
/**
 * Arc length of each convoy vehicle at the start (the tail inside the army gate) and when parked (head at the route end, the others
 * behind it, `gapM` apart). Every vehicle drives the same distance, so the column keeps its shape.
 */
export function l4ConvoyStations(length: number): { start: number[]; end: number[]; travel: number } {
  const v = l4.convoy.vehicles, end: number[] = [];
  let at = length;
  for (let i = 0; i < v.length; i++) { if (i) at -= v[i - 1].len / 2 + v[i].len / 2 + l4.convoy.gapM; end.push(at); }
  const tailStart = v[v.length - 1].len / 2 + 1, travel = end[v.length - 1] - tailStart;
  return { start: end.map(e => e - travel), end, travel };
}
/** Street of a world point on the L4 map (nearest of the five streets), for population, bots and dressing tests. */
export function l4Edge(x: number, z: number): 'lakeshore' | 'harbor' | 'plaza' | 'east' | 'west' {
  return z > 30 ? 'lakeshore' : z < -30 ? 'harbor' : x > 5 ? 'east' : x < -40 ? 'west' : 'plaza';
}
