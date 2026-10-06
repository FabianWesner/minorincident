/**
 * L1 v2 outbreak contracts (specs/epic-19, section 5). Types only: lane C (infected AI), D (civilians/outbreak),
 * E (mission), F (toys/companions) and H (audio/VFX) build against these without importing each other.
 * Positions are world metres on the XZ plane; yaw is radians; time is sim ticks unless named `...S`.
 */
export type Vec2 = { x: number; z: number };

/** Anything an infected may perceive, chase or bite. The corgi is never a HumanTarget. */
export type HumanKind = 'player' | 'civilian';
export interface HumanTarget {
  id: number;
  kind: HumanKind;
  position: Vec2;
  /** Facing as a yaw in radians (0 = +X). */
  facing: number;
  /** True while riding the bicycle (still a human target; section 5.10). */
  riding?: boolean;
}
/** Query used by perception: all human targets, live (not escaped, not being turned). Order is stable by id. */
export interface HumanTargetQuery {
  all(): readonly HumanTarget[];
  get(id: number): HumanTarget | undefined;
  /** Humans inside a circle, for scream/blast hearing and bite reach. */
  within(center: Vec2, radius: number): readonly HumanTarget[];
}

/** Infection of one civilian: progress 0 to 1 over 3.0 +/- 0.5 s, same entity id, asset, tint and accessories (section 5.7). */
export type InfectionPhase = 'none' | 'stagger' | 'collapse' | 'eyes' | 'rise' | 'infected';
export interface InfectionState {
  entityId: number;
  /** 0 = healthy, 1 = infected. Drives the overlay uniform (skin blend, eyes, blood). */
  progress: number;
  phase: InfectionPhase;
  /** Speed tier the entity takes when it rises (section 5.4). */
  tier: SpeedTier;
  startedTick: number;
  endsTick: number;
  biteSourceId: number;
}
export type SpeedTier = 'frail' | 'average' | 'athletic';

/** Emitted when an infected completes a bite (after the 1.0 s grab and the rescue window). */
export interface BiteEvent {
  tick: number;
  type: 'outbreak.bite';
  sourceId: number;
  targetId: number;
  position: Vec2;
  /** False when the infected cap is reached: the civilian dies instead of turning (section 5.9). */
  turns: boolean;
}
/** Deliberate loud event that attracts non-chasing infected (car alarm). */
export interface DistractionEvent {
  tick: number;
  type: 'outbreak.distraction';
  id: number;
  kind: 'car-alarm';
  position: Vec2;
  radius: number;
  /** Tick at which the distraction stops (alarm: 20 s). */
  until: number;
}
/** Emitted when a civilian reaches a refuge door or an edge and leaves the map ("escaped"). */
export interface CivilianEscapedEvent {
  tick: number;
  type: 'outbreak.civilian-escaped';
  id: number;
  refuge: string;
}
export interface InfectionEvent {
  tick: number;
  type: 'outbreak.infection';
  entityId: number;
  phase: InfectionPhase;
  progress: number;
}

/** Axis-aligned or polygonal blocker of infected line of sight; gates and the car-wash curtain register dynamically. */
export type LosShape =
  | { kind: 'aabb'; min: Vec2; max: Vec2 }
  | { kind: 'polygon'; points: Vec2[] };
export interface LosBlocker {
  id: string;
  shape: LosShape;
  /** Static scene blockers (buildings, tall hedges) are always active; dynamic ones are toggled by their owner. */
  active: boolean;
  /** What it is, for debugging and tests. */
  source: 'building' | 'car' | 'hedge' | 'fence' | 'gate' | 'carwash-curtain';
}
export interface LosBlockerRegistry {
  register(blocker: LosBlocker): void;
  setActive(id: string, active: boolean): void;
  unregister(id: string): void;
  /** True when the segment a-b is not blocked by any active blocker. */
  clear(a: Vec2, b: Vec2): boolean;
}

/** Polygon in which the bicycle auto-dismounts at the edge (facility forecourt, garage, fire-station bay). */
export interface NoBikeZone {
  id: string;
  polygon: Vec2[];
}

/** Accident sequence events of beat 5 (section 3); emitted by lane E in this order, consumed by H (FX, sound). */
export const l1AccidentEvents = ['l1.flicker', 'l1.blast', 'l1.ringing', 'l1.smoke', 'l1.screams', 'l1.infectedExit'] as const;
export type L1AccidentEventName = (typeof l1AccidentEvents)[number];
export interface L1AccidentEvent {
  tick: number;
  type: L1AccidentEventName;
  /** Anchor or position the effect is centred on (lab-smoke-vent, lab-exit-window, ...). */
  anchor?: string;
  position?: Vec2;
}

/** Union merged into the shared GameEvent type. */
export type OutbreakEvent = BiteEvent | DistractionEvent | CivilianEscapedEvent | InfectionEvent | L1AccidentEvent;
