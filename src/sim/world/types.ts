import type { SurvivorState } from '../../data/survivor';
import type { InputFrame, Scheme } from '../../input/InputFrame';
export { emptyInput, type InputFrame } from '../../input/InputFrame';
export interface Transform { x: number; y: number; z: number; yaw: number }
/** Plain components only; physics handles and render objects are never serialized. */
export interface EntitySnapshot {
  id: number;
  survivor?: SurvivorState;
  weapons?: import('../combat/Loadout').LoadoutState;
  combat?: { radius: number; armor: number; shield: boolean; staggerUntil: number; attacking: boolean; damageMultiplier: number; statuses: import('../combat/Status').StatusState[] };
  /** Reactive fixture hearing; E07 brains consume the same noise contract. */
  hearing?: { mode: 'idle' | 'investigate' | 'lured'; target: { x: number; z: number }; lureUntil: number };
  pickup?: { actionId: string; armed: boolean };
  kind: string;
  archetype: string;
  transform: Transform;
  health: { current: number; max: number };
  faction: string;
}
export type GameEvent =
  | import('../missions/events').MissionEvent
  | { tick: number; type: 'noise'; sourceId: number; actionId: string; position: { x: number; y: number; z: number }; radius: number; loudness: number; kind: string }
  | { tick: number; type: 'ai.alerted'; sourceId: number; targetId: number; cause: 'noise'; position: Transform }
  | { tick: number; type: 'combat.effect'; sourceId: number; actionId: string; kind: import('../../data/actions/schema').ActionEffect['kind']; position: { x: number; y: number; z: number }; radius: number; expires: number }
  | { tick: number; type: 'pickup.collected'; sourceId: number; pickupId: number; side: import('../../data/actions/schema').Side; actionId: string; replaced: string | null }
  | { tick: number; type: 'combat.attack'; attackId: number; actionId: string; sourceId: number; side: import('../../data/actions/schema').Side; position: Transform; direction: { x: number; z: number } }
  | { tick: number; type: 'combat.hit' | 'combat.kill'; attackId: number; actionId: string; sourceId: number; targetId: number; position: Transform; amount: number }
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
  combat?: ReturnType<import('../combat/Combat').Combat['snapshot']>;
  input: { scheme: Scheme; frame: InputFrame };
  seed: number;
  scenario: string | null;
  player: EntitySnapshot | null;
  entities: EntitySnapshot[];
  mission: import('../missions/types').MissionState | { completedObjectives: string[] } | null;
  progression: { pickups: string[] } | null;
  rng: { stream: string; state: number; cursor: number }[];
  perf: { entities: number; bodies: number; colliders: number; listeners: number };
}
export interface EntityFilter { kind?: string; archetype?: string; within?: { x: number; z: number; r: number } }
