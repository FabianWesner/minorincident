export interface Point { x: number; z: number }
export type CivilianState = 'calm' | 'alarmed' | 'flee' | 'hide' | 'grabbed' | 'bitten' | 'down' | 'rising' | 'infected' | 'finished';
/** Serializable NPC components; no render objects or physics bodies. */
export interface Civilian {
  state: CivilianState; ambient: boolean; adult: boolean; pet: 'dog' | 'cat' | null; owner: number | null;
  variant: string; routine: string; waypoints: Point[]; waypoint: number; pauseUntil: number;
  entered: number; until: number; downTicks: number; eyesGlow: boolean; veins: number;
  attacker: number; threat: Point; path: number[]; goal: number; pathIndex: number;
  gore: false; knockedUntil: number;
}
export interface Companion { state: 'follow' | 'fetch' | 'hide'; courage: number; until: number; barkAt: number; hurtAt: number; pickup: number | null; path: number[]; goal: number; pathIndex: number }
export interface Escort { state: 'follow' | 'wait' | 'cover' | 'downed' | 'dead'; order: 'follow' | 'wait'; child: boolean; gore: false; downedAt: number; progress: number; latched: boolean; path: number[]; goal: number; pathIndex: number; cover: Point | null; attackAt: number }
export interface Traffic { route: Point[]; segment: number; speed: number; desired: number; braking: number; stopped: boolean; panic: boolean }
export interface Convoy { route: Point[]; samples: Point[]; distance: number; length: number; state: 'stop' | 'go' | 'arrived' | 'destroyed'; speed: number; offset: number }
export type NpcEvent =
  | { tick: number; type: 'civilian.state'; id: number; state: CivilianState; until: number }
  | { tick: number; type: 'civilian.saved' | 'civilian.finished' | 'civilian.eyes'; id: number }
  | { tick: number; type: 'civilian.turned'; id: number; infectedId: number; variant: string; position: Point }
  | { tick: number; type: 'corgi.bark'; id: number; threatId: number; direction: Point }
  | { tick: number; type: 'corgi.fetched'; id: number; pickupId: number }
  | { tick: number; type: 'escort.order'; id: number; order: 'wait' | 'follow' }
  | { tick: number; type: 'escort.downed' | 'escort.revived'; id: number };
