import { survivor } from './survivor';

/**
 * E32 §5.4 Mega Alpha pursuit (lane L10-S3). PO 2026-10-13, verbatim: "The Mega Alpha always knows approximately where the player is.
 * Unlike normal zombies, it does not rely on normal sight rules. It constantly follows the player. However, its normal movement speed is
 * only around 70% of the player's running speed. This means the player can stay ahead of it. The player can never permanently escape it.
 * It is always coming."
 * Distances in metres, times in seconds unless a name says ticks. Orchestrator defaults, changeable after measurement.
 */
export const megaAlpha = {
  /** It is an Alpha (shared E07 bar, resistance table and special scheduler) drawn with the ≈2× derived hero model. */
  archetype: 'infected.alpha',
  asset: 'inf.mega-alpha',
  /** Cruise = 0.7 × the nominal uninjured run (survivor.speed), never a momentary walk/slow speed. */
  cruiseFactor: 0.7,
  get cruiseMs(): number { return survivor.speed * this.cruiseFactor; },
  /** Placeholder mission HP until L10-S4 applies the rocket/conventional floors through the Damage resolver. */
  hp: 3000,
  /** Body/nav footprint = the shared nav clearance, so every baked route it plans is one it fits through. */
  radius: 0.65,
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
