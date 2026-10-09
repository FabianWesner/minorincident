/**
 * Level 3 "The Police Collapse" tuning table (specs/epic-21-level-3-the-police-collapse.md, section 5). Data only.
 * Coordinates are world metres on D-CORRIDOR (origin at the map centre, X east, Z south). The corridor runs west -> east:
 * the police bridgehead and station yard at the west end, the army checkpoint at the east end (layouts/D-CORRIDOR/layout.py).
 * Progress is the X coordinate. Times in seconds, speeds in m/s. Every number is read by the L3 controller, bots and tests.
 */
type P = readonly [number, number];
export const l3 = {
  /** Section 5.1: the corridor. Streets are E-W lines (z); segments are X ranges of the corridor proper. */
  map: {
    streets: { blvd: -28, commerce: 0, oak: 28 } as Record<'blvd' | 'commerce' | 'oak', number>,
    /** Corridor entrance (yard gate) -> On-ramp Road; S1 / S2 / S3 boundaries. */
    corridor: [-126, 128] as P, segments: [[-126, -40], [-40, 50], [50, 128]] as readonly P[],
    /** The army zone line: crossing it (x >= zoneX inside the checkpoint lane) ends the level. */
    zoneX: 140, zoneZ: [-4.4, 4.4] as P,
    /** Station yard fence (the "inside" of the 8-inside fallback rule). */
    yard: { x0: -160, x1: -126, z0: -22, z1: 22 },
  },
  /** Beat 1-2: free movement, then the handgun at the armory table. The attack follows the pickup, or starts anyway. */
  armory: { interactS: .6, attackAfterS: 5, attackLatestS: 40, briefingAtS: 2 },
  /** Section 5.5: waves from three directions (river path, Boulevard, Oak Avenue); first-of fallback rule. */
  attack: {
    waves: [{ atS: 0, count: 6 }, { atS: 20, count: 12 }, { atS: 40, count: 20 }] as readonly { atS: number; count: number }[],
    fallback: { defenseS: 60, turned: 3, inside: 8 },
    /** Seconds between two emergences of one wave at one direction (they string out instead of a single blob). */
    staggerS: .5,
    lowScale: .5,
  },
  /** Section 5.4: allied fighters v2 (police with handguns, a following squad). */
  officers: {
    hp: 100,
    gun: { damage: 15, shotS: 1 / 1.5, rangeM: 22, nearM: 15, hitNear: .6, hitFar: .25 },
    /** The squad follows 3-8 m around/behind the courier; running beyond its band is a regroup order. */
    squad: { size: 4, minFollowM: 3, maxFollowM: 6, engageM: 18, leashM: 8, separatedM: 40, separatedS: 3, moveMs: 6.2, slowerMs: 0, breakoutS: 12 },
    moveMs: 3.6,
  },
  /** Section 5.10: soldiers at the army checkpoint cover the last 20 m before the zone line. */
  soldiers: { count: 8, hp: 150, gun: { damage: 25, shotS: .45, rangeM: 26, nearM: 20, hitNear: .85, hitFar: .5 }, coverM: 20 },
  /** Section 5.3: each gunshot is a loud event for non-chasing infected within 20 m. */
  gunfire: { radiusM: 20, holdS: 6, minGapS: .5 },
  /** Section 5.6: pre-populated wanderers per segment (groups: x, street, size), forward pressure, caps. */
  density: {
    /** PO 10-09: five times the street population; yard attack values above stay unchanged. */
    streetMultiplier: 5,
    targets: [50, 125, 200] as readonly number[],
    groups: [
      // S1 (x -126..-40): about 10, spread thin; the squad shoots most of them.
      [[-98, 'blvd', 2], [-84, 'oak', 2], [-70, 'commerce', 2], [-60, 'blvd', 2], [-48, 'oak', 2]],
      // S2 (x -40..50): about 25 in groups of 3-4 on the walking lines (wrecks and the jam split the Boulevard ones).
      [[-30, 'commerce', 4], [-22, 'blvd', 3], [-8, 'oak', 3], [2, 'commerce', 3], [10, 'blvd', 3], [22, 'oak', 3], [30, 'commerce', 3], [44, 'blvd', 2]],
      // S3 (x 50..128): about 40: one dense cluster per street (7) staggered along the corridor, plus groups between them.
      // PO 10-09: the clusters of 8 are two waves of 4 about 14 m apart (a lull to back off, take the medkit and set up), not one blob.
      [[62, 'commerce', 4], [76, 'commerce', 4], [86, 'commerce', 3], [92, 'blvd', 3], [80, 'blvd', 3], [58, 'blvd', 2], [70, 'oak', 4], [82, 'oak', 4], [92, 'oak', 3]],
    ] as readonly (readonly (readonly [number, 'blvd' | 'commerce' | 'oak', number])[])[],
    /** A segment is populated (out of view) once the player is this far before its start. */
    populateAheadM: 55,
    /** Segment 3 also holds the horde: two packs of 25 at the on-ramp end of two avenues (seeded), streaming west. */
    horde: { packSize: 25, fromX: 72, toX: 132 },
    leashM: 9,
    /** Side streets spill: a shot within `nearM` of a cross-link in S2/S3 brings `size[seg]` out of the doors along it. */
    spill: { links: [-55, -15, 40, 85] as readonly number[], nearM: 14, doorM: 16, size: [10, 15] as P, maxPerLink: 2, cooldownS: 18 },
    pressure: { idleS: 20, everyS: 10, count: [5, 15] as P, behindM: [15, 35] as P },
    /** Infected far behind the furthest progress line and out of view leave the director's books (cap headroom). */
    retireBehindM: 35,
    caps: { high: 80, low: 40 },
  },
  /** Chase through the last 75 m: side-street packs follow the courier into the army line. */
  finale: { startX: 65, packs: [[72, 8], [94, 12], [116, 15]] as readonly P[], chaseS: 40, barrierX: 137.1, passX: 138.2, closeS: .7 },
  /** Section 5.7: medkits (+40 HP, capped, consumed). */
  medkits: {
    heal: 40,
    positions: [
      [-138.6, -6.6],
      // Visible sidewalks on every avenue; 30-35 m between packs, plus relief after the larger clusters.
      ...([-100, -66, -32, 2, 36, 60, 88, 108, 126] as const).flatMap(x =>
        ([-28, 0, 28] as const).map(z => [x, z + ((x === -66 && z === 0) || (x === 36 && z === 28) ? -3.4 : 3.4)] as const)),
    ] as readonly P[],
  },
  /** Multiplier on the infected hit (L1: 10 per hit, 0.9 s cycle): PO 10-09: was 1.8 (the L2 value), too punishing; 1.1 still hits harder than L1 but a straight-line player survives a few bites. */
  infectedDamage: 1.1,
  /**
   * PO 10-09: a courier who keeps dying at one spot is not meant to hit the same wall for 20 deaths. From the `fromDeaths`-th death at the same checkpoint on,
   * every respawn thins the infected (living or still waiting at their doors) between `aheadM` metres ahead of the courier by
   * `stepFrac` per death (max `maxFrac`). Hordes and density stay for anyone who plays it through; only a death loop eases.
   */
  mercy: { fromDeaths: 2, stepFrac: .25, maxFrac: .75, aheadM: [12, 90] as P },
  checkpoints: ['armory', 'fallback', 'segment-2', 'segment-2b', 'segment-3', 'segment-3b'] as const,
  /** Corridor checkpoints by progress X (taken at the first calm moment after the courier passes the line, see LevelThreeCollapse.calmCheckpoint). */
  checkpointAt: { 'segment-2': -40, 'segment-2b': 8, 'segment-3': 50, 'segment-3b': 92 } as Record<string, number>,
  /** Bots (section 8). Bands are provisional until the first green 20-seed run (staging decision section 6). */
  bots: { seeds: 20, completeMedianS: [120, 225] as P, newbieMedianS: [150, 270] as P, newbieMinSeeds: 18, newbieMaxMedianDeaths: 2 },
} as const;

/** Named world points authored into the L3 layout copy (resolved through the ordinary mission anchor lookup). */
export const l3Anchors: Record<string, P> = {
  'l3-start': [-155.5, 1.6],
  'l3-armory': [-139.2, -8.4],
  'l3-yard': [-142, 2],
  'l3-gate': [-127.5, 0],
  'l3-zone': [141.5, 0],
  'l3-sergeant': [-140.4, -5.6],
  // Squad (start near the armory) and the six yard posts behind sandbags at the gates.
  'l3-squad-1': [-141.6, -6.4], 'l3-squad-2': [-137.2, -6.0], 'l3-squad-3': [-138.4, -3.4], 'l3-squad-4': [-136.0, -8.8],
  'l3-post-1': [-131.2, -18.8], 'l3-post-2': [-129.0, -3.2], 'l3-post-3': [-129.0, 3.2], 'l3-post-4': [-131.2, 18.8], 'l3-post-5': [-156.6, -18.6], 'l3-post-6': [-144.0, 16.0],
  // Soldiers behind the T-walls and the nests of the army checkpoint.
  'l3-soldier-1': [139.0, -7.6], 'l3-soldier-2': [139.0, 7.6], 'l3-soldier-3': [139.0, -13.0], 'l3-soldier-4': [139.0, 13.0],
  'l3-soldier-5': [149.0, -7.0], 'l3-soldier-6': [149.0, 7.0], 'l3-soldier-7': [152.0, -2.4], 'l3-soldier-8': [139.0, -20.0],
  'photo-l3-station-yard': [-140, 2], 'photo-l3-station-attack': [-141, -13], 'photo-l3-squad-strong': [-92, 0],
  'photo-l3-oak-avenue': [-22, 28], 'photo-l3-commerce-street': [8, 0], 'photo-l3-grove-boulevard': [18, -28],
  'photo-l3-alone': [96, 0], 'photo-l3-army-checkpoint': [146, 0],
};
/** Photo spots (section 6): name and camera offset, same framing scale as the L2 spots. */
export const l3PhotoSpots: readonly (readonly [string, readonly [number, number, number]])[] = [
  ['l3-station-yard', [16, 20, 16]], ['l3-station-attack', [18, 22, 18]], ['l3-squad-strong', [16, 20, 16]], ['l3-oak-avenue', [18, 22, 18]],
  ['l3-commerce-street', [18, 22, 18]], ['l3-grove-boulevard', [14, 17, 14]], ['l3-alone', [16, 20, 16]], ['l3-army-checkpoint', [18, 22, 18]],
];
/** Street of a world point (nearest street line), for population, forced-street bots and dressing tests. */
export function l3Street(z: number): 'blvd' | 'commerce' | 'oak' { return z < -14 ? 'blvd' : z > 14 ? 'oak' : 'commerce'; }
/** Segment index (0..2) of an X coordinate inside the corridor, -1 before it, 3 past it. */
export function l3Segment(x: number): number { const s = l3.map.segments; return x < s[0][0] ? -1 : x < s[0][1] ? 0 : x < s[1][1] ? 1 : x < s[2][1] ? 2 : 3; }
