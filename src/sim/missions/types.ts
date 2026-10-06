import type { TimeOfDay } from '../../data/timeOfDay';
import type { EntitySnapshot } from '../world/types';

export const objectiveTypes = ['reach', 'interact', 'kill', 'killAll', 'survive', 'defend', 'escort', 'collect', 'drive', 'custom'] as const;
export type ObjectiveType = typeof objectiveTypes[number];
export interface Anchor { x: number; z: number; radius: number }
/** Triggers use fixed sim ticks. IDs reference the definition, never renderer objects. */
export type Trigger =
  | { kind: 'start' }
  | { kind: 'objectives'; ids: string[]; mode: 'all' | 'any' }
  | { kind: 'volume'; anchor: string; edge: 'inside' | 'enter' | 'exit'; actor?: string }
  | { kind: 'interact'; anchor: string; seconds: number }
  | { kind: 'kills'; actors: string[]; count?: number }
  | { kind: 'timer'; seconds: number }
  | { kind: 'dead'; actor: string }
  | { kind: 'escort' | 'drive'; anchor: string; actor: string }
  | { kind: 'items'; ids: string[] }
  | { kind: 'state'; key: string; equals: boolean }
  | { kind: 'count'; key: string; atLeast: number }
  | { kind: 'event'; type: string; actor?: string; count: number }
  | { kind: 'all' | 'any'; triggers: Trigger[] };
export type ScriptAction =
  | { kind: 'spawn'; group: string }
  | { kind: 'migration'; group: string; to: string }
  | { kind: 'tier'; tier: 0 | 1 | 2 | 3 | 4 | 5 }
  | { kind: 'gate'; id: string; open: boolean }
  | { kind: 'radio'; id: string }
  | { kind: 'cinematic'; id: string }
  | { kind: 'timeOfDay'; value: TimeOfDay }
  | { kind: 'grant'; item: string }
  | { kind: 'checkpoint'; id: string }
  | { kind: 'marker'; anchor: string }
  | { kind: 'state'; key: string; value: boolean };
export interface ObjectiveDef {
  id: string; type: ObjectiveType; text: string; anchor: string;
  start: Extract<Trigger, { kind: 'start' | 'objectives' }>;
  complete: Trigger; fail: { trigger: Trigger; reason: FailReason }[];
  timer?: number; optional?: boolean;
  /** Alternative paths share a choice ID; completing one cancels its siblings. */
  choice?: string;
  onStart?: ScriptAction[]; onComplete?: ScriptAction[]; onFail?: ScriptAction[];
}
export type FailReason = 'timeout' | 'escort-died' | 'target-destroyed' | 'player-died';
export interface ActorDef { archetype: string; kind: string; faction: string; anchor: string; hp: number; boss?: boolean }
export interface CinematicDef {
  seconds: number; caption: string;
  position: [number, number, number]; target: [number, number, number];
  /** Applied once at the end, identically for a skip or full playback. */
  actions: ScriptAction[];
}
export interface MissionDef {
  id: string; briefing: string; anchors: Record<string, Anchor>; actors: Record<string, ActorDef>;
  groups: Record<string, string[]>; gates: Record<string, { anchor: string; open: boolean }>;
  items: string[]; states: string[]; counters: string[]; checkpoints: string[];
  cinematics: Record<string, CinematicDef>; steps: ObjectiveDef[];
  finish: string[]; onStart: ScriptAction[]; onComplete: ScriptAction[];
}
export interface MissionResult { time: number; kills: number; damage: number; deaths: number; rescued: number; optionalObjectives: string[] }
export interface StepState { status: 'pending' | 'active' | 'completed' | 'cancelled'; started: number; kills: number[]; events: Record<string, number>; interaction: number }
export interface MissionState {
  id: string; phase: 'briefing' | 'playing' | 'cinematic' | 'retry' | 'result' | 'progression';
  volumes: boolean[]; killedBosses: string[];
  completedObjectives: string[]; steps: Record<string, StepState>; actors: Record<string, number>;
  items: string[]; states: Record<string, boolean>; counters: Record<string, number>; gates: Record<string, boolean>;
  marker: string | null; checkpoint: string | null; tier: number | null; timeOfDay: TimeOfDay | null;
  subtitle: { id: string; text: string; until: number } | null;
  cinematic: { id: string; elapsed: number; resume: 'playing' | 'retry' } | null; failure: FailReason | null;
  stats: MissionResult; result: MissionResult | null;
}
export interface MissionCheckpoint { tick: number; state: MissionState; entities: EntitySnapshot[] }
