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
    frailMinShareAbovePlayerRun: 0.95,
    closeTenMetresMaxS: 20,
  },
  /** Section 5.5 / AC13. */
  player: { runMs: 4.5, walkMs: 2.0, walkReleaseToRunS: 0.2, touchWalkStickBelow: 0.5, staminaInL1: false, hp: 100 },
  /** Section 5.6 / AC14. */
  combat: {
    unarmedDamage: [9, 11], unarmedHitsToKill: [4, 5], unarmedKnockbackM: [1.5, 2.5], unarmedStaggerS: 0.4,
    batDamage: 22, batFinisherDamage: 30, batHitsToKill: 2, batKnockbackM: [2.5, 3.5],
  },
  /** Section 5.8 / AC17. */
  corgi: { stiffenM: 20, growlM: 14, barkM: 9, barkIntervalS: 2, nervousS: 6, riderSpeedCapMs: 7.5 },
  /**
   * Section 5.9 caps and the PO rule (2026-10-07): no director top-ups or streams. The only infected that enter the world
   * unbitten after the lab exits are `house.count` residents of ONE house near the garage, one by one through its door, when
   * the courier leaves the garage with the bat (beat 9). Growth from there is bites only.
   */
  director: { hordeMinInfectedNearGarage: 6, hordeLeaveGarageM: 5, hordeRadiusM: 35, capHigh: 60, capLow: 30, spawnFrustumMargin: 0.1 },
  house: { count: 10, staggerS: [1.5, 4], firstAfterS: 0.5, doorM: [6, 25], stumbleOutM: 2.2 },
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
    exitDelayS: [8, 10], infectedCount: 5, minExits: 2, minDistinctHeadings: 3, minHeadingSeparationDeg: 60,
    bitesWithinS: 60, killWithinS: 5, maxFrameMs: 50,
    /** Event offsets from the flicker (t = 0). */
    eventAtS: { flicker: 0, blast: 1.5, ringing: 1.7, smoke: 2.9, screams: 3.5, infectedExit: 9 },
  },
  /** Section 5.12 / AC21. */
  sound: { calmDropDb: 12, calmDropWithinS: 3, chaosCorrelationMin: 0.7, chaosMaxInfected: 30 },
  /** Section 9 bot gates (AC02, AC03, AC06). */
  bots: {
    seeds: 20, completeMedianS: [75, 180], newbieMinSeeds: 18, newbieMedianS: [90, 210], newbieMaxMedianDeaths: 1,
    idleSpread: { at120s: 15, at240s: 25, floorAt120s: 12, floorSeeds: 18, startCount: 5 },
  },
  /** Section 3 / AC24. */
  checkpoints: ["accident", "bat"] as const,
  perf: { civiliansAtMorning: 60, hordeInfected: 30 },
} as const;
export type L1v2Tuning = typeof l1v2;
