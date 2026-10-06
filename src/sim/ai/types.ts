/** Serializable AI and crowd animation intent; all timers are fixed sim ticks. */
export interface InfectedState {
  state: 'idle' | 'wander' | 'alerted' | 'chase' | 'attack' | 'stagger' | 'dead' | 'migration' | 'scatter' | 'search' | 'attracted' | 'bite';
  pathGrid: number; grabNextTick: number;
  combo: number;
  targetId: number;
  activeUntil: number;
  speed: number; until: number; cooldown: number; attackId: number; special: string; hidden: boolean;
  deadAt: number; revived: boolean; reviveUsed: boolean; legLost: boolean; detached: boolean;
  pack: number; packIndex: number; birds: number; birdPositions: number[]; birdAlive: number[]; scatterUntil: number;
  variant: string; path: number[]; pathIndex: number; goal: number; dx: number; dz: number;
  grabHits: number; grabUntil: number; grabX: number; grabZ: number; perched: boolean;
  /** L1 v2 vision/search brain (specs/epic-19 sections 5.2-5.4); absent outside L1. */
  l1?: import('./Search').L1Brain;
}
