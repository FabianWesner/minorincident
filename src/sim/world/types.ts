import type { SurvivorState } from '../../data/survivor';
import type { InputFrame, Scheme } from '../../input/InputFrame';
export { emptyInput, type InputFrame } from '../../input/InputFrame';
export interface Transform { x: number; y: number; z: number; yaw: number }
/** Plain components only; physics handles and render objects are never serialized. */
export interface EntitySnapshot {
  id: number;
  /** Actual fixed-step motion, including collision/avoidance, for NPC locomotion clips. */
  locomotion?: import('../locomotion/MotionResponse').MotionResponse;
  motion?: { velocity: { x: number; z: number }; speed: number; moving: boolean; distance: number };
  civilian?: import('../npc/types').Civilian;
  companion?: import('../npc/types').Companion;
  escort?: import('../npc/types').Escort;
  traffic?: import('../npc/types').Traffic;
  convoy?: import('../npc/types').Convoy;
  infected?: import('../ai/types').InfectedState;
  interactable?: import('../interact/Interactables').Interactable;
  inventory?: string[];
  hazard?: import('../interact/Hazards').Hazard;
  destructible?: import('../interact/Hazards').Destructible;
  /** E07 consumes this temporary noise target in preference to the player. */
  /** A newborn is rendered in its collapse/rise pose and cannot act until this timer ends. */
  infectionRise?: { started: number; until: number };
  /** L1 v2 identity of a pedestrian, kept through infection (same model, tint, accessories; section 5.7). */
  appearance?: import('../outbreak/appearance').Appearance;
  /** L1 v2 transformation of a bitten pedestrian (0 to 1); removed when the same entity rises infected. */
  infection?: import('../outbreak/types').InfectionState;
  noiseTarget?: { id: number; until: number };
  pickup?: import('../interact/Pickups').Pickup | { actionId: string; armed: boolean };
  speedBuff?: { multiplier: number; until: number };
  hidden?: boolean;
  /** Infected currently clinging to this vehicle entity. */
  attachedTo?: number;
  /** Retaliation HP cost for vehicle ramming; supplied by infected definitions. */
  ramDamage?: number;
  vehicle?: import('../vehicles/Vehicles').VehicleState;
  /** L1 v2: the courier bicycle (entity) and the id of the bicycle the player is riding (player entity). */
  bicycle?: import('../vehicles/Bicycle').BicycleState;
  riding?: number;
  /** L1 v2 interactive toys (dumpster, car alarm, car wash); gates use `interactable`. */
  toy?: import('../interact/Toys').ToyState;
  survivor?: SurvivorState;
  weapons?: import('../combat/Loadout').LoadoutState;
  combat?: { radius: number; armor: number; shield: boolean; staggerUntil: number; attacking: boolean; damageMultiplier: number; statuses: import('../combat/Status').StatusState[];
    /** Authored reaction intent and swept knockback endpoints; presentation only. */
    reaction?: { index: number; started: number; until: number; direction: { x: number; z: number }; from: { x: number; z: number }; to: { x: number; z: number }; heavy: boolean } };
  /** Reactive fixture hearing; E07 brains consume the same noise contract. */
  hearing?: { mode: 'idle' | 'investigate' | 'lured'; target: { x: number; z: number }; lureUntil: number };
  kind: string;
  archetype: string;
  transform: Transform;
  health: { current: number; max: number };
  faction: string;
}
/** Presentation events contain only plain authored geometry; views never write back. */
export type TelegraphKind = 'lunge' | 'charge' | 'splash' | 'bloated';
export type EffectKind = 'explosion' | 'fire' | 'smoke' | 'toxic' | 'electric' | 'screamer' | 'objective' | 'pickup' | 'ash' | 'vehicle-smoke' | 'vehicle-fire';
export type GameEvent = import('../npc/types').NpcEvent
  | { tick: number; type: 'level.started'; id: string }
  | import('../../data/audioEvents').AudioSystemEvent
  | { tick: number; type: 'civilian.grabbed'; sourceId: number; targetId: number; variant: string; rescueUntil: number }
  | { tick: number; type: 'infected.prop-thrown'; sourceId: number; propId: number; attackId: number }
  | { tick: number; type: 'telegraph'; sourceId: number; attackId: number; special: string; duration: number }
  | { tick: number; type: 'infected.attack'; sourceId: number; attackId: number; targetId: number; special: string; amount: number }
  | { tick: number; type: 'infected.revived' | 'infected.leg-lost'; sourceId: number; targetId: number }

  | import('../missions/events').MissionEvent
  | import('../outbreak/types').OutbreakEvent
  | { tick: number; type: 'world.blocker.changed'; id: number; blocked: boolean; wall: import('../combat/HitQuery').CoverWall }
  | { tick: number; type: 'pickup.collected'; id: number; kind: import('../interact/Pickups').PickupKind; item: string | null }
  | { tick: number; type: 'hazard.armed'; id: number; fuseAt: number }
  | { tick: number; type: 'hazard.exploded'; id: number; position: { x: number; y: number; z: number }; radius: number }
  | { tick: number; type: 'hazard.leaked'; id: number }
  | { tick: number; type: 'hazard.electrified' | 'prop.ignited'; id: number; until: number }
  | { tick: number; type: 'prop.broken'; id: number; pieces: number }
  | { tick: number; type: 'interact.completed'; id: number; kind: import('../interact/Interactables').DeviceKind; cycle: number }
  | { tick: number; type: 'interact.interrupted'; id: number; progress: number }
  | { tick: number; type: 'vehicle.obstacle-broken'; targetId: number }
  | { tick: number; type: 'vehicle.entered' | 'vehicle.exited' | 'vehicle.grabbed' | 'vehicle.shaken'; sourceId: number; targetId: number }
  | { tick: number; type: 'vehicle.smoking' | 'vehicle.burning' | 'vehicle.exploded' | 'vehicle.recovering'; sourceId: number }
  | { tick: number; type: 'noise'; sourceId: number; actionId: string; position: { x: number; y: number; z: number }; radius: number; loudness: number; kind: string; duration?: number }
  | { tick: number; type: 'entity.spawned'; id: number }
  /** E09 → E15 feedback only: no vehicle control/physics in the view. Blood is level-local 0..1. */
  | { tick: number; type: 'vehicle.feedback'; id: number; position: { x: number; z: number }; yaw: number; healthFraction: number; blood: number }
  | { tick: number; type: 'telegraph'; sourceId?: never; attackId: number; kind: TelegraphKind; position: { x: number; z: number }; radius: number; angle: number }
  | { tick: number; type: 'attack.resolved'; attackId: number }
  | { tick: number; type: 'vfx.effect'; kind: EffectKind; position: { x: number; z: number }; radius: number }
  | { tick: number; type: 'ai.alerted'; sourceId: number; targetId: number; cause: 'noise' | 'sight'; position: Transform }
  | { tick: number; type: 'combat.effect'; sourceId: number; actionId: string; kind: import('../../data/actions/schema').ActionEffect['kind']; position: { x: number; y: number; z: number }; radius: number; expires: number }
  | { tick: number; type: 'pickup.collected'; sourceId: number; pickupId: number; side: import('../../data/actions/schema').Side; actionId: string; replaced: string | null }
  | { tick: number; type: 'combat.attack'; attackId: number; actionId: string; combo?: number; sourceId: number; side: import('../../data/actions/schema').Side; position: Transform; direction: { x: number; z: number } }
  | { tick: number; type: 'combat.hit' | 'combat.kill'; attackId: number; actionId: string; sourceId: number; targetId: number; position: Transform; amount: number; direction?: { x: number; z: number }; knockback?: number; cause?: 'vehicle'; damageType?: import('../combat/Damage').DamageEvent['type'] }
  | { tick: number; type: 'combat.hit-stop'; sourceId: number; durationMs: number }
  | { tick: number; type: 'loadout.switched'; sourceId: number; side: import('../../data/actions/schema').Side; actionId: string }
  | { tick: number; type: 'combat.landed'; sourceId: number; attackId: number; position: { x: number; y: number; z: number } }
  | { tick: number; type: 'combat.exploded'; sourceId: number; attackId: number; position: { x: number; y: number; z: number }; radius: number }
  | { tick: number; type: 'player.died' | 'player.respawned'; id: number }
  | { tick: number; type: 'player.damaged'; id: number; amount: number }
  | { tick: number; type: 'sim.tick' }
  | { tick: number; type: 'scenario.loaded'; name: string; seed: number }
  | { tick: number; type: 'scenario.unloaded'; name: string };
export interface GameStateSnapshot {
  tick: number;
  ai?: ReturnType<import('../ai/InfectedSystem').InfectedSystem['snapshot']>;
  interactions?: { activeId: number | null; debris: ReturnType<import('../../physics/DebrisPool').DebrisPool['snapshot']>; hazards: ReturnType<import('../interact/Hazards').Hazards['snapshot']> | null };
  controls?: NonNullable<ReturnType<import('../entities/ControlIntent').ControlIntent['snapshot']>>;
  combat?: ReturnType<import('../combat/Combat').Combat['snapshot']>;
  input: { scheme: Scheme; frame: InputFrame };
  seed: number;
  scenario: string | null;
  player: EntitySnapshot | null;
  entities: EntitySnapshot[];
  mission: import('../missions/types').MissionState | { completedObjectives: string[] } | null;
  progression: { pickups: string[]; campaign?: import('../progression/Campaign').CampaignSave; powerScore?: number } | null;
  rng: { stream: string; state: number; cursor: number }[];
  perf: { entities: number; bodies: number; colliders: number; listeners: number };
}
export interface EntityFilter { kind?: string; archetype?: string; detectable?: boolean; within?: { x: number; z: number; r: number } }
