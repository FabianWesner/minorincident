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
  /** Beat 1-2: the calm in the bay, then the alarm when the fire axe is taken. */
  calm: { crewToTruckMaxS: 8, crewRunMs: 4.2, civiliansOnBenches: 4 },
  /** Beat 3: drive from the original station apron through Elm, Juniper west and Main Row. */
  ride: { cruiseMs: 7.6, cornerMs: 4, accelMs2: 2.6, brakeMs2: 4, yawRateDegS: 25, zoomOut: 1.15, exitWithinS: 4, controlWithinS: .5, boardInteractS: .6 },
  /** Beat 4-5: arrival, doors, release and the ambush reveal. */
  rescue: {
    forceDoorsS: 4, trapped: { high: 30, low: 20 }, releaseOverS: 11, ambush: 24, crewHp: 100,
    /** Emergence points of the ambush (refuge doors 26-38 m from the front door, three directions >= 60 degrees apart). */
    // Numbers follow the D-GROVE door order (sorted by position); renumbered 2026-10-11 when the station returned (same three doors).
    ambushDoors: [['refuge-door-1', 8], ['refuge-door-17', 8], ['refuge-door-8', 8]] as readonly (readonly [string, number])[],
    /** Where each ambush street runs: the loading door, the forecourt, Main Row in front of the market. */
    ambushRush: { 'refuge-door-1': [-50, -36], 'refuge-door-17': [-46, -38], 'refuge-door-8': [-48, -34] } as Record<string, P>,
    /** Fleeing people run for the north and east town edges (the nearby houses are locked); the south stays the courier's way out. */
    refuges: ['edge-in-3', 'edge-in-4'] as readonly string[],
    /**
     * Trapped people visible behind the glass before the release (x, z, yaw, behaviour): east glass (front doors at z -42.2) and
     * south glass (loading door at x -55.6). PO 10-08 "the humans are just standing there": every one panics on its own loop —
     * banging, pressing on the glass (stand-off from the glass >= the pose's hand reach + margin, so no hand passes the pane;
     * `tests/unit/data/l2-glass.test.ts`),  waving both arms, looking back into the shop, crouched crying, holding a child.
     */
    atGlass: [
      [-52.4, -42.95, 0, 'bang'], [-52.4, -41.45, 0, 'bang'], [-52.4, -44.6, 0, 'press'], [-52.3, -39.9, 0, 'plead'], [-52.3, -46.0, 0, 'plead'],
      [-52.85, -42.2, 0, 'look'], [-53.05, -43.85, 0, 'hug'], [-52.5, -43.8, 0, 'child'], [-52.95, -40.6, 0, 'cower'],
      [-55.05, -39.1, -Math.PI / 2, 'bang'], [-56.35, -39.1, -Math.PI / 2, 'press'], [-57.75, -38.95, -Math.PI / 2, 'plead'], [-53.65, -39.0, -Math.PI / 2, 'look'],
      [-56.0, -40.0, -Math.PI / 2, 'cower'], [-58.7, -39.7, -Math.PI / 2, 'hug'], [-58.7, -39.05, -Math.PI / 2, 'child'],
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
    /**
     * PO 2026-10-09 (verbatim): "When firefighter fight Zombies, then they need to make fight moves. Also they are currently too
     * strong". Helpers, not killers: was hp 100, 25 damage every 0.8 s (a 40 hp runner fell in 2 hits / 1.6 s, as fast as the
     * courier's bat); now 14 damage every 1.3 s (3 hits, about 2.6 s per runner, the courier's bat needs 2 hits at ~0.35 s) and
     * hp 70 (4 infected bites at 10 x 1.8), so three infected overwhelm one. Windup 0.4 s = the swing clip's strike frame.
     * engageM 8 (was 10): they guard the doors and the people coming out.
     */
    firefighter: { hp: 70, damage: 14, swingS: 1.3, reachM: 1.8, windupS: .4, moveMs: 3.8, rescueWindowS: 1, engageM: 8 },
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
  checkpoint: { gateX: 76, gateZ: [24.6, 35.6] as P, closeWithinS: 1.5, holdS: 2, officers: 4, civilians: 8, policeVehicles: 3, shootM: 15, coverM: 20,
    /** PO 2026-10-08: the officers visibly fire (allied fighters v2 handguns: seeded hit chance, muzzle flash, tracer); hits knock
     * infected down per the recover rule, only the closed gate stops them. Shots are loud events (E21 gunfire rule). */
    gun: { damage: 20, shotS: .6, rangeM: 22, nearM: 12, hitNear: .7, hitFar: .3 }, lineM: 10, gunfireM: 20, gunfireHoldS: 6, gunfireGapS: .5 },
  /** Multiplier on the infected hit (L1: 10 per hit, 0.9 s cycle). Starting tuning for the 'fight everything' failure. */
  infectedDamage: 1.8,
  /**
   * PO 10-09 "the final fight is far too easy": melee hits that knock down a normal infected (40 HP runner). Damage.ts caps each
   * melee hit at maxHP / hits, so axe damage is capped at maxHP / 2.4, bat at / 4 and fists at / 8. Guns, kicks and L1 are unchanged.
   */
  // PO 10-10: axe x1.25.
  infectedMeleeHits: { 'weapon.fire-axe': 2.4, 'weapon.bat': 4, 'weapon.fists': 8 } as Readonly<Record<string, number>>,
  /**
   * PO 10-09 (as l3.mercy): the escape and cluster checkpoints wait for a calm moment (nothing alive within `calmM`, health >= `calmHealth`).
   * From the `fromDeaths`-th respawn at the same checkpoint on, each respawn releases `stepFrac` (max `maxFrac`) of the infected within `nearM` of the courier.
   */
  mercy: { calmM: 10, calmHealth: .7, fromDeaths: 2, stepFrac: .25, maxFrac: .75, nearM: 45 },
  /** Section 4: checkpoints. */
  checkpoints: ['axe', 'doors', 'escape', 'cluster'] as const,
  /** Bots (section 8). Bands are provisional until the first green 20-seed run (staging decision section 6). */
  bots: { seeds: 1, completeMedianS: [105, 210] as P, newbieMedianS: [120, 240] as P, newbieMinSeeds: 1, newbieMaxMedianDeaths: 1 },
} as const;

/**
 * Fire Station 3, where L1 ends and L2 starts: the D-GROVE placement frame (position, yaw; a unit test keeps it equal to the
 * layout). Original south-west corner restored 2026-10-11 (PO). Station-local metres: x points out of the
 * bays, z along the facade (the right bay with the L1 trigger at z -1.23); the interior is x -4.5..1.5, the apron 1.5..5.85.
 */
export const l2Station = { x: -77.0, z: 42.5, yaw: 0 } as const;
/** Station-local (x out of the bays, z along the facade) to world, same rotation as the layout placements. */
export const stationPoint = (lx: number, lz: number): P => [
  l2Station.x + lx * Math.cos(l2Station.yaw) + lz * Math.sin(l2Station.yaw), l2Station.z - lx * Math.sin(l2Station.yaw) + lz * Math.cos(l2Station.yaw)];
/** The engine waits east of the station apron, nose north toward Elm Street. */
const truck = { x: -68.8, z: 36.7, yaw: Math.PI / 2 } as const;
/** Truck-local (x forward, z to the right of the cab: east while the nose points north) to world. */
const truckPoint = (lx: number, lz: number): P => [truck.x + Math.cos(truck.yaw) * lx + Math.sin(truck.yaw) * lz, truck.z - Math.sin(truck.yaw) * lx + Math.cos(truck.yaw) * lz];
export const l2Truck = truck;

/** The courier stands 1.3 m out from the rack board (facade at x 1.5), clear of the apron bollard row (x ~2.15) that hid the ring from the game camera (PO 10-12). */
export const axeStandX = 2.85;
/** Named world points authored into the L2 layout copy (resolved through the ordinary mission anchor lookup). */
export const l2Anchors: Record<string, P> = {
  'l2-start': stationPoint(3.8, 2.7),   // on the apron in front of the left bay, clear of the centre pier and its bollards
  // Stand-to-interact point of the axe rack on the solid wall left of the left bay (z 5.0), 1.05 m out from the facade (see L2Props); the old spot hung on the centre pier in the bay opening.
  'l2-axe-rack': stationPoint(axeStandX, 5.0),
  'l2-truck': [truck.x, truck.z],
  // Crew door on the station side of the cab.
  'l2-board': truckPoint(.3, 2.0),
  // Two benches on the apron (never inside the bay, PO 10-12), two seats each: bench x + the seat's hipX .31, bench z -/+ .5.
  'l2-bench-1': stationPoint(3.31, -1.4), 'l2-bench-2': stationPoint(3.31, -2.4), 'l2-bench-3': stationPoint(3.31, -3.9), 'l2-bench-4': stationPoint(3.31, -4.9),
  'l2-crew-1': stationPoint(6.0, 3.1), 'l2-crew-2': stationPoint(4.6, 3.9), 'l2-crew-3': stationPoint(2.4, -.1), 'l2-crew-4': stationPoint(3.4, -.5),
  'l2-crew-5': truckPoint(-4.5, 3.6), 'l2-crew-6': stationPoint(5.4, -2.6),
  'l2-truck-stop': [-43.0, -32.0],
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
  'photo-l2-station-calm': stationPoint(4.5, 2.0), 'photo-l2-alarm': stationPoint(4.5, .5), 'photo-l2-truck-ride': [-30, 0],
  'photo-l2-doors-open': [-50, -40], 'photo-l2-collapse': [-48, -36], 'photo-l2-streets-w1': [-37.8, -35.0],
  'photo-l2-cluster': [49, 29], 'photo-l2-bridge-checkpoint': [78, 30],
};
/** What the crew look at while they wait (gear, the truck), and the alarm beacons above the two bays (x, z). */
export const l2StationLooks: readonly P[] = [stationPoint(6.4, 5.1), stationPoint(4.6, 5.1), stationPoint(3.4, -.5), stationPoint(2.4, -.1), [truck.x, truck.z], [truck.x, truck.z]];
export const l2Beacons: readonly P[] = [stationPoint(1.7, -3.1), stationPoint(1.7, 1.7)];
/** Right lane centres: east on Elm z=31.25, north on Juniper x=-28.75, west on Main Row z=-32.0.
 * Junction connectors are tangent circles (9 m centre radius / 10.7 m outer body radius). The station apron
 * connector has 6.2 m centre radius / 8.14 m outer body radius. All headings follow the path tangent.
 */
export type TruckPathPoint = { x: number; z: number; yaw: number; curvature: number; s: number; limit: number; section: 'apron' | 'elm' | 'juniper' | 'row' | 'junction' };
function truckPath(): TruckPathPoint[] {
  const path: TruckPathPoint[] = [];
  const add = (x: number, z: number, yaw: number, curvature: number, section: TruckPathPoint['section']) => {
    const prev = path.at(-1), s = prev ? prev.s + Math.hypot(x - prev.x, z - prev.z) : 0;
    const corner = section === 'apron' || section === 'junction';
    // Leave room for the Rapier rotation reconstruction at the fixed-step boundary.
    const limit = Math.min(corner ? l2.ride.cornerMs : l2.ride.cruiseMs, Math.abs(curvature) > .001 ? l2.ride.yawRateDegS * Math.PI / 180 / Math.abs(curvature) * .95 : Infinity);
    path.push({ x, z, yaw, curvature, s, limit, section });
  };
  const line = (ax: number, az: number, bx: number, bz: number, section: TruckPathPoint['section']) => {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / .1);
    for (let i = 1; i <= n; i++) add(ax + (bx - ax) * i / n, az + (bz - az) * i / n, -Math.atan2(bz - az, bx - ax), 0, section);
  };
  const arc = (cx: number, cz: number, r: number, a0: number, a1: number, section: TruckPathPoint['section']) => {
    const n = Math.ceil(Math.abs(a1 - a0) * r / .05), sign = Math.sign(a1 - a0);
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n, x = +(cx + Math.cos(a) * r).toFixed(10), z = +(cz + Math.sin(a) * r).toFixed(10);
      if (i === 0 && path.length) continue;
      add(x, z, -Math.atan2(Math.cos(a) * sign, -Math.sin(a) * sign), -sign / r, section);
    }
  };
  arc(-62.6, 36.7, 6.2, Math.PI, Math.PI * 1.5, 'apron');
  // Smoothly settle from the station apron into Elm's right lane, with zero slope and curvature at both ends.
  for (let i = 1; i <= 280; i++) {
    const t = i / 280, f = 10*t**3 - 15*t**4 + 6*t**5, d = .75/14 * (30*t**2 - 60*t**3 + 30*t**4), dd = .75/14**2 * (60*t - 180*t**2 + 120*t**3);
    add(-62.6 + t*14, 30.5 + .75*f, -Math.atan(d), -dd/(1+d*d)**1.5, 'elm');
  }
  line(-48.6, 31.25, -37.75, 31.25, 'elm');
  arc(-37.75, 22.25, 9, Math.PI/2, 0, 'junction');
  line(-28.75, 22.25, -28.75, -23.0, 'juniper');
  arc(-37.75, -23.0, 9, 0, -Math.PI/2, 'junction');
  line(-37.75, -32.0, -43, -32.0, 'row');
  // Backward braking envelope: each sample can reach the next sample's corner cap with <=4 m/s².
  path.at(-1)!.limit = 0;
  for (let i = path.length - 2; i >= 0; i--) path[i].limit = Math.min(path[i].limit, Math.sqrt(path[i+1].limit**2 + 2*l2.ride.brakeMs2*(path[i+1].s-path[i].s)));
  return path;
}
export const l2TruckPath: readonly TruckPathPoint[] = truckPath();
/** Sampled drivable polyline, used by layout clearance and spawn keep-out checks. */
export const l2TruckRoute: readonly P[] = l2TruckPath.map(p => [p.x, p.z]);
