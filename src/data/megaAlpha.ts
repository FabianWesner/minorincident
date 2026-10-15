import { survivor } from './survivor';

/**
 * E32 §5.4 Mega Alpha pursuit (lane L10-S3). PO 2026-10-13, verbatim: "The Mega Alpha always knows approximately where the player is.
 * Unlike normal zombies, it does not rely on normal sight rules. It constantly follows the player. However, its normal movement speed is
 * only around 70% of the player's running speed. This means the player can stay ahead of it. The player can never permanently escape it.
 * It is always coming."
 * Distances in metres, times in seconds unless a name says ticks. Orchestrator defaults, changeable after measurement.
 */
export const megaAlpha = {
  /** It is an Alpha (shared E07 bar, resistance table and special scheduler) drawn with the derived hero model: same height and footprint as the Alpha (PO 10-15), heavier and darker. */
  archetype: 'infected.alpha',
  asset: 'inf.mega-alpha',
  /** Cruise = 0.7 × the nominal uninjured run (survivor.speed), never a momentary walk/slow speed. */
  cruiseFactor: 0.7,
  get cruiseMs(): number { return survivor.speed * this.cruiseFactor; },
  /** E32-AC12: ten direct rockets, independent of stock Alpha resistance/upgrades. */
  hp: 3000,
  conventionalFloor: .9,
  directRocketFraction: .1,
  splashRocketFraction: .025,
  staggerTicks: 30,
  staggerCooldownTicks: 120,
  recoveryTicks: 72,
  /** Conservative animated arm envelope (body 0.55 + oversized arm and fist reach; was 3.4 for the 2x body); specials never begin or travel inside solid cover. */
  specialClearance: 2,
  moves: {
    'alpha.charge': { windup: 48, cooldown: 360, damage: 25, radius: 1, range: 10, speed: survivor.speed * 1.6, activeTicks: 60 },
    'alpha.ground-slam': { windup: 60, cooldown: 480, damage: 35, radius: 3 },
    'alpha.grab-throw': { windup: 48, cooldown: 600, damage: 30, radius: 1.5, holdTicks: 60 },
  },
  /** Body, hit and nav footprint (the Alpha's 0.55 m since PO 10-15; was 1.1 for the 2x body). Its own nav grid is baked at this clearance, so it plans only routes its
   * legs and shoulders fit through; on a grid larger than `ownGridMaxCells` it shares the 0.65 m crowd grid instead. */
  radius: .55,
  ownGridMaxCells: 2_000_000,
  /** Coarse route refresh: the "approximate" player position and the off-region advance run at 2 Hz. */
  routeTicks: 30,
  /** Inside this the shared Alpha chase brain (contact, barricade breach, special scheduler) takes the ticks. */
  closeM: 12,
  /** Beyond this, detailed steering heads for the next authored route node instead of the player (bounded A*). */
  directM: 60,
  /** A node counts as passed inside this radius. */
  nodeReachM: 3,
  /** Introduction: first R1 viewpoint at 1:30, ≥ 80 m behind along a reachable route (E32 §5.4). */
  introduceS: 90,
  startBehindM: 80,
  /** Checkpoint/respawn fairness: a restored Mega stands at least this far from the restored player. */
  respawnGapM: 60,
  /** Stuck detection: less than `progressM` of travel over `windowS` while free to move escalates one recovery level. */
  stuck: { windowS: 2, progressM: 0.6, clearS: 3 },
  /** An authored link reported blocked stays avoided this long; with no alternate the Mega breaches it after `breachS`. */
  blockedLinkS: 20,
  breachS: 4,
  /** E32 §5.5 proximity bands (audio and minimap ring read these; no bearing). */
  bands: { distantM: 200, nearM: 80 },
} as const;
