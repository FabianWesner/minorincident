import type { InfectedSpecialMove } from '../../data/infected';

/** Serializable AI and crowd animation intent; all timers are fixed sim ticks. */
export interface InfectedState {
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
  destination?: { x: number; z: number };
  projectile?: { objectId: number; corpse: boolean; started: number; x: number; z: number; dx: number; dz: number; distance: number; range: number };
}
