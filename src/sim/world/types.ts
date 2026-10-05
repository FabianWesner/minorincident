import type { SurvivorState } from '../../data/survivor';
import type { InputFrame, Scheme } from '../../input/InputFrame';
export { emptyInput, type InputFrame } from '../../input/InputFrame';
export interface Transform { x: number; y: number; z: number; yaw: number }
/** Plain components only; physics handles and render objects are never serialized. */
export interface EntitySnapshot {
  id: number;
  interactable?: import('../interact/Interactables').Interactable;
  inventory?: string[];
  hazard?: import('../interact/Hazards').Hazard;
  destructible?: import('../interact/Hazards').Destructible;
  /** E07 consumes this temporary noise target in preference to the player. */
  noiseTarget?: { id: number; until: number };
  pickup?: import('../interact/Pickups').Pickup;
  speedBuff?: { multiplier: number; until: number };
  survivor?: SurvivorState;
  weapons?: import('../combat/Loadout').LoadoutState;
  combat?: { radius: number; armor: number; shield: boolean; staggerUntil: number; attacking: boolean; damageMultiplier: number; statuses: import('../combat/Status').StatusState[] };
  kind: string;
  archetype: string;
  transform: Transform;
  health: { current: number; max: number };
  faction: string;
}
export type GameEvent =
  | { tick: number; type: 'pickup.collected'; id: number; kind: import('../interact/Pickups').PickupKind; item: string | null }
  | { tick: number; type: 'noise'; sourceId: number; position: { x: number; z: number }; radius: number; duration: number }
  | { tick: number; type: 'hazard.armed'; id: number; fuseAt: number }
  | { tick: number; type: 'hazard.exploded'; id: number; position: { x: number; y: number; z: number }; radius: number }
  | { tick: number; type: 'hazard.leaked'; id: number }
  | { tick: number; type: 'hazard.electrified' | 'prop.ignited'; id: number; until: number }
  | { tick: number; type: 'prop.broken'; id: number; pieces: number }
  | { tick: number; type: 'interact.completed'; id: number; kind: import('../interact/Interactables').DeviceKind; cycle: number }
  | { tick: number; type: 'interact.interrupted'; id: number; progress: number }
  | { tick: number; type: 'combat.attack'; attackId: number; actionId: string; sourceId: number; side: import('../../data/actions/schema').Side; position: Transform; direction: { x: number; z: number } }
  | { tick: number; type: 'combat.hit' | 'combat.kill'; attackId: number; actionId: string; sourceId: number; targetId: number; position: Transform; amount: number; damageType?: import('../combat/Damage').DamageEvent['type'] }
  | { tick: number; type: 'combat.hit-stop'; sourceId: number; durationMs: number }
  | { tick: number; type: 'loadout.switched'; sourceId: number; side: import('../../data/actions/schema').Side; actionId: string }
  | { tick: number; type: 'combat.landed' | 'combat.exploded'; sourceId: number; attackId: number; position: { x: number; y: number; z: number } }
  | { tick: number; type: 'player.died' | 'player.respawned'; id: number }
  | { tick: number; type: 'player.damaged'; id: number; amount: number }
  | { tick: number; type: 'sim.tick' }
  | { tick: number; type: 'scenario.loaded'; name: string; seed: number }
  | { tick: number; type: 'scenario.unloaded'; name: string };
export interface GameStateSnapshot {
  tick: number;
  interactions?: { activeId: number | null; debris: ReturnType<import('../../physics/DebrisPool').DebrisPool['snapshot']>; hazards: ReturnType<import('../interact/Hazards').Hazards['snapshot']> | null };
  combat?: ReturnType<import('../combat/Combat').Combat['snapshot']>;
  input: { scheme: Scheme; frame: InputFrame };
  seed: number;
  scenario: string | null;
  player: EntitySnapshot | null;
  entities: EntitySnapshot[];
  mission: { completedObjectives: string[] } | null;
  progression: { pickups: string[] } | null;
  rng: { stream: string; state: number; cursor: number }[];
  perf: { entities: number; bodies: number; colliders: number; listeners: number };
}
export interface EntityFilter { kind?: string; archetype?: string; within?: { x: number; z: number; r: number } }
