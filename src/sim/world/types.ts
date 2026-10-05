/** Logical per-tick data; device adapters arrive in E03. */
export interface InputFrame {
  move: { x: number; z: number };
  aim: { x: number; z: number };
  primary: boolean;
  secondary: boolean;
  interact: boolean;
}
export const emptyInput = (): InputFrame => ({ move: { x: 0, z: 0 }, aim: { x: 1, z: 0 }, primary: false, secondary: false, interact: false });
export interface Transform { x: number; y: number; z: number; yaw: number }
/** Plain components only; physics handles and render objects are never serialized. */
export interface EntitySnapshot {
  id: number;
  kind: string;
  archetype: string;
  transform: Transform;
  health: { current: number; max: number };
  faction: string;
}
export type GameEvent =
  | { tick: number; type: 'sim.tick' }
  | { tick: number; type: 'scenario.loaded'; name: string; seed: number }
  | { tick: number; type: 'scenario.unloaded'; name: string };
export interface GameStateSnapshot {
  tick: number;
  seed: number;
  scenario: string | null;
  player: EntitySnapshot | null;
  entities: EntitySnapshot[];
  mission: null;
  progression: null;
  rng: { stream: string; state: number; cursor: number }[];
  perf: { entities: number; bodies: number; colliders: number; listeners: number };
}
export interface EntityFilter { kind?: string; archetype?: string; within?: { x: number; z: number; r: number } }
