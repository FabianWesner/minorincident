/**
 * Level 2 "The Failed Rescue" tuning table (specs/epic-20-level-2-the-failed-rescue.md, section 5). Data only.
 * Coordinates are world metres on D-GROVE (origin at the map centre, X east, Z south); L2 reuses L1's town at midday
 * (orchestrator default, see the E20 report: the 56 m district slabs cannot be joined to the 170 x 110 m D-GROVE).
 * Times in seconds, speeds in m/s. Starting tuning; every number is read by the L2 controller, bots and tests.
 */
type P = readonly [number, number];
export const l2 = {
  /** Beat 1-2: the calm in the bay, then the alarm (seeded inside the window). */
  calm: { alarmAtS: [20, 30] as P, crewToTruckMaxS: 8, crewRunMs: 4.2, civiliansOnBenches: 4 },
  /** Beat 3: the truck ride (kinematic route, Main Row west from the station since 2026-10-08: 83 m, so it cruises at 5.6 m/s
   * through the wrecks instead of 7.6 m/s over the old 150 m Elm -> Juniper -> Main Row loop; the ride stays 15-25 s). */
  ride: { cruiseMs: 5.6, cornerMs: 4.2, accelMs2: 2.6, zoomOut: 1.15, exitWithinS: 4, controlWithinS: .5, boardInteractS: .6 },
  /** Beat 4-5: arrival, doors, release and the ambush reveal. */
  rescue: {
    forceDoorsS: 4, trapped: { high: 30, low: 20 }, releaseOverS: 11, ambush: 24, crewHp: 100,
    /** Emergence points of the ambush (refuge doors 26-38 m from the front door, three directions >= 60 degrees apart). */
    // Numbers follow the D-GROVE door order (sorted by position); renumbered 2026-10-08 when the station moved (same three doors).
    ambushDoors: [['refuge-door-2', 8], ['refuge-door-19', 8], ['refuge-door-10', 8]] as readonly (readonly [string, number])[],
    /** Where each ambush street runs: the loading door, the forecourt, Main Row in front of the market. */
    ambushRush: { 'refuge-door-2': [-50, -36], 'refuge-door-19': [-46, -38], 'refuge-door-10': [-48, -34] } as Record<string, P>,
    /** Fleeing people run for the north and east town edges (the nearby houses are locked); the south stays the courier's way out. */
    refuges: ['edge-in-3', 'edge-in-4'] as readonly string[],
    /** Trapped people visible at the open storefront before the release (x, z, yaw): east glass and south glass. */
    atGlass: [[-52.2, -43.6, 0], [-52.3, -41.6, 0], [-52.2, -39.8, 0], [-57.6, -38.4, -Math.PI / 2], [-55.4, -38.5, -Math.PI / 2], [-53.6, -38.4, -Math.PI / 2]] as readonly (readonly [number, number, number])[],
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

/**
 * Fire Station 3, where L1 ends and L2 starts: the D-GROVE placement frame (position, yaw; a unit test keeps it equal to the
 * layout). Moved 2026-10-08 from the south-west corner to Main Row (PO L1 route). Station-local metres: x points out of the
 * bays, z along the facade (the right bay with the L1 trigger at z -1.23); the interior is x -4.5..1.5, the apron 1.5..5.85.
 */
export const l2Station = { x: 38.8, z: -41.05, yaw: -Math.PI / 2 } as const;
/** Station-local (x out of the bays, z along the facade) to world, same rotation as the layout placements. */
export const stationPoint = (lx: number, lz: number): P => [
  l2Station.x + lx * Math.cos(l2Station.yaw) + lz * Math.sin(l2Station.yaw), l2Station.z - lx * Math.sin(l2Station.yaw) + lz * Math.cos(l2Station.yaw)];
/** The engine waits on Main Row in front of the open bays, nose west toward Grove Market. */
const truck = { x: 40.0, z: -31.8, yaw: Math.PI } as const;
/** Truck-local (x forward, z to the right of the cab: north while the nose points west) to world. */
const truckPoint = (lx: number, lz: number): P => [truck.x + Math.cos(truck.yaw) * lx + Math.sin(truck.yaw) * lz, truck.z - Math.sin(truck.yaw) * lx + Math.cos(truck.yaw) * lz];
export const l2Truck = truck;

/** Named world points authored into the L2 layout copy (resolved through the ordinary mission anchor lookup). */
export const l2Anchors: Record<string, P> = {
  'l2-start': stationPoint(3.4, 2.1),
  // On the back wall of the left bay (the rack mounts on the wall behind it, see L2Props).
  'l2-axe-rack': stationPoint(-3.9, 3.0),
  'l2-truck': [truck.x, truck.z],
  // Crew door on the station side of the cab.
  'l2-board': truckPoint(-.5, 1.95),
  // Two seats on the bench by the open bay, two on the bench deeper in the left bay.
  'l2-bench-1': stationPoint(1.3, 2.5), 'l2-bench-2': stationPoint(1.3, .7), 'l2-bench-3': stationPoint(-1.3, 3.8), 'l2-bench-4': stationPoint(-1.3, 2.0),
  'l2-crew-1': stationPoint(6.0, 3.1), 'l2-crew-2': stationPoint(4.6, 3.9), 'l2-crew-3': stationPoint(2.4, -.1), 'l2-crew-4': stationPoint(3.4, -.5),
  'l2-crew-5': truckPoint(-2.0, 1.9), 'l2-crew-6': stationPoint(4.0, -3.5),
  'l2-truck-stop': [-43.0, -30.4],
  'l2-market': [-55.6, -42.2],
  'l2-door-front': [-50.7, -42.2],
  'l2-door-loading': [-55.6, -37.3],
  'l2-forecourt': [-46.5, -38.0],
  'l2-gate': [76, 30],
  'l2-gate-inside': [79.5, 30],
  'l2-cluster': [48, 30],
  'l2-cluster-alarm': [48.6, 12.4],
  'l2-side-gate': [81.5, 35.8],
  'photo-l2-station-calm': stationPoint(4.5, 2.0), 'photo-l2-alarm': stationPoint(4.5, .5), 'photo-l2-truck-ride': [-30, 0],
  'photo-l2-doors-open': [-50, -40], 'photo-l2-collapse': [-48, -36], 'photo-l2-streets-w1': [-37.8, -35.0],
  'photo-l2-cluster': [49, 29], 'photo-l2-bridge-checkpoint': [78, 30],
};
/** What the crew look at while they wait (gear, the truck), and the alarm beacons above the two bays (x, z). */
export const l2StationLooks: readonly P[] = [stationPoint(6.4, 5.1), stationPoint(4.6, 5.1), stationPoint(3.4, -.5), stationPoint(2.4, -.1), [truck.x, truck.z], [truck.x, truck.z]];
export const l2Beacons: readonly P[] = [stationPoint(1.1, 1.9), stationPoint(1.1, -1.9)];
/** Truck route (centre line): Main Row west from the station, in the westbound lane past the W1 wrecks, to the Grove Market forecourt. */
export const l2TruckRoute: readonly P[] = [[truck.x, truck.z], [-26.0, -31.8], [-43.0, -30.4]];
