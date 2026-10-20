export type ZooSpecies = 'lion' | 'gorilla' | 'elephant' | 'zebra' | 'flamingo';
export interface Point { x: number; z: number }
export type CivilianState = 'calm' | 'annoyed' | 'alarmed' | 'flee' | 'hide' | 'grabbed' | 'bitten' | 'down' | 'rising' | 'infected' | 'finished';
export type CivilianProp = 'coffee' | 'bag' | 'phone' | 'cane' | 'watering-can' | 'parcel'
  /** E22 weapons of soldiers and armed civilians (code art in RoutineProps, dropped when the bearer turns). */
  | 'rifle' | 'pistol' | 'shotgun' | 'hunting-rifle' | 'pipe' | 'bat' | 'crowbar';
/** Resolved layout anchors, in world metres. Durations and cursors use sim ticks and survive checkpoints. */
export interface CivilianActivity {
  activity: 'walk' | 'sit' | 'stand' | 'chat' | 'look' | 'water' | 'door' | 'inside';
  anchor: string; target: Point; ticks: number; facing?: Point; prop?: CivilianProp; seat?: Point;
  /** Render-only: raises a seated model so its hip joint rests on the seat anchor (see seats.ts). */
  seatLift?: number;
  /** Binding to the physics prop the sitter sits on (PropSystem item id) and the seat's offset from the prop's home pose: set lazily by followSeat. `''` = no movable prop under the seat. */
  seatProp?: string; seatRel?: [number, number, number]; seatRef?: { p: number[]; q: number[] };
}
/** Serializable NPC components; no render objects or physics bodies. */
export interface Civilian {
  /** Fixed support for a stationary guard on an authored raised platform, in world metres. */
  floorY?: number;
  /** Stair entry: support the body on the higher tread under either walking foot. */
  supportFeet?: boolean;
  zooAnimal?: ZooSpecies;
  state: CivilianState; ambient: boolean; adult: boolean; pet: 'dog' | 'cat' | null; owner: number | null;
  model?: string; variant: string; routine: string; waypoints: Point[]; waypoint: number; pauseUntil: number;
  /** Story beat presentation (render-only): a scripted clip from `start` and an optional hand prop. */
  story?: { clip: string; start: number; prop?: CivilianProp } | null;
  /** Diner uses a short, jittered post-bite cycle; other E08 encounters retain their timing. */
  outbreak?: boolean; risingInfectedId?: number;
  entered: number; until: number; downTicks: number; eyesGlow: boolean; veins: number;
  attacker: number; threat: Point; path: number[]; goal: number; pathIndex: number;
  /** Harmless swing reaction; resumes the previous routine after a short pause. */
  annoyedFrom?: 'calm' | 'alarmed' | 'flee' | 'hide';
  gore: false; knockedUntil: number;
  /** Siren: walk to this kerb point and wait, then resume the existing routine. */
  vehicleYield?: { target: Point; until: number };
  /** Direct attack/release reaction; persisted through checkpoints. */
  dangerUntil?: number;
  panicReaction?: 'flee' | 'freeze';
  schedule?: CivilianActivity[]; scheduleStep?: number; activityUntil?: number; activityStarted?: number; lastTravelProgress?: number;
  /** L1 v2 panic layer (src/sim/outbreak): seeded speeds, startle length, chosen refuge door or edge. */
  /** E20 §5.2 allied fighter: a live, biteable human who engages visible infected instead of fleeing (no immunity). */
  ally?: AllyState;
  /** E23 survivor (Dale, Rosa, Okafor, Mia, Sam): hidden at a hiding place until found, then follows the player (biteable; may collect one ground firearm). */
  survivor?: SurvivorState;
  l1?: { walkSpeed: number; fleeSpeed: number; startleTicks: number; refuge: string | null; target: Point | null; repickAt: number; noticed: number; faces?: (Point | null)[]; graceUntil?: number; progressAt?: number; progressFrom?: Point; doorAt?: number;
    /** E20 rescued people: flee along a street route to a safe spot (the bridge checkpoint) instead of a refuge; never removed. */
    haven?: { route: Point[]; leg: number; x: number; z: number; sx?: number; sz?: number; since?: number; cower?: { x: number; z: number } } };
}
/** Serializable E23 survivor state. `leader` = entity id it follows in single file (the player or the follower ahead); ticks are sim ticks. */
export interface SurvivorState { key: string; mode: 'hidden' | 'follow'; slot: number; leader: number; cover: boolean; fearUntil?: number; waitAt: number; foundAt: number }
/** E21 allied fighters v2: a handgun/rifle with a distance-dependent hit chance (one target per shot, no ammunition). */
export interface AllyGun { damage: number; shotS: number; rangeM: number; nearM: number; hitNear: number; hitFar: number }
/** Serializable allied-fighter task state (firefighters in L2, police from L3, soldiers at the L3 army checkpoint). Ticks are sim ticks. */
export interface AllyState {
  role: 'firefighter' | 'officer' | 'soldier' | 'civilian';
  /** E22 allied fighters v3: what the shooter carries (audio/tracer look; `hmg` crews a nest), improvised melee of an armed civilian, and the flight timer of one that panics. */
  /** Original pickup identity, retained in campaign survivor snapshots. */
  actionId?: string;
  aimMoveAt?: number; aimMoveRestUntil?: number;
  weapon?: 'hmg' | 'rifle' | 'pistol' | 'shotgun' | 'hunting-rifle';
  melee?: { damage: number; reachM: number; swingS: number };
  panicUntil?: number;
  /** v2 firearm (officers and soldiers from L3); without it officers keep the L2 v1 values. */
  gun?: AllyGun;
  /** v2 squad: follow this entity (the player) at 2-6 m, engage within `engageM`, never more than `leashM` away when engaged. */
  follow?: { targetId: number; slot: number; minM: number; maxM: number; engageM: number; leashM: number; moveMs: number; breakoutUntil?: number };
  /** v2 cover zone: only infected within `range` of this point are engaged (the soldiers' last 20 m before the zone line). */
  cover?: Point;
  /** Engaged allies fight what they see; disengaged ones follow their routine or `run` order. */
  engaged: boolean;
  /** Scripted move (run to the truck, jog to a door); cleared on arrival. */
  run: Point | null; runSpeed: number;
  /** Regroup / hold point; officers never leave it. */
  post: Point | null; hold: boolean;
  /** Officers: acquisition radius around the post (the line), raised while covering an evacuee. */
  range?: number;
  targetId: number; nextAttack: number; hits: number;
  /** Swing/shot in progress: lands at `strikeAt` on `strikeTarget` if still in reach. */
  strikeAt?: number; strikeTarget?: number;
  /** Police tactics (PO 2026-10-09): a short reposition (backstep, sidestep, spread) in progress, the earliest tick for the next one, the shot count of the last routine reposition, and a baton strike in progress. */
  step?: { x: number; z: number; until: number }; stepAfter?: number; repoHits?: number; baton?: boolean;
  /** Door forcing beat until this tick (halligan pry clip, or `forceClip`: the crew member directing the people inside). */
  forceUntil: number; forceClip?: string;
  /** ally-combat-feel: shots since the last reload and in the current burst, the reload and hit-flinch ends, health last tick,
   * where and since when the fighter stands on one spot, and its last call-out. */
  mag?: number; burstN?: number; reloadUntil?: number; flinchUntil?: number; lastHp?: number; still?: { x: number; z: number; tick: number }; calloutAt?: number; blockedAt?: number;
}
export interface Companion { transitionUntil?: number; following?: boolean; velocity?: Point; state: 'follow' | 'fetch' | 'hide'; courage: number; until: number; barkAt: number; hurtAt: number; pickup: number | null; path: number[]; goal: number; pathIndex: number;
  /** L1 v2 warning state (spec 5.8): highest stage reached for the current threat, and the nervous-idle end tick. */
  warn?: { stage: CorgiWarnStage; threat: number; nervousUntil: number } }
export type CorgiWarnStage = 'none' | 'stiffen' | 'growl' | 'bark' | 'nervous';
export interface Escort { state: 'follow' | 'wait' | 'cover' | 'downed' | 'dead'; order: 'follow' | 'wait'; child: boolean; gore: false; failed: boolean; downedAt: number; knockedUntil?: number; progress: number; latched: boolean; path: number[]; goal: number; pathIndex: number; cover: Point | null; attackAt: number }
export interface Traffic { yieldUntil?: number; route: Point[]; segment: number; speed: number; desired: number; braking: number; stopped: boolean; panic: boolean }
export interface Convoy { route: Point[]; samples: Point[]; distance: number; length: number; state: 'stop' | 'go' | 'arrived' | 'destroyed'; speed: number; offset: number }
export type NpcEvent =
  | { tick: number; type: 'civilian.bark'; id: number; text: 'Hey!'; position: Point }
  | { tick: number; type: 'civilian.state'; id: number; state: CivilianState; until: number }
  | { tick: number; type: 'civilian.saved' | 'civilian.finished' | 'civilian.eyes'; id: number }
  | { tick: number; type: 'civilian.turned'; id: number; infectedId: number; variant: string; position: Point }
  | { tick: number; type: 'corgi.bark'; id: number; threatId: number; direction: Point }
  | { tick: number; type: 'corgi.fetched'; id: number; pickupId: number }
  /** E19 story beat line (speech bubble above the speaker). */
  | { tick: number; type: 'story.say'; id: number; text: string; position: Point }
  | { tick: number; type: 'story.thud'; position: Point }
  /** L1 v2 warning without UI text: stiffen (20 m), growl (14 m), bark (9 m, 1 per 2 s), then nervous idle (6 s). */
  | { tick: number; type: 'corgi.warn'; id: number; stage: Exclude<CorgiWarnStage, 'none'>; threatId: number; direction: Point; distance: number }
  | { tick: number; type: 'escort.order'; id: number; order: 'wait' | 'follow' }
  | { tick: number; type: 'escort.downed' | 'escort.revived'; id: number };
