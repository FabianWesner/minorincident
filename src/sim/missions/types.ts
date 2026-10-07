import type { DeviceOptions } from '../interact/Interactables';
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
  | { kind: 'interact'; anchor: string; seconds: number; actor?: string }
  | { kind: 'kills'; actors: string[]; count?: number }
  | { kind: 'timer'; seconds: number }
  | { kind: 'dead'; actor: string }
  | { kind: 'escort'; anchor: string; actor: string }
  | { kind: 'drive'; anchor: string; actor: string; exit?: boolean }
  | { kind: 'hold'; anchor: string; seconds: number }
  | { kind: 'destroy'; actor: string }
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
  start: Extract<Trigger, { kind: 'start' | 'objectives' | 'state' }>;
  complete: Trigger; fail: { trigger: Trigger; reason: FailReason }[];
  timer?: number; optional?: boolean;
  /** Alternative paths share a choice ID; completing one cancels its siblings. */
  choice?: string;
  onStart?: ScriptAction[]; onComplete?: ScriptAction[]; onFail?: ScriptAction[];
}
export type FailReason = 'timeout' | 'escort-died' | 'target-destroyed' | 'player-died';
export interface ActorDef { archetype: string; kind: string; faction: string; anchor: string; hp: number; boss?: boolean; device?: DeviceOptions; item?: string }
export interface CinematicDef {
  seconds: number; caption: string;
  position: [number, number, number]; target: [number, number, number];
  /** Applied once at the end, identically for a skip or full playback. */
  actions: ScriptAction[];
}
export interface MissionDef {
  /** L1 v2 story controller (technician, accident sequence, infected exits); see LevelOneOutbreak. */
  l1?: boolean;
  /** Global gameplay deadline; checkpoints capture the remaining ticks. */
  deadline?: { seconds: number; retryGraceSeconds: number };
  id: string; briefing: string; anchors: Record<string, Anchor>; actors: Record<string, ActorDef>;
  groups: Record<string, string[]>; gates: Record<string, { anchor: string; open: boolean }>;
  items: string[]; states: string[]; counters: string[]; checkpoints: string[];
  cinematics: Record<string, CinematicDef>; steps: ObjectiveDef[];
  finish: string[]; onStart: ScriptAction[]; onComplete: ScriptAction[];
}
export interface MissionResult {
  time: number; kills: number; damage: number; deaths: number; rescued: number; optionalObjectives: string[];
  /** L1 v2 result screen: the job is done, and the outbreak is not contained. */
  delivered?: boolean; infected?: number; turned?: number; escaped?: number;
}
/** Serializable L1 v2 story state; lives in MissionState so checkpoints snapshot it (ticks are shifted on restore). */
export interface L1State {
  phase: 'morning' | 'handover' | 'calm' | 'accident' | 'spread';
  carrying: boolean; delivered: boolean; away: boolean;
  techId: number;
  /** Handover and accident timeline in sim ticks; 0 = not scheduled. */
  hx: number; hz: number; handoverAt: number; deliveredAt: number; flickerAt: number; exitAt: number; warned: boolean; fired: number;
  exitIds: number[]; exitHeadingsDeg: number[]; runs: { id: number; dx: number; dz: number; speed: number; until: number; via?: { x: number; z: number }; rushAt?: number; /** Emerging from a building: hidden at the door until this tick, then stumbles out and joins the AI. */ emergeAt?: number; door?: number }[];
  turnedIds: number[]; escapedIds: number[];
  /** Beat 9: the horde near the garage was produced; further streams spawned along the route to the fire station. */
  graceUntil: number; hordeDone: boolean; routeSpawns: number; routeNextAt: number;
  /** PO UAT story beats: the running beat (camera framing + input lock), finished beats and the beat actors. */
  beat?: { id: 'pickup' | 'handover' | 'garage'; start: number; until: number; actor: number; fx: number; fz: number; ax: number; az: number; mx: number; mz: number } | null;
  /** The story bubble on screen (speaker 0 = caption): readable until `until`, the beat holds while it reads. */
  say?: { id: number; text: string; at: number; until: number } | null;
  beatsDone?: string[]; clerkId?: number; firefighterId?: number;
}
export interface StepState { status: 'pending' | 'active' | 'completed' | 'cancelled'; started: number; kills: number[]; events: Record<string, number>; interaction: number; driveArrived?: boolean; holds?: Record<string, number> }
export interface MissionState {
  /** L1 v2 story state (technician, accident timeline, infected exits, result counters). */
  l1?: L1State;
  id: string; phase: 'briefing' | 'playing' | 'cinematic' | 'retry' | 'result' | 'progression';
  /** Remaining global gameplay time (cinematics and retry screens pause it). */
  deadlineTicks: number | null;
  volumes: boolean[]; killedBosses: string[];
  completedObjectives: string[]; steps: Record<string, StepState>; actors: Record<string, number>;
  items: string[]; states: Record<string, boolean>; counters: Record<string, number>; gates: Record<string, boolean>;
  marker: string | null; checkpoint: string | null; tier: number | null; timeOfDay: TimeOfDay | null;
  subtitle: { id: string; text: string; until: number } | null;
  cinematic: { id: string; elapsed: number; resume: 'playing' | 'retry' } | null; failure: FailReason | null;
  stats: MissionResult; result: MissionResult | null;
}
export interface MissionCheckpoint {
  tick: number; state: MissionState; entities: EntitySnapshot[];
  /** Snapshots of the optional L1 toy systems (bicycle, yard gates, dumpsters, outbreak overlay). */
  seams?: Record<string, unknown>;
}
