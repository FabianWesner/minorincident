/**
 * Level 1 v2 tuning table (specs/epic-19-level-1-stop-the-outbreak.md, section 5 and AC). Data only: no imports, no
 * logic. Lanes read these numbers instead of hard-coding them. Units: metres, seconds, m/s, degrees.
 */
export const l1v2 = {
  /** Section 4 / AC04. */
  map: { widthM: 170, depthM: 110, axisCrossSecondsMin: 30, axisCrossSecondsMax: 45, axisCrossSecondsTarget: 38, losBlockerMaxGapM: 25, narrowPassageM: 2.5, minRoutesPerObjectivePair: 2, maxSharedRouteFraction: 0.3, returnLoopMaxRetraceM: 30 },
  /** Section 5.1 / AC05. */
  civilians: {
    countMin: 50, countMax: 60, groupSizeMax: 3, idleFacingNowhereMaxS: 3,
    noticeConeDeg: 140, noticeRangeM: 16, hearRadiusM: 12,
    /** ally-combat-feel: allied gunfire within this radius startles calm, unarmed people (the queue breaks up when the war starts). */
    gunfireM: 12,
    /** ...and hide this far from what is being shot at (crouching there), instead of running for a refuge. */
    hideM: 6,
    startleS: [0.3, 0.8], walkSpeed: [1.2, 1.5], fleeSpeed: [3.2, 4.0],
    grabS: 1.0, rescueWindowS: 1.0, transformS: 3.0, transformJitterS: 0.5,
    kidsMax: 2,
  },
  /** Sections 5.2 and 5.3 / AC08 to AC11. */
  infected: {
    visionConeDeg: 90, visionRangeM: 16, hearsPlayer: false, targetReevalS: 0.25, switchHysteresisM: 1.5, switchWithinS: 0.5,
    wanderSpeed: [1.0, 1.4], lungeRangeM: 2.5,
    search: { durationS: [10, 18], probePoints: [3, 6], probeRadiusM: [4, 12], doubleBackProb: 0.35, minStdS: 1.8 },
    attracted: { radiusM: 30, pointRadiusM: 3, extraS: [4, 8], arriveWithinM: 4, arriveWithinS: 12 },
    hp: 40, hitDamage: 10, attackCycleS: 0.9,
  },
  /** Section 5.4 / AC12. Speed = base * (1 +/- jitter), jitter seeded per entity. */
  speedTiers: {
    frail: { baseMs: 4.7, who: "elderly civilians, bathrobe neighbour" },
    average: { baseMs: 5.3, who: "adult civilians, lab staff, workers" },
    athletic: { baseMs: 5.6, who: "joggers, young adults, skater" },
    jitter: 0.04,
    /** PO 2026-10-07 ("not all on the same speed, so they don't arrive at the same moment"): a persistent per-entity
     * factor 1.04 - spread * u^skew (u uniform per spawn): most a bit slower than the tier base, a few at today's max
     * (base x 1.04), never above it; never below `minMs`. Plus a per-entity reaction delay on a fresh sighting, so a group
     * strings out instead of arriving together.
     * PO 2026-10-09 ("This one was running behind me (same speed; should be a bit faster than me)"): `minMs` 4.05 -> 4.4, so
     * a chaser is a bit faster than the running courier (4.5 m/s): means frail ~4.68 / average ~5.05 / athletic ~5.23 m/s
     * (all ~4.99), ~91 % of spawns above 4.5 m/s (was ~74 %), a few at 4.4-4.5 m/s; the spread (strung-out arrival) stays. */
    factor: { max: 1.04, spread: 0.28, skew: 1.4, minMs: 4.4, reactionS: [0, 0.4] },
    minShareAbovePlayerRun: 0.85,
    frailMinShareAbovePlayerRun: 0.8,
    closeTenMetresMaxS: 20,
  },
  /** Section 5.5 / AC13. */
  player: { runMs: 4.5, walkMs: 2.0, walkReleaseToRunS: 0.2, touchWalkStickBelow: 0.5, staminaInL1: false, hp: 100 },
  /** Section 5.6 / AC14. */
  combat: {
    unarmedDamage: [6, 6], unarmedHitsToKill: [6, 7], unarmedKnockbackM: [1.5, 2.5], unarmedStaggerS: 0.4,
    batDamage: 22, batFinisherDamage: 30, batHitsToKill: 2, batKnockbackM: [2.5, 3.5],
  },
  /** Section 5.8 / AC17. */
  corgi: { stiffenM: 20, growlM: 14, barkM: 9, barkIntervalS: 2, nervousS: 6, riderSpeedCapMs: 7.5 },
  /** Existing population caps; PO 10-10 adds authored street encounters after the accident. */
  director: { hordeMinInfectedNearGarage: 6, hordeLeaveGarageM: 5, hordeRadiusM: 35, capHigh: 60, capLow: 30, spawnFrustumMargin: 0.1 },
  /** Beat 9 house: `doorM` the front-door distance band from the garage door; the walk out lives in HouseEmergence. */
  house: { count: 10, staggerS: [1.5, 4], firstAfterS: 0.5, doorM: [6, 25] },
  /** PO 10-10: small groups across Juniper, the western loop and Larch, with shared Elm Street approaches to the restored station.
   * Planned as the courier leaves the Annex for the bat; only clear off-screen ground admits a resident. */
  street: {
    size: 3, leashM: 5,
    groups: [[14, 24], [14, 10], [-66, 38], [2, 30], [-14, 30],
      [-30, 24], [-30, 4], [-30, -16], [-38, 30],
      [50, 24], [66, 4], [50, -12], [-56, 30]],
  },
  /** Section 5.10 / AC16. */
  bicycle: { speedMs: 7.5, accelToMs: 7, accelS: 1.5, minTurnRadiusM: 2.5, mountInteractS: 0.4, damage: 0 },
  /** Section 5.11 / AC20. */
  toys: {
    yardGates: 3, gateSwingS: 0.4, dumpsters: 2, dumpsterPushM: [2, 3],
    carAlarm: { cars: 4, durationS: 20, rearmS: 30 },
    carWash: { durationS: 15, infectedSpeedFactor: 0.5 },
  },
  /** Section 3 beats 4 to 6 / AC07, AC19. */
  accident: {
    calmS: [4, 6], corgiWarnLeadS: 1.5, sequenceS: 8, blastShakeS: 1.5, ringingS: 1.2,
    exitDelayS: [8, 10], infectedCount: 5, minDistinctHeadings: 3, minHeadingSeparationDeg: 60,
    bitesWithinS: 60, killWithinS: 5, maxFrameMs: 50,
    /** Event offsets from the flicker (t = 0). */
    eventAtS: { flicker: 0, blast: 1.5, ringing: 1.7, smoke: 2.9, screams: 3.5, infectedExit: 9 },
  },
  /** Section 5.12 / AC21. */
  sound: { calmDropDb: 12, calmDropWithinS: 3, chaosCorrelationMin: 0.7, chaosMaxInfected: 30 },
  /** Section 9 bot gates (AC02, AC03, AC06). */
  bots: {
    seeds: 1, completeMedianS: [75, 180], newbieMinSeeds: 1, newbieMedianS: [90, 210], newbieMaxMedianDeaths: 1,
    idleSpread: { at120s: 15, at240s: 25, floorAt120s: 12, floorSeeds: 1, startCount: 5 },
  },
  /** Section 3 / AC24. */
  checkpoints: ["accident", "bat"] as const,
  perf: { civiliansAtMorning: 60, hordeInfected: 30 },
} as const;
export type L1v2Tuning = typeof l1v2;
