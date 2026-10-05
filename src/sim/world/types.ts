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
  kind: string;
  archetype: string;
  transform: Transform;
  health: { current: number; max: number };
  faction: string;
}
/** Presentation events contain only plain authored geometry; views never write back. */
export type TelegraphKind = 'lunge' | 'charge' | 'splash' | 'bloated';
export type EffectKind = 'explosion' | 'fire' | 'smoke' | 'toxic' | 'electric' | 'screamer' | 'objective' | 'pickup' | 'ash' | 'vehicle-smoke' | 'vehicle-fire';
export type GameEvent =
  | { tick: number; type: 'entity.spawned'; id: number }
  /** E09 → E15 feedback only: no vehicle control/physics in the view. Blood is level-local 0..1. */
  | { tick: number; type: 'vehicle.feedback'; id: number; position: { x: number; z: number }; yaw: number; healthFraction: number; blood: number }
  | { tick: number; type: 'telegraph'; attackId: number; kind: TelegraphKind; position: { x: number; z: number }; radius: number; angle: number }
  | { tick: number; type: 'attack.resolved'; attackId: number }
  | { tick: number; type: 'vfx.effect'; kind: EffectKind; position: { x: number; z: number }; radius: number }
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
  mission: { completedObjectives: string[] } | null;
  progression: { pickups: string[] } | null;
  rng: { stream: string; state: number; cursor: number }[];
  perf: { entities: number; bodies: number; colliders: number; listeners: number };
}
export interface EntityFilter { kind?: string; archetype?: string; within?: { x: number; z: number; r: number } }
