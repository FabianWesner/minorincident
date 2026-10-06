export interface Point { x: number; z: number }
export type CivilianState = 'calm' | 'annoyed' | 'alarmed' | 'flee' | 'hide' | 'grabbed' | 'bitten' | 'down' | 'rising' | 'infected' | 'finished';
export type CivilianProp = 'coffee' | 'bag' | 'phone' | 'cane' | 'watering-can';
/** Resolved layout anchors, in world metres. Durations and cursors use sim ticks and survive checkpoints. */
export interface CivilianActivity {
  activity: 'walk' | 'sit' | 'stand' | 'chat' | 'look' | 'water' | 'door' | 'inside';
  anchor: string; target: Point; ticks: number; facing?: Point; prop?: CivilianProp; seat?: Point;
}
/** Serializable NPC components; no render objects or physics bodies. */
export interface Civilian {
  state: CivilianState; ambient: boolean; adult: boolean; pet: 'dog' | 'cat' | null; owner: number | null;
  model?: string; variant: string; routine: string; waypoints: Point[]; waypoint: number; pauseUntil: number;
  /** Diner uses a short, jittered post-bite cycle; other E08 encounters retain their timing. */
  outbreak?: boolean; risingInfectedId?: number;
  entered: number; until: number; downTicks: number; eyesGlow: boolean; veins: number;
  attacker: number; threat: Point; path: number[]; goal: number; pathIndex: number;
  /** Harmless swing reaction; resumes the previous routine after a short pause. */
  annoyedFrom?: 'calm' | 'alarmed' | 'flee' | 'hide';
  gore: false; knockedUntil: number;
  panicReaction?: 'flee' | 'freeze';
  schedule?: CivilianActivity[]; scheduleStep?: number; activityUntil?: number; activityStarted?: number; lastTravelProgress?: number;
  /** L1 v2 panic layer (src/sim/outbreak): seeded speeds, startle length, chosen refuge door or edge. */
  l1?: { walkSpeed: number; fleeSpeed: number; startleTicks: number; refuge: string | null; target: Point | null; repickAt: number; noticed: number; faces?: (Point | null)[]; graceUntil?: number; progressAt?: number; progressFrom?: Point; doorAt?: number };
}
export interface Companion { following?: boolean; velocity?: Point; state: 'follow' | 'fetch' | 'hide'; courage: number; until: number; barkAt: number; hurtAt: number; pickup: number | null; path: number[]; goal: number; pathIndex: number;
  /** L1 v2 warning state (spec 5.8): highest stage reached for the current threat, and the nervous-idle end tick. */
  warn?: { stage: CorgiWarnStage; threat: number; nervousUntil: number } }
export type CorgiWarnStage = 'none' | 'stiffen' | 'growl' | 'bark' | 'nervous';
export interface Escort { state: 'follow' | 'wait' | 'cover' | 'downed' | 'dead'; order: 'follow' | 'wait'; child: boolean; gore: false; failed: boolean; downedAt: number; progress: number; latched: boolean; path: number[]; goal: number; pathIndex: number; cover: Point | null; attackAt: number }
export interface Traffic { route: Point[]; segment: number; speed: number; desired: number; braking: number; stopped: boolean; panic: boolean }
export interface Convoy { route: Point[]; samples: Point[]; distance: number; length: number; state: 'stop' | 'go' | 'arrived' | 'destroyed'; speed: number; offset: number }
export type NpcEvent =
  | { tick: number; type: 'civilian.bark'; id: number; text: 'Hey!'; position: Point }
  | { tick: number; type: 'civilian.state'; id: number; state: CivilianState; until: number }
  | { tick: number; type: 'civilian.saved' | 'civilian.finished' | 'civilian.eyes'; id: number }
  | { tick: number; type: 'civilian.turned'; id: number; infectedId: number; variant: string; position: Point }
  | { tick: number; type: 'corgi.bark'; id: number; threatId: number; direction: Point }
  | { tick: number; type: 'corgi.fetched'; id: number; pickupId: number }
  /** L1 v2 warning without UI text: stiffen (20 m), growl (14 m), bark (9 m, 1 per 2 s), then nervous idle (6 s). */
  | { tick: number; type: 'corgi.warn'; id: number; stage: Exclude<CorgiWarnStage, 'none'>; threatId: number; direction: Point; distance: number }
  | { tick: number; type: 'escort.order'; id: number; order: 'wait' | 'follow' }
  | { tick: number; type: 'escort.downed' | 'escort.revived'; id: number };
