/**
 * Level 2 "The Failed Rescue" tuning table (specs/epic-20-level-2-the-failed-rescue.md, section 5). Data only.
 * Coordinates are world metres on D-GROVE (origin at the map centre, X east, Z south); L2 reuses L1's town at midday
 * (orchestrator default, see the E20 report: the 56 m district slabs cannot be joined to the 170 x 110 m D-GROVE).
 * Times in seconds, speeds in m/s. Starting tuning; every number is read by the L2 controller, bots and tests.
 */
type P = readonly [number, number];
/** Behaviour of a trapped person at the glass (see `l2.rescue.atGlass`). */
export type GlassRole = 'bang' | 'press' | 'plead' | 'look' | 'cower' | 'hug' | 'child';
export const l2 = {
  /** Beat 1-2: the calm in the bay, then the alarm (seeded inside the window). */
  calm: { alarmAtS: [20, 30] as P, crewToTruckMaxS: 8, crewRunMs: 4.2, civiliansOnBenches: 4 },
  /** Beat 3: the truck ride (kinematic route through Elm -> Juniper -> Main Row). */
  ride: { cruiseMs: 7.6, cornerMs: 4.2, accelMs2: 2.6, zoomOut: 1.15, exitWithinS: 4, controlWithinS: .5, boardInteractS: .6 },
  /** Beat 4-5: arrival, doors, release and the ambush reveal. */
  rescue: {
    forceDoorsS: 4, trapped: { high: 30, low: 20 }, releaseOverS: 11, ambush: 24, crewHp: 100,
    /** Emergence points of the ambush (refuge doors 26-38 m from the front door, three directions >= 60 degrees apart). */
    ambushDoors: [['refuge-door-1', 8], ['refuge-door-17', 8], ['refuge-door-8', 8]] as readonly (readonly [string, number])[],
    /** Where each ambush street runs: the loading door, the forecourt, Main Row in front of the market. */
    ambushRush: { 'refuge-door-1': [-50, -36], 'refuge-door-17': [-46, -38], 'refuge-door-8': [-48, -34] } as Record<string, P>,
    /** Fleeing people run for the north and east town edges (the nearby houses are locked); the south stays the courier's way out. */
    refuges: ['edge-in-3', 'edge-in-4'] as readonly string[],
    /**
     * Trapped people visible behind the glass before the release (x, z, yaw, behaviour): east glass (front doors at z -42.2) and
     * south glass (loading door at x -55.6). PO 10-08 "the humans are just standing there": every one panics on its own loop —
     * banging, pressing on the glass, waving both arms, looking back into the shop, crouched crying, holding a child.
     */
    atGlass: [
      [-51.95, -42.95, 0, 'bang'], [-51.95, -41.45, 0, 'bang'], [-51.95, -44.6, 0, 'press'], [-51.95, -39.9, 0, 'plead'], [-52.0, -46.0, 0, 'plead'],
      [-52.85, -42.2, 0, 'look'], [-53.05, -43.85, 0, 'hug'], [-52.5, -43.8, 0, 'child'], [-52.95, -40.6, 0, 'cower'],
      [-55.05, -38.2, -Math.PI / 2, 'bang'], [-56.35, -38.2, -Math.PI / 2, 'press'], [-57.75, -38.25, -Math.PI / 2, 'plead'], [-53.65, -38.25, -Math.PI / 2, 'look'],
      [-56.0, -39.15, -Math.PI / 2, 'cower'], [-58.7, -39.4, -Math.PI / 2, 'hug'], [-58.7, -38.75, -Math.PI / 2, 'child'],
    ] as readonly (readonly [number, number, number, GlassRole])[],
    /** The crew's places at the doors: three at the chained front doors, three at the loading door; one directs the people. */
    crewDoors: [[-50.55, -43.05, 'pry'], [-48.6, -42.2, 'direct'], [-50.55, -41.35, 'pry'], [-57.0, -36.85, 'pry'], [-55.6, -36.6, 'pry'], [-54.2, -36.85, 'pry']] as readonly (readonly [number, number, 'pry' | 'direct'])[],
    crewRunMs: 4.2,
    /**
     * Doors open: the people burst out running (a fan away from each door), look back at the shop, then flee for the police
     * checkpoint at the bridge (the courier's destination) along one of three street routes (PO 10-08: they never vanish;
     * they meet the outbreak on the way). Late arrivals wait in front of the closed gate.
     */
    burstM: [6, 11] as P, burstSpreadDeg: 75, tripEvery: 7, lookBackS: [.6, 1.4] as P,
    fleeRoutes: [
      [[-30.6, -31], [-30.6, 0], [-30.6, 30.2], [10, 30.2], [50, 30.4], [70, 30.2]],
      [[-12, -31], [20, -31], [49.8, -30.5], [50, -2], [50.6, 12], [50.2, 30.2], [70, 30.2]],
      [[-62, -31], [-64, -26], [-64, 2], [-64, 29.5], [-31, 30], [10, 30.2], [50, 30.4], [70, 30.2]],
    ] as readonly (readonly P[])[],
    /** Safe spots behind the police line (x, z) and in front of the closed gate. */
    havenBehind: { x: [84.6, 88.4] as P, z: [26.4, 33.8] as P }, havenGate: { x: 73.6, z: [26.2, 34.2] as P },
    /**
     * Danger before the ambush (no omniscience: sounds and far figures only, nothing targets the courier). Seconds after the
     * crew reaches the doors. Lurkers: pedestrians with the turned look crossing a far street end, removed before the doors open.
     */
    danger: {
      screams: [[.5, -80, -14], [2.7, -20, -54]] as readonly (readonly [number, number, number])[],
      carAlarm: { atS: 1.4, x: -61.6, z: -22, beeps: 5, everyS: .85 },
      snarl: { atS: 3.3, x: -72, z: -30 },
      lurkers: [[.8, -72, -33.5, -72, -26.5], [1.3, -73.2, -33, -73.6, -27.5], [2.2, -30.6, -56, -24, -56]] as readonly (readonly [number, number, number, number, number])[],
      smoke: [-66, -54] as P,
    },
    radioAfterS: 45, radioAwayM: 25,
  },
  /** Section 5.2: allied fighters v1. */
  allies: {
    coneDeg: 140, rangeM: 16, regroupM: 6,
    /** engageM: they guard the doors and the people coming out, they do not clear the streets. */
    firefighter: { hp: 100, damage: 25, swingS: .8, reachM: 1.8, windupS: .35, moveMs: 3.8, rescueWindowS: 1, engageM: 10 },
    officer: { hp: 100, damage: 40, shotS: .7, rangeM: 15 },
  },
  /** Section 5.5: the street escape. */
  escape: {
    /** Group homes of the wandering infected (x, z, size); spawned at emergence doors when the escape starts. */
    groups: [
      [-46, 2, 5], [-12, 2, 4], [30, 2, 4], [-12, -12, 3], [32, -12, 3], [-46, 12, 2], [-10, 12, 2], [70, -20, 2], [-82, 10, 1],
    ] as readonly (readonly [number, number, number])[],
    /** People still out on the streets (from the alarm on), kept away from the bridge cluster. */
    leashM: 6, civilians: [[-30, 0], [-45, 30], [5, -31], [-80, -20], [-64, -22], [14, 15], [-20, -15], [40, -20], [0, 20], [20, -14]] as readonly P[],
    caps: { high: 60, low: 30 },
    /** Low tier (phone): ambush, street groups and cluster are halved with the cap. */
    lowScale: .5,
  },
  /** Section 5.5: the dense cluster on the Elm Street approach to the bridge and its two openings. */
  /** Home at the Elm/Larch junction: far enough (> 16 m) from the people behind the line that they never see them. */
  cluster: { home: [48, 30] as P, count: 13, radiusM: 7, triggerM: 30 },
  /** Section 5.6: the police bridge checkpoint at the east end of Elm Street. */
  /** Officers hold fire until the evacuee is this close to the gate (they do not clear the approach from the line). */
  checkpoint: { gateX: 76, gateZ: [24.6, 35.6] as P, closeWithinS: 1.5, holdS: 2, officers: 4, civilians: 8, policeVehicles: 3, shootM: 15, coverM: 20 },
  /** Multiplier on the infected hit (L1: 10 per hit, 0.9 s cycle). Starting tuning for the 'fight everything' failure. */
  infectedDamage: 1.8,
  /** Section 4: checkpoints. */
  checkpoints: ['doors', 'escape', 'cluster'] as const,
  /** Bots (section 8). Bands are provisional until the first green 20-seed run (staging decision section 6). */
  bots: { seeds: 20, completeMedianS: [105, 210] as P, newbieMedianS: [120, 240] as P, newbieMinSeeds: 18, newbieMaxMedianDeaths: 1 },
} as const;

/** Named world points authored into the L2 layout copy (resolved through the ordinary mission anchor lookup). */
export const l2Anchors: Record<string, P> = {
  'l2-start': [-73.6, 44.6],
  'l2-axe-rack': [-74.4, 41.7],
  'l2-truck': [-70.6, 36.7],
  'l2-board': [-72.55, 37.2],
  'l2-bench-1': [-75.7, 45.0], 'l2-bench-2': [-75.7, 43.2], 'l2-bench-3': [-69.0, 43.6],
  'l2-crew-1': [-71.0, 45.6], 'l2-crew-2': [-72.4, 46.4], 'l2-crew-3': [-74.6, 42.4], 'l2-crew-4': [-73.6, 42.0], 'l2-crew-5': [-68.6, 38.2], 'l2-crew-6': [-73.0, 39.0],
  'l2-truck-stop': [-43.0, -30.4],
  'l2-market': [-55.6, -42.2],
  'l2-door-front': [-50.7, -42.2],
  'l2-door-loading': [-55.6, -37.3],
  'l2-forecourt': [-46.5, -38.0],
  /** Where the doors objective leads the courier: close enough that the game camera frames the people behind the glass. */
  'l2-watch': [-48.2, -40.0],
  'l2-gate': [76, 30],
  'l2-gate-inside': [79.5, 30],
  'l2-cluster': [48, 30],
  'l2-cluster-alarm': [48.6, 12.4],
  'l2-side-gate': [81.5, 35.8],
  'photo-l2-station-calm': [-72.5, 44.5], 'photo-l2-alarm': [-72.5, 43], 'photo-l2-truck-ride': [-30, 0],
  'photo-l2-doors-open': [-50, -40], 'photo-l2-collapse': [-48, -36], 'photo-l2-streets-w1': [-37.8, -35.0],
  'photo-l2-cluster': [49, 29], 'photo-l2-bridge-checkpoint': [78, 30],
};
/** Truck route (centre line), station apron -> Elm -> Juniper west -> Main Row -> Grove Market forecourt. */
export const l2TruckRoute: readonly P[] = [[-70.6, 36.7], [-70.6, 30.6], [-30.6, 30.6], [-30.6, -30.4], [-43.0, -30.4]];
