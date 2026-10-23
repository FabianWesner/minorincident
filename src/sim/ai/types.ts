import type { InfectedSpecialMove } from '../../data/infected';

/** Serializable AI and crowd animation intent; all timers are fixed sim ticks. */
export interface InfectedState {
  /** L10 authored regular Alpha ownership, serialized with the entity. */
  cureRegion?: import('../../levels/L10/alphaContracts').CureRegion;
  /** Entity-owned timers survive checkpoints and chunk serialization. */
  specialCooldowns?: Partial<Record<InfectedSpecialMove, number>>;
  specialAttack?: InfectedSpecialAttack;
  specialRecoveryUntil?: number;
  /** Fixed roar origin; convergence lasts 300 ticks, with an independent non-stacking speed boost. */
  roar?: { sourceId: number; attackId: number; x: number; z: number; until: number; speedScale?: number; speedUntil?: number };
  state: 'idle' | 'wander' | 'alerted' | 'chase' | 'attack' | 'stagger' | 'dead' | 'migration' | 'scatter' | 'search' | 'attracted' | 'bite';
  vault?: { started: number; from: { x: number; z: number }; to: { x: number; z: number }; height: number };
  pathGrid: number; grabNextTick: number;
  combo: number;
  targetId: number;
  /** Human acquired by close hearing in the archetype brain (targetId is reserved for obstacles). */
  heardTargetId?: number;
  /** L5 Alpha investigates a heard burst position until `until`, without acquiring a human through cover. */
  investigate?: { x: number; z: number };
  /** Story-director walk (L4 collapse Alphas): path to this point (grid A*, not the courier flow field) and ignore targets until cleared. */
  scripted?: { x: number; z: number };
  /** L4's bounded walk off the escape street; released after crossing its edge or the window ends. */
  clearingStreet?: true;
  /** E32 Mega Alpha: movement owned by MegaPursuit (no sight, hearing or lure); survives checkpoints with the entity. */
  pursuit?: true;
  /** Mega local notice cue; global pursuit still owns the courier target. */
  proximityNotice?: { id: number; until: number };
  /** Mega hit bookkeeping is bounded, serializable and shared by every weapon/status. */
  megaStaggerReady?: number;
  megaRocketIds?: number[];
  /** Courier/companion hit memory, refreshed on damage. Archetype brains pursue the source; vision brains receive one hit-time move. */
  provoked?: { id: number; until: number };
  /** Authored encounter boundary for heavy infected; preserved through checkpoints. */
  territory?: { x: number; z: number; radius: number };
  activeUntil: number;
  speed: number; until: number; cooldown: number; attackId: number; special: string; hidden: boolean;
  deadAt: number;
  /** PO "Infected recover": tick at which a knocked-down infected gets up again; -1 = alive or dead for good. `downs` counts its knockdowns. */
  recoverAt: number; downs: number;
  revived: boolean; reviveUsed: boolean; legLost: boolean; detached: boolean;
  birdMotion?: import('../locomotion/MotionResponse').MotionResponse[];
  birdVertical?: import('../locomotion/MotionResponse').MotionResponse[];
  pack: number; packIndex: number; birds: number; birdPositions: number[]; birdAlive: number[]; scatterUntil: number;
  birdDeadMask?: number;
  /** Scheduled civilians retain their exact silhouette and clothes after turning. */
  model?: string;
  variant: string; path: number[]; pathIndex: number; goal: number; dx: number; dz: number;
  grabHits: number; grabUntil: number; grabX: number; grabZ: number; perched: boolean;
  /** L1 v2 vision/search brain (specs/epic-19 sections 5.2-5.4); absent outside L1. */
  l1?: import('./Search').L1Brain;
}

export interface InfectedSpecialAttack {
  move: InfectedSpecialMove; attackId: number;
  stage: 'telegraph' | 'active' | 'recovery';
  startTick: number; activeTick: number; cooldownExpiry: number; recoveryUntil: number;
  target: { id: number; x: number; z: number };
  area: { x: number; z: number; radius: number; dx: number; dz: number };
  hitIds: number[];
  /** Existing herd/flock participants; followers keep their own cooldown and attack id. */
  members?: number[]; leaderId?: number; impactTick?: number; obstructionUntil?: number;
  grabbedId?: number; grabReleaseTick?: number;
  destination?: { x: number; z: number };
  projectile?: { objectId: number; corpse: boolean; started: number; x: number; z: number; dx: number; dz: number; distance: number; range: number };
}
