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
    /** The squad: follow 2-6 m, engage within 18 m, stay within 20 m when not engaged, separated beyond 40 m. */
    squad: { size: 4, minFollowM: 2, maxFollowM: 6, engageM: 18, leashM: 20, separatedM: 40, separatedS: 3, moveMs: 4.8, slowerMs: .3, breakoutS: 12 },
    moveMs: 3.6,
  },
  /** Section 5.10: soldiers at the army checkpoint cover the last 20 m before the zone line. */
  soldiers: { count: 8, hp: 150, gun: { damage: 25, shotS: .45, rangeM: 26, nearM: 20, hitNear: .85, hitFar: .5 }, coverM: 20 },
  /** Section 5.3: each gunshot is a loud event for non-chasing infected within 20 m. */
  gunfire: { radiusM: 20, holdS: 6, minGapS: .5 },
  /** Section 5.6: pre-populated wanderers per segment (groups: x, street, size), forward pressure, caps. */
  density: {
    /** Spec defaults 10 / 25 / 40 (+-20 %); segment 3 sits at the top of the band (48 incl. the horde) so the squad is overwhelmed there. */
    targets: [10, 25, 48] as readonly number[],
    groups: [
      // S1 (x -126..-40): about 10, spread thin; the squad shoots most of them.
      [[-98, 'blvd', 2], [-84, 'oak', 2], [-70, 'commerce', 2], [-60, 'blvd', 2], [-48, 'oak', 2]],
      // S2 (x -40..50): about 25 in groups of 3-4 on the walking lines (wrecks and the jam split the Boulevard ones).
      [[-30, 'commerce', 4], [-22, 'blvd', 3], [-8, 'oak', 3], [2, 'commerce', 3], [10, 'blvd', 4], [22, 'oak', 3], [30, 'commerce', 3], [44, 'blvd', 2]],
      // S3 (x 50..128): about 40: one dense cluster per street (7) staggered along the corridor, plus groups between them.
      [[64, 'commerce', 8], [96, 'blvd', 8], [82, 'oak', 8], [56, 'blvd', 3], [104, 'commerce', 3], [112, 'oak', 3], [118, 'blvd', 3]],
    ] as readonly (readonly (readonly [number, 'blvd' | 'commerce' | 'oak', number])[])[],
    /** A segment is populated (out of view) once the player is this far before its start. */
    populateAheadM: 55,
    /** Segment 3 also holds the horde (part of its 48): two packs of 6 at the on-ramp end of two avenues (seeded), streaming west. */
    horde: { packSize: 6, fromX: 121, toX: 72 },
    leashM: 9,
    /** Side streets spill: a shot within `nearM` of a cross-link in S2/S3 brings `size[seg]` out of the doors along it. */
    spill: { links: [-55, -15, 40, 85] as readonly number[], nearM: 14, doorM: 16, size: [3, 5] as P, maxPerLink: 2, cooldownS: 18 },
    pressure: { idleS: 20, everyS: 10, count: [1, 3] as P, behindM: [15, 35] as P },
    /** Infected far behind the furthest progress line and out of view leave the director's books (cap headroom). */
    retireBehindM: 60,
    caps: { high: 80, low: 40 },
  },
  /** Section 5.7: medkits (+40 HP, capped, consumed). */
  medkits: {
    heal: 40,
    positions: [
      [-138.6, -6.6],                                   // armory
      [-88.2, 3.4], [-15.0, 3.4], [85.0, -3.4],          // Commerce Street (alley mouths)
      [-50.3, -24.0], [44.6, -24.2], [96.0, -32.2],      // Grove Boulevard
      [-50.4, 24.4], [35.6, 24.4], [110.0, 31.4],        // Oak Avenue
    ] as readonly P[],
  },
  /** Multiplier on the infected hit (L1: 10 per hit, 0.9 s cycle): the L2 value, the city's infected are as strong. */
  infectedDamage: 1.8,
  checkpoints: ['armory', 'fallback', 'segment-2', 'segment-3'] as const,
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
