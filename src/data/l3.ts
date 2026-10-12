/**
 * Level 3 "The Police Collapse" tuning table (specs/epic-21-level-3-the-police-collapse.md, section 5). Data only.
 * Coordinates are world metres on D-CORRIDOR (origin at the map centre, X east, Z south). The corridor runs west -> east:
 * the police bridgehead and station yard at the west end, the army checkpoint at the east end (layouts/D-CORRIDOR/layout.py).
 * Progress is the X coordinate. Times in seconds, speeds in m/s. Every number is read by the L3 controller, bots and tests.
 */
type P = readonly [number, number];
/** PO 2026-10-11: checkpoint compound translated east, preserving its internal layout. */
export const l3ArmyOffset = 76;
export const l3 = {
  /** Section 5.1: the corridor. Streets are E-W lines (z); segments are X ranges of the corridor proper. */
  map: {
    streets: { blvd: -28, commerce: 0, oak: 28 } as Record<'blvd' | 'commerce' | 'oak', number>,
    /** Corridor entrance (yard gate) -> On-ramp Road; S1 / S2 / S3 boundaries. */
    corridor: [-126, 128] as P, segments: [[-126, -40], [-40, 50], [50, 128]] as readonly P[],
    /** Entrance to the army compound; the rendezvous ring further inside ends the level. */
    zoneX: 140 + l3ArmyOffset, zoneZ: [-4.4, 4.4] as P,
    /** Station yard fence (the "inside" of the 8-inside fallback rule). */
    yard: { x0: -160, x1: -126, z0: -22, z1: 22 },
  },
  /** Beat 1-2: free movement, then the handgun at the armory table. The attack follows the pickup, or starts anyway. */
  armory: { interactS: .6, attackAfterS: 5, attackLatestS: 40, briefingAtS: 2 },
  /** Section 5.5: waves from three directions (river path, Boulevard, Oak Avenue); first-of fallback rule. */
  attack: {
    waves: [{ atS: 0, count: 30 }, { atS: 20, count: 60 }, { atS: 40, count: 100 }] as readonly { atS: number; count: number }[],
    fallback: { defenseS: 60, turned: 3, inside: 8 },
    /** Seconds between two emergences of one wave at one direction (they string out instead of a single blob). */
    staggerS: .1,
    lowScale: .5,
  },
  /** Section 5.4: allied fighters v2 (police with handguns, a following squad). */
  officers: {
    hp: 100,
    gun: { damage: 15, shotS: 1 / 1.5, rangeM: 22, nearM: 15, hitNear: .6, hitFar: .25 },
    /** The squad follows 3-8 m around/behind the courier; running beyond its band is a regroup order. */
    squad: { gun: { damage: 25, shotS: .35, rangeM: 22, nearM: 15, hitNear: .85, hitFar: .55 }, size: 4, minFollowM: 3, maxFollowM: 6, engageM: 18, leashM: 8, separatedM: 40, separatedS: 3, moveMs: 6.2, slowerMs: 0, breakoutS: 12 },
    moveMs: 3.6,
  },
  /** Section 5.10: soldiers at the army checkpoint cover the last 20 m before the zone line. */
  /** The riflemen use `gun` (spec rifles); the mounted gun is one HMG gunner (l4.soldiers.hmg, anchor l3-hmg) in the sandbag nest at the line. */
  soldiers: { deckY: 4.26, count: 8, hp: 150, gun: { damage: 25, shotS: .45, rangeM: 26, nearM: 20, hitNear: .85, hitFar: .5 }, coverM: 20 },
  /** Section 5.3: each gunshot is a loud event for non-chasing infected within 20 m. */
  gunfire: { radiusM: 20, holdS: 6, minGapS: .5 },
  /** Section 5.6: pre-populated wanderers per segment (groups: x, street, size), forward pressure, caps. */
  density: {
    /** PO 2026-10-12: five times every existing L3 encounter, including the previously increased street population. */
    streetMultiplier: 25,
    targets: [250, 625, 1000] as readonly number[],
    groups: [
      // S1 (x -126..-40): about 10, spread thin; the squad shoots most of them.
      [[-98, 'blvd', 2], [-84, 'oak', 2], [-70, 'commerce', 2], [-60, 'blvd', 2], [-48, 'oak', 2]],
      // S2 (x -40..50): about 25 in groups of 3-4 on the walking lines (wrecks and the jam split the Boulevard ones).
      [[-30, 'commerce', 4], [-22, 'blvd', 3], [-8, 'oak', 3], [2, 'commerce', 3], [10, 'blvd', 3], [22, 'oak', 3], [30, 'commerce', 3], [44, 'blvd', 2]],
      // S3 (x 50..128): about 40: one dense cluster per street (7) staggered along the corridor, plus groups between them.
      // PO 10-09: the clusters of 8 are two waves of 4 about 14 m apart (a lull to back off, take the medkit and set up), not one blob.
      [[146, 'commerce', 2], [174, 'commerce', 2], [199, 'commerce', 2], [62, 'commerce', 4], [76, 'commerce', 4], [86, 'commerce', 3], [92, 'blvd', 3], [80, 'blvd', 3], [58, 'blvd', 2], [70, 'oak', 4], [82, 'oak', 4], [92, 'oak', 3]],
    ] as readonly (readonly (readonly [number, 'blvd' | 'commerce' | 'oak', number])[])[],
    /** A segment is populated (out of view) once the player is this far before its start. */
    populateAheadM: 55,
    /** Segment 3 also holds the horde: two packs of 125 at the on-ramp end of two avenues (seeded), streaming west. */
    horde: { packSize: 125, fromX: 72, toX: 132 },
    leashM: 9,
    /** Side streets spill: a shot within `nearM` of a cross-link in S2/S3 brings `size[seg]` out of the doors along it. */
    spill: { links: [-55, -15, 40, 85] as readonly number[], nearM: 14, doorM: 16, size: [50, 75] as P, maxPerLink: 2, cooldownS: 18 },
    pressure: { idleS: 20, everyS: 10, count: [25, 75] as P, behindM: [15, 35] as P },
    /** Brief l3-finish (PO 10-12 "so they have a chance against the policeman group"): during the station attack, infected
     * choosing a target count the courier this many metres farther away, so the 5x waves press the police line first. */
    playerBiasM: 4,
    /** Infected far behind the furthest progress line and out of view leave the director's books (cap headroom). */
    retireBehindM: 35,
    caps: { high: 200, low: 100 },
  },
  /** Chase through the last 75 m: side-street packs follow the courier into the army line. */
  finale: { startX: 65, packs: [[72, 40], [94, 60], [116, 75]] as readonly P[], rescueX: 174, sources: [[163, -4], [163, -3], [163, -2], [165, -3], [165, -2], [165, -1], [167, -1.5], [167, 0], [167, 1.5]] as readonly P[], farSources: [[126, -3], [126, 0], [126, 3], [129, -3], [129, 0], [129, 3]] as readonly P[], chaseS: 90, surge: { stageX: 191, count: [25, 15] as P, maxWaitS: 12 }, streamS: [.8, .45, .2] as readonly number[], barrierX: 137.1 + l3ArmyOffset, passX: 138.2 + l3ArmyOffset, closeS: .7 },
  /** Section 5.7: medkits (+40 HP, capped, consumed). */
  medkits: {
    heal: 40,
    positions: [
      [-138.6, -6.6],
      // Visible sidewalks on every avenue; 30-35 m between packs, plus relief after the larger clusters.
      ...([-100, -66, -32, 2, 36, 60, 88, 108, 122] as const).flatMap(x =>
        ([-28, 0, 28] as const).map(z => [x === -100 && z === -28 ? x - 1 : x, z + ((x === -100 && z === -28) || (x === -66 && z === 0) || (x === 36 && z === 28) ? -1 : 1) * (z === -28 ? 4.4 : 3.4)] as const)),
      [147, 3.3], [178, -1.2], [201, -3.3],
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
  bots: { seeds: 1, completeMedianS: [120, 405] as P, newbieMedianS: [150, 270] as P, newbieMinSeeds: 1, newbieMaxMedianDeaths: 2 },
} as const;

/** Named world points authored into the L3 layout copy (resolved through the ordinary mission anchor lookup). */
export const l3Anchors: Record<string, P> = {
  'l3-start': [-155.5, 1.6],
  'l3-armory': [-139.2, -8.4],
  'l3-yard': [-142, 2],
  'l3-gate': [-127.5, 0],
  'l3-zone': [149 + l3ArmyOffset, 0],
  'l3-route': [-120, 0],
  'l3-sergeant': [-140.4, -5.6],
  // Squad (start near the armory) and the six yard posts behind sandbags at the gates.
  'l3-squad-1': [-141.6, -6.4], 'l3-squad-2': [-137.2, -6.0], 'l3-squad-3': [-138.4, -3.4], 'l3-squad-4': [-136.0, -8.8],
  'l3-post-1': [-131.2, -18.8], 'l3-post-2': [-129.0, -3.2], 'l3-post-3': [-129.0, 3.2], 'l3-post-4': [-131.2, 18.8], 'l3-post-5': [-156.6, -18.6], 'l3-post-6': [-144.0, 16.0],
  // Two riflemen on each of four checkpoint watchtower decks.
  'l3-soldier-1': [138.5, -8.25], 'l3-soldier-2': [138.5, -6.95],
  'l3-soldier-3': [138.5, 6.95], 'l3-soldier-4': [138.5, 8.25],
  'l3-soldier-5': [138.5, -18.65], 'l3-soldier-6': [138.5, -17.35],
  'l3-soldier-7': [138.5, 17.35], 'l3-soldier-8': [138.5, 18.65],
  'photo-l3-station-yard': [-140, 2], 'photo-l3-station-attack': [-141, -13], 'photo-l3-squad-strong': [-92, 0],
  'photo-l3-oak-avenue': [-22, 28], 'photo-l3-commerce-street': [8, 0], 'photo-l3-grove-boulevard': [18, -28],
  'photo-l3-alone': [96, 0], 'photo-l3-army-checkpoint': [146, 0],
  'l3-hmg': [144.0, -7.2],
};
for (const [name, point] of Object.entries(l3Anchors)) if (name.startsWith('l3-soldier-') || name === 'l3-hmg' || name === 'photo-l3-army-checkpoint') l3Anchors[name] = [point[0] + l3ArmyOffset, point[1]];
/** Photo spots (section 6): name and camera offset, same framing scale as the L2 spots. */
export const l3PhotoSpots: readonly (readonly [string, readonly [number, number, number]])[] = [
  ['l3-station-yard', [16, 20, 16]], ['l3-station-attack', [18, 22, 18]], ['l3-squad-strong', [16, 20, 16]], ['l3-oak-avenue', [18, 22, 18]],
  ['l3-commerce-street', [18, 22, 18]], ['l3-grove-boulevard', [14, 17, 14]], ['l3-alone', [16, 20, 16]], ['l3-army-checkpoint', [18, 22, 18]],
];
/** Street of a world point (nearest street line), for population, forced-street bots and dressing tests. */
export function l3Street(z: number): 'blvd' | 'commerce' | 'oak' { return z < -14 ? 'blvd' : z > 14 ? 'oak' : 'commerce'; }
/** Segment index (0..2) of an X coordinate inside the corridor, -1 before it, 3 past it. */
export function l3Segment(x: number): number { const s = l3.map.segments; return x < s[0][0] ? -1 : x < s[0][1] ? 0 : x < s[1][1] ? 1 : x < s[2][1] ? 2 : 3; }

/**
 * Police tactics for engaged officers (L2 bridge, L3 squad). PO 2026-10-09 (verbatim): "When they start to fight, they need to
 * move like real policemen would do, not standing still". Short steps while facing the threat, a baton strike at arm's length.
 */
export const policeTactics = {
  /** Immediate self-defence; longer-range acquisition still uses player camera framing. */
  defendM: 10,
  /** Backstep when an infected is closer than this; step length, step speed, step duration cap and the pause between steps. */
  backstepM: 3.2, stepM: 1.4, stepMs: 2.4, stepS: .8, stepEveryS: 1.6,
  /** Never further than this from the post (squad members follow the player instead). */
  leashM: 3,
  /** A teammate or the courier closer than this to the line of fire gets a sidestep; neighbours closer than spreadM spread out. */
  clearM: .6, spreadM: 1.5,
  /** A routine lateral reposition after this many shots. */
  repositionShots: 4,
  /** Baton: reach, damage, cycle, windup. */
  batonReachM: 1.5, batonDamage: 8, batonS: 1, batonWindupS: .3,
  /** The two-handed aim is held this long after the last shot. */
  aimHoldS: 2.5,
} as const;
