import { l3 } from './l3';

/**
 * Level 4 "The Safe City Falls" tuning table (specs/epic-22-level-4-the-safe-city-falls.md, sections 4 and 5). Data only.
 * Coordinates are world metres on D-FAIR (layouts/D-FAIR/layout.py; origin at the map centre, X east, Z south). The convoy enters
 * from the army gate at the west end of Lakeshore Avenue, tours the clean city and parks in the Reception Plaza; the war is
 * fought on the plaza and the streets around it; the player takes Lakeshore, Metro Road and Harbor Street to Kessler's cellar. Times in seconds,
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
    /**
     * `len` is the hull length (manifest), `player` the bus the courier rides in: the first bus of the column (PO 10-13: "Let the user exit
     * the 1st bus which is ON the military area"), which parks along the perimeter beside the quartermaster; the second parks beyond the south line.
     */
    vehicles: [
      { id: 'apc', asset: 'veh.military-apc', len: 5.69, wid: 2.95 },
      { id: 'truck-1', asset: 'veh.military-truck', len: 6.93, wid: 2.9 },
      { id: 'bus-2', asset: 'veh.evac-bus', len: 9.36, wid: 2.96, player: true },
      { id: 'truck-2', asset: 'veh.military-truck', len: 6.93, wid: 2.9 },
      { id: 'bus-1', asset: 'veh.evac-bus', len: 9.36, wid: 2.96 },
    ] as readonly { id: string; asset: string; len: number; wid: number; player?: boolean }[],
    /** The ride must take 20-35 s for the courier's bus (E22-AC04). */
    rideS: [20, 35] as P,
    /** Control returns this long after the bus stops (<= 0.5 s, AC04). */
    controlS: .3,
  },
  /**
   * PO 10-13: the courier gets off inside the military area and cannot walk away before the story lets her. Until the line breaks she is
   * kept inside this box (courier-only walls just outside the soldiers' posts; the parked convoy is the east side, its gaps closed by jersey
   * barriers when it stops: "the gate closes behind the convoy"). A soldier calls her back when she leans on it (every `barkEveryS` at most).
   */
  perimeter: { x0: -35.6, x1: -9.2, z0: -17.4, z1: 22.5, barkM: 1.2, barkEveryS: 12, barrier: 'prop.jersey-barrier' },
  /** PO #119: where civilians inside the perimeter shelter during the war (away from the wall and the street mouths; spread around each by the refuge rule). */
  campShelters: [[-30, -12.5], [-30, 18.5], [-21, -12.5]] as readonly P[],
  /** Beat 2: free walk, the quartermaster issues the machine gun. */
  calm: {
    /** Civilians already in the city before the convoy arrives, and the evacuees who step off the buses. */
    residents: { high: 40, low: 20 }, evacuees: { high: 24, low: 12 },
    /** PO 2026-10-13: new infected at the alarm, preserving the previous pressure count without converting evacuees. */
    alarmInfected: { high: 18, low: 9 },
    /** Where the evacuees beyond the eight queue slots wait: two rows between the armory table and the tents, facing the registration. */
    waiting: [5.8, 10].flatMap(z => [-31, -29.5, -28, -24.5, -23, -21.5, -18.5, -17, -15.5].map(x => [x, z] as P)) as readonly P[],
    soldiers: { high: 20, low: 10 },
    /**
     * PO 10-13: "before the alarm let solidiers be relaxed. The take their position when the alarm is running." Off duty until the turn,
     * rifles lowered: chatting pairs, coffee (the cup hold), short patrols; the quartermaster, the HMG crews and the gate guards stay at
     * their posts, relaxed. Post names from `l4Posts`; points are world metres (snapped to clear ground).
     */
    offDuty: {
      chat: [['n1', 'n2', [-24.5, -12.2]], ['s1', 's2', [-24.5, 15.6]], ['e1', 'e3', [-14.7, -8.5]], ['w2', 'w3', [-30.6, 7]]] as readonly (readonly [string, string, P])[],
      coffee: [['n3', [-17.2, -12.4], [-20, -4]], ['t1', [-14, 12.8], [-20, 8]], ['hmg-1', [-31.2, -12.6], [-24, -6]]] as readonly (readonly [string, P, P])[],
      patrol: [['w1', [-31.4, -11.8], [-31.4, -5.5]], ['s3', [-19.5, 16.2], [-13.8, 16.2]], ['t2', [-14, -16.4], [-24, -16.6]], ['e2', [-13.8, 9.5], [-13.8, 2.5]]] as readonly (readonly [string, P, P])[],
      /** Seconds a patrol stops at each end, looking out. */
      patrolLookS: 5,
    },
    /** Radio line (loudspeaker) once the convoy has stopped, and the quartermaster's interact time. */
    welcomeAtS: 1.5, issueS: .6,
  },
  /** The machine gun (E06 section 5.3 campaign values): 14 per round, 10 rounds/s, 4 degrees, 26 m, pierce 1, no ammunition. */
  machineGun: { id: 'weapon.army-mg', damage: 14, fireRate: 10, spreadDeg: 4, rangeM: 26, pierce: 1 },
  /** Beat 4: the outbreak follows the convoy. From turn + `fromS` infected come from the street edges, escalating. */
  war: {
    fromS: 0, waveEveryS: 11,
    /** Infected per wave per street edge, the first waves small; `waveScale` multiplies them (PO 2026-10-12 design: outside infected x3-5, peak alive capped by `caps`). */
    waveSize: [6, 9, 12, 14, 14, 14, 14, 14, 14, 14] as readonly number[], edgesPerWave: 3, waveScale: 3, pendMax: 160,
    /** Keep slots free for bites; downed infected retain their own slots until they recover. */
    headroom: 12,
    /** Retained downed-body budget: recycle repeat regular downings above it (PO #118), preserving first recoveries and authored Alphas. */
    downedSlots: 10,
    /** Corpse-pile telemetry cells; bodies persist for the whole level (PO 10-14). */
    heap: { cellM: 4 },
    /** Seconds the streets keep emerging after the line break (collapse). */
    collapseWaveEveryS: 9, collapseWaveSize: 3, collapseCapInfected: 80,
    caps: { infected: { high: 120, low: 60 }, characters: { high: 190, low: 95 } },
    /**
     * PO 10-13: "Let them come from all directios, not in bulk." Each wave adds to every street edge; an edge releases a small group
     * (`group`, seeded) from one of its emergence points (`l4Emergence`, in turn) every `groupEveryS` (seeded), so the infected arrive spread
     * and staggered. `inside`: during the war groups of 1-2 also come out of the buildings inside the perimeter (tents, containers,
     * registration; `l4Inside`) every `insideEveryS`, when the spot is out of view or hidden behind a building.
     */
    group: [2, 5] as P, groupEveryS: [2, 4] as P, inside: { everyS: 12, group: [1, 2] as P, minM: 9 },
    /** Infected hit like L3's (the PO found earlier levels too hard: a sensible player finishes with few deaths). */
    infectedDamage: l3.infectedDamage,
    emergeLeashM: 26,
  },
  /**
   * The base alarm at the first turn (PO 2026-10-12: "when contact starts, play an alarm sound (typical for military)"): a rising and falling klaxon
   * from the camp loudspeakers (positional, at the light towers and the reception) plus a quiet non-positional bed so it is always audible.
   * Full level for `holdS`, then it fades out over `fadeS` under the fight music (total 20-40 s). Synthesised in src/audio/synthesis.ts.
   */
  /** The in-bus radio (PO 2026-10-12): clear, filtered music from the bus until the alarm; `scoreTrim` lowers the adaptive score while it plays. */
  radio: { gain: .6, cabHz: 3000, openHz: 1600, rangeM: 30, fadeS: 2.5, scoreTrim: .3 },
  alarm: { holdS: 24, fadeS: 8, periodS: 6, lowHz: 420, highHz: 640, speakerGain: 1.1, bedGain: .22, speakers: [[-31.2, 15.4], [-16.6, -12.2], [-26, -8.8]] as readonly P[] },
  /**
   * The Alphas (PO 10-13: "add more alphas. The current one has zero chance."): staggered, from different street mouths (`l4AlphaEmergence`
   * holds when and what each one does), inside the ordinary caps. `allyResist` scales the damage they take from anyone but the courier
   * (soldiers, HMG nests, tank, helicopter, armed civilians); the courier's damage is unchanged.
   */
  alphas: { count: { high: 8, low: 6 }, allyResist: .5, lineHp: 300 },
  /** Section 5.6 (changed by the l4-collapse design): the final "Fall back!" comes `fallBackS` after the third line broke, at the latest `defenseS` after the turn. */
  lineBreak: { defenseS: 200, fallBackS: 8, mockupLatestS: 120 },
  /**
   * The collapse director (PO 2026-10-12, "the soldiers cannot hold the lines, but they do easily ... How should we solve that?", design approved "ok let's try that!").
   * Three lines break at fixed beats (seconds after the turn): a line breaks at the first of (from `earliestS`: half its soldiers down) or `dueS`.
   * From `pushS` the director adds pressure every `pushEveryS` while more than half the line still stands: people inside the line turn and
   * infected come at its flank (out of view). It never touches soldier accuracy or damage.
   */
  director: {
    lines: [
      { id: 'line-1', earliestS: 50, dueS: 62, pushS: 34 },
      { id: 'nests', earliestS: 110, dueS: 124, pushS: 104 },
      { id: 'armor', earliestS: 170, dueS: 182, pushS: 150 },
    ] as readonly { id: 'line-1' | 'nests' | 'armor'; earliestS: number; dueS: number; pushS: number }[],
    pushEveryS: 4, push: { high: 10, low: 5 }, frontWave: { high: 30, low: 15 }, standing: .5,
    /** Per push at line 1: bitten refugees that run in behind a soldier and turn there (at the latest after `refugeeTurnS`). */
    refugees: { high: 5, low: 3 }, refugeeTurnS: 7,
    /** Alive infected allowed per stage (share of the tier cap): the pressure grows with the beats; full cap after the fall back. */
    alive: [.8, .9, .7] as readonly number[], aliveLow: [.7, .8, .6] as readonly number[],
    /** Fallback posts: line 1 falls back to the reception and the nests, the nests to the convoy, the convoy retreats in small groups. */
    fallback1: [[-27.5, -11.8], [-23.5, -11.8], [-19.5, -11.8], [-28.4, -2], [-28.4, 6.8], [-27.5, 15.2], [-24, 15.2], [-17.5, 9.2], [-20.5, -1]] as readonly P[],
    fallback2: [[-16, -10], [-16, -6.7], [-16, -3.4], [-16, 0], [-16, 3.3], [-16, 6.6], [-16, 10], [-16, -15.5], [-16, 13.5]] as readonly P[],
    retreat: [[-6, -30], [4, -4], [-13, 31]] as readonly P[], // l4-collapse-2: the south group no longer retreats onto the escape street (x = -4)
    /** Flank spawn points per line (outside the line ends and corners; used only out of view and >= 12 m from the courier). */
    flanks: [
      [[-37, -18], [-37, 21], [-11, -19], [-11, 22], [-40, 2]],
      [[-37, -18], [-37, 21], [-30, -24], [-25, 27]],
      [[2, -14], [2, 16], [-4, -22], [-4, 26]],
    ] as readonly (readonly P[])[],
    /** Alpha jobs: each nest Alpha waits, then charges from a stage point ~8 m outside an authored E26 slot (north, south) through it and slams the crew behind. */
    alphaStage: { north: [-18.6, -22.5] as P, south: [-25.9, 25.4] as P },
    /** Where they wait (out of the plaza sight lines) until the beat: the NW alley and Lakeshore Avenue. */
    alphaHold: { north: [-39, -25] as P, south: [-21, 38] as P },
    /** The armour beat: infected swarm the tank; it goes silent once `swarm` infected are within `swarmM`. */
    swarm: 6, swarmM: 6.5, cutOff: { high: 6, low: 3 },
    /** Readability: short camera beats (sim pauses, <= 2 s, skippable after 0.5 s) at the line-1 overrun and the swarmed tank. */
    cameraS: 1.6,
    /** The escape window: at "Fall back!" (and on a respawn in the collapse) infected farther than `nearM` from the courier ignore her for `s` (busy with the army). */
    escape: {
      /** First street point beyond the east camp perimeter: the escape checkpoint after Fall back. */
      // South of the parked truck/bus row: the former z=4 checkpoint and
      // cross-plaza lane cut through the truck's hull and front bumper.
      checkpoint: [-4, 16] as P,
      nearM: 7, s: 15,
      /**
       * The escape street (l4-collapse-2): out of the ring's east side, down the x = -4 street to Lakeshore Avenue and east to Kessler's
       * cellar door. From "Fall back!" (and after a respawn in the collapse) for `gapS` the horde leaves a gap on it: infected farther than
       * `nearM` from the courier within `gapM` of the route run off toward the army, and nothing emerges on it. Pursuers still chase.
       */
      route: [[-12, 16], [-4, 16], [-4, 28], [-2, 41], [8, 43], [40, 43], [62, 42]] as readonly P[], gapM: 7, gapS: 40,
    },
    /** Camp checkpoints behind each remaining line; choose the nearest safe navigable post when the line falls. */
    checkpoints: [
      [[-25, -8], [-25, 4], [-25, 10]],
      [[-16, -11]], // rear of the north reception line, beside the camp medical supplies
      [[-9.8, -16.5], [-9.8, -6.5], [-11, 16]], // bumper gaps behind the convoy crew, clear of the hulls and south tank swarm
      [[-11, 16]], // armour falls: rally at the south convoy gap before breaking away onto Lakeshore
    ] as readonly (readonly P[])[],
  },
  /** Section 5.4: allied fighters v3. */
  soldiers: {
    hp: 120,
    /** PO 2026-10-13 ("they kill all Zombies before i see them myself"): near the player the view rule (Allies.ts, option 3) caps
     * what an ally may shoot; away from the player these ranges apply as before. */
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
    /** Enters at turn + enterAfterS from the army gate along Lakeshore, then north through the lake garden gap. PO #116: the lane keeps clear of the parked cars (z 43.3) and the stop sits outside the military wall (z 22.5), never astride it. */
    enterAfterS: 22, speedMs: 3.6, fireEveryS: [8, 12] as P, minDistM: 15, shellId: 'explosion.tank-shell', turnRate: 2.2,
    path: [[-70, 47], [-26, 47], [-20, 41], [-20, 27.5]] as readonly P[],
  },
  heli: { alt: 17, orbitR: 30, omega: .26, centre: [-14, 4] as P, burstEveryS: [2.2, 3.6] as P, burst: { shots: 5, shotS: .09, damage: 22, hit: .6, rangeM: 60 }, startR: 95, arriveS: 7, withdrawS: 7 },
  /** Fuel truck at the plaza edge (Plaza Way, by the convoy gap): the tank shell sets it off at the line break (mega chain). */
  fuelTruck: { x: 16.3, z: -9.5, yaw: Math.PI / 2, blast: 'explosion.fuel-truck' },
  /** Beat 5-6: live damage and the collapse; the cellar marker appears at the line break. */
  collapse: {
    fires: 4, burningCars: 3, pendingPerTick: 3,
    /** Soldiers pockets along both routes fight turned soldiers and infected (sim-light). */
    pockets: 2,
    /** A small side-street group beyond the protected break-away lane. */
    egress: [10.2, 34] as P, streetLookS: 15,
  },
  /** PO #17b: the walk crosses Lakeshore, the unseen Metro Road blocks and Harbor Street to the far northwest refuge.
   * The first legs reuse the existing break-away gap; both sidewalks remain open throughout. Running may shorten the walk.
   */
  finale: {
    route: [[-12, 16], [-4, 16], [-4, 28], [-2, 41], [8, 43], [48.5, 43], [48.5, 20], [48.5, -15], [48.5, -37.4],
      [20, -37.4], [-12, -37.4], [-44, -37.4], [-64, -39.5], [-79, -40], [-79.3, -45.2801]] as readonly P[],
  },
  /** Beat 7: the cellar. After the door is barred the battle goes on above for at least this long. */
  cellar: { outwardYaw: -Math.PI / 2, interactS: .6, barS: 1.0, battleAfterBarredS: 7 },
  medkits: { heal: 40, positions: [
    [-30.5, -2], [-22, 15], [-16, -11], [-26, 24], [-40.5, 8],                         // plaza ring and west
    [-56, 18], [-44, -37.5], [-4, -37.2], [30, -37.2], [52.5, -2], [60, 22], [58, 43],   // both routes to Kessler Lane
    [38, 43.2], [18, 43.2], [-6, 43.4],
  ] as readonly P[] },
  checkpoints: ['arrival', 'turn', 'line-1', 'nests', 'armor', 'line-break'] as const,
  /** Bots (section 8). Bands are provisional until the first green run (staging decision section 6). */
  bots: { seeds: 20, completeMedianS: [260, 460] as P, newbieMedianS: [275, 490] as P, newbieMinSeeds: 18, newbieMaxMedianDeaths: 2 },
} as const;

/** Convoy parking: the column ends along the plaza at x = -11, head (APC) in the north. See `l4Route`. */
// Stop 15 cm before the old endpoint so the APC's nose clears the storefront steps by >0.3 m.
export const l4Convoy = { endX: -11, endZ: -20.85 } as const;
/** The wider blast wreck turns and settles west of the intact truck, clear of the frontage. */
export const l4FuelCrater = { x: l4.fuelTruck.x - .8, z: l4.fuelTruck.z, yaw: -Math.PI / 2 };

/** The gate closes behind the parked first bus, with >0.3 m at its rear bumper (old first rail left just 0.015 m). */
export const l4ConvoyGate = { x: l4.perimeter.x1, z: [6.15, 9.2, 12.25] } as const;

/** Named world points authored into the L4 layout copy (resolved through the ordinary mission anchor lookup). */
export const l4Anchors: Record<string, P> = {
  'l4-start': [-84, 47.9],
  'l4-quartermaster': [-23.2, 0.6],
  'l4-qm-npc': [-26.6, 0.6],
  'l4-registration': [-26, -8],
  'l4-plaza': [-17, 3],
  'l4-cellar-door': [0, 0],            // replaced by the layout's kessler-cellar-door at load (see levelFourLayouts)
  'l4-brace': [0, 0],                  // replaced from the cellar placement
  'l4-fuel': [l4.fuelTruck.x, l4.fuelTruck.z],
  'l4-hmg-1': [-32.4, -14.1], 'l4-hmg-2': [-14.6, 17.3],
  'l4-tank-stop': [-20, 27.5],
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
  // These posts clear the parked hulls as well as the moving lane; alarm orders
  // must never send a guard back into a bus after he has stepped aside.
  { name: 'e1', at: [-7.6, -12], face: [4, -12], role: 'truck' }, { name: 'e2', at: [-8.6, 12], face: [4, 12], role: 'truck' },
  { name: 'g1', at: [-71, 42.6], face: [-71, 30], role: 'gate' }, { name: 'g2', at: [-71, 49.4], face: [-71, 58], role: 'gate' }, { name: 'g3', at: [-67.5, 44.5], face: [-50, 44], role: 'gate' },
  { name: 't1', at: [-8, 24], face: [4, 30], role: 'truck' }, { name: 't2', at: [-6.5, -16], face: [-10, -34], role: 'truck' }, { name: 'e3', at: [-14.3, 2.2], face: [4, 4], role: 'truck' },
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
/**
 * PO 10-13 ("Let them come from all directios, not in bulk"): the emergence points of each street edge (index into `l4Edges`): its street
 * mouth plus side streets and the doors of the shops and houses around the plaza (`door`: a building door, used from 12 m off the courier;
 * a street point from 24 m). An edge releases its small groups from these in turn, always out of view.
 */
export const l4Emergence: readonly { edge: number; at: P; door?: boolean }[] = [
  { edge: 0, at: [-56.6, 6] }, { edge: 0, at: [-57, -14] }, { edge: 0, at: [-46, 21] }, { edge: 0, at: [-42.3, 10.2], door: true },
  { edge: 1, at: [-39.2, -35] }, { edge: 1, at: [-40, -26] }, { edge: 1, at: [-46.9, -23], door: true }, { edge: 1, at: [-42, -15.5], door: true },
  { edge: 2, at: [-18, -38.4] }, { edge: 2, at: [-30, -38] }, { edge: 2, at: [-30, -21.2], door: true }, { edge: 2, at: [-13.7, -23.2], door: true },
  { edge: 3, at: [13.4, -3] }, { edge: 3, at: [13, -20] }, { edge: 3, at: [13, 14] }, { edge: 3, at: [2, -9], door: true }, { edge: 3, at: [-.1, -17.5], door: true },
  { edge: 4, at: [-5.5, 42.6] }, { edge: 4, at: [-14, 40] }, { edge: 4, at: [.9, 18.8], door: true }, { edge: 4, at: [-.1, 33.5], door: true },
  { edge: 5, at: [-23, 42.6] }, { edge: 5, at: [-36, 40] }, { edge: 5, at: [-44.9, 27.1], door: true },
  { edge: 6, at: [50.5, -37.4] },
];
/** Inside the perimeter (PO 10-13: "ALso from within buildings inside the army area"): behind the tents, the supply crates and the registration kit. */
export const l4Inside: readonly P[] = [[-30.6, 10.4], [-26.8, 10.4], [-22.8, 10.4], [-31.8, 4], [-20.8, 2.2], [-26, -10.6], [-30.5, -10.6]];
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
/** Post-collapse street homes (x, z, size, optional reserved slots): out-of-view emergence or existing stragglers arriving on foot under the same cap. */
export const l4CollapseGroups: readonly (readonly [number, number, number, number?])[] = [
  [l4.collapse.egress[0], l4.collapse.egress[1], 2, 2],
  // Side-street pairs remain outside the protected Lakeshore corridor, with the full road open beside them.
  [20, 54, 2], [42, 54, 2, 2],
  [-84, -39.5, 3, 2], [-46, -37.4, 3], [-24, -37.4, 4, 2], [-4, -37.4, 4, 2], [18, -37.4, 4], [38, -37.4, 3], [50, -22, 4, 2], [50, -6, 4], [50, 12, 3, 2],
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
  line(xE, zG - RR, xE, l4Convoy.endZ);
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

/** Remaining street-route distance, including the approach to its nearest leg; optionally writes the next turn for the minimap. */
export function l4CellarDistance(p: { x: number; z: number }, next?: { x: number; z: number }): number {
  const route = l4.finale.route;
  let nearest = Infinity, remaining = 0, tail = 0;
  for (let i = route.length - 1; i > 0; i--) {
    const [ax, az] = route[i - 1], [bx, bz] = route[i], dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (length * length)));
    const d = Math.hypot(p.x - ax - t * dx, p.z - az - t * dz);
    if (d < nearest) { nearest = d; remaining = d + (1 - t) * length + tail; if (next) { next.x = bx; next.z = bz; } }
    tail += length;
  }
  return remaining;
}
