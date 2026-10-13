import type { Tier } from '../../levels/districts/types';
import type { HouseEmergence } from '../outbreak/HouseEmergence';
import type { DeviceOptions } from '../interact/Interactables';
import type { TimeOfDay } from '../../data/timeOfDay';
import type { EntitySnapshot } from '../world/types';

export const objectiveTypes = ['reach', 'interact', 'kill', 'killAll', 'survive', 'defend', 'escort', 'collect', 'drive', 'custom'] as const;
export type ObjectiveType = typeof objectiveTypes[number];
/** `y`: visible floor height for markers when the spot is raised (e.g. the Fire Station 3 bay floor); default street level. */
export interface Anchor { x: number; z: number; radius: number; y?: number }
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
  | { kind: 'tier'; tier: Tier }
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
  /** False for objectives without a destination (combat, waiting, free exploration). Keeps their HUD text. */
  waypoint?: boolean;
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
  /** L2 "The Failed Rescue" set-piece controller (station calm, alarm, truck ride, doors, ambush, checkpoint); see LevelTwoRescue. */
  l2?: boolean;
  /** L3 "The Police Collapse" controller (armory, station attack, fallback, squad, corridor, army checkpoint); see LevelThreeCollapse. */
  l3?: boolean;
  /** L4 "The Safe City Falls" controller (convoy, quartermaster, the turn, the war, the line break, the cellar); see LevelFourWar. */
  l4?: boolean;
  /** L5 "Aftermath" controller (emerge, five hidden survivors, the escort group, the metro shelter); see LevelFiveAftermath. */
  l5?: boolean;
  l6?: boolean;
  l8?: boolean;
  /** Global gameplay deadline; checkpoints capture the remaining ticks. */
  deadline?: { seconds: number; retryGraceSeconds: number };
  id: string; briefing: string; anchors: Record<string, Anchor>; actors: Record<string, ActorDef>;
  groups: Record<string, string[]>; gates: Record<string, { anchor: string; open: boolean }>;
  items: string[]; states: string[]; counters: string[]; checkpoints: string[];
  cinematics: Record<string, CinematicDef>; steps: ObjectiveDef[];
  finish: string[]; onStart: ScriptAction[]; onComplete: ScriptAction[];
}
export interface MissionResult {
  time: number; kills: number; knockdowns: number; damage: number; deaths: number; rescued: number; optionalObjectives: string[];
  /** L1 v2 result screen: the job is done, and the outbreak is not contained. */
  delivered?: boolean; infected?: number; turned?: number; escaped?: number;
  /** L5: the survivors that reached the station alive (keys of `l5Survivors`), carried into L6. */
  survivors?: string[];
  survivorsIn?: number;
  escapedSurvivors?: EntitySnapshot[];
  stationOccupants?: EntitySnapshot[];
  rescuedSurvivors?: EntitySnapshot[];
}
/** Serializable L1 v2 story state; lives in MissionState so checkpoints snapshot it (ticks are shifted on restore). */
export interface L1State {
  phase: 'morning' | 'handover' | 'calm' | 'accident' | 'spread';
  carrying: boolean; delivered: boolean; away: boolean;
  techId: number;
  /** Handover and accident timeline in sim ticks; 0 = not scheduled. */
  hx: number; hz: number; handoverAt: number; deliveredAt: number; flickerAt: number; exitAt: number; warned: boolean; fired: number;
  exitIds: number[]; exitHeadingsDeg: number[]; runs: { id: number; dx: number; dz: number; speed: number; until: number; via?: { x: number; z: number }; rushAt?: number; /** Came out of this refuge door (beat 9 house). */ door?: number }[];
  turnedIds: number[]; escapedIds: number[];
  graceUntil: number;
  /**
   * Beat 9 (PO rule 2026-10-07): the one house near the garage whose residents come out of its front door one by one
   * (HouseEmergence: `house` the placement id, '' = none in range; `x, z` the threshold; `next` the tick of the next
   * resident; `ids` the residents out so far).
   */
  house: HouseEmergence | null;
  /** The lab accident: the four staff walking out of the annex front door behind the technician (HouseEmergence). */
  labExit?: HouseEmergence | null;
  /** PO 10-10 authored street groups: stable member ids, retained across respawns. */
  streetGroups?: { x: number; z: number; ids: number[] }[];
  /** PO UAT story beats: the running beat (camera framing + input lock), finished beats and the beat actors. */
  beat?: { id: 'pickup' | 'handover' | 'garage'; start: number; until: number; actor: number; fx: number; fz: number; ax: number; az: number; mx: number; mz: number } | null;
  /** The story bubble on screen (speaker 0 = caption): readable until `until`, the beat holds while it reads. */
  say?: { id: number; text: string; at: number; until: number } | null;
  beatsDone?: string[]; clerkId?: number; firefighterId?: number; firefighterNext?: number;
  /** Door-to-courier walking routes of the clerk (pickup) and the technician (hand-over): behind the door, door plane,
   * outside the facade, navigation corners, meeting point (src/sim/missions/doorRoute.ts). */
  clerkRoute?: { x: number; z: number }[] | null; techRoute?: { x: number; z: number }[] | null;
}
/** Serializable L2 controller state. Ticks are sim ticks, 0 = not yet. */
export interface L2State {
  phase: 'calm' | 'alarm' | 'ride' | 'arrived' | 'doors' | 'collapse' | 'escape' | 'checkpoint' | 'done';
  alarmAt: number; departAt: number; arrivedAt: number; crewExitAt: number; atDoorsAt: number; doorsOpenAt: number; radioAt: number; crossedAt: number; gateClosedAt: number;
  truckId: number; seated: boolean; axe: boolean;
  /** Route progress (metres) and speed (m/s) of the kinematic truck. */
  rideS: number; rideV: number;
  crewIds: number[]; benchIds: number[]; trappedIds: number[]; officerIds: number[]; lineIds: number[];
  doorIds: number[]; gateIds: number[];
  /** Trapped civilians released so far, and the hidden ambush still waiting at its emergence doors. */
  released: number; ambush: { id: number; door: string; at: number }[]; ambushIds: number[];
  /** Escape population, cluster and their emergence (hidden at a door until `at`). */
  /** `x/z/seen`: where it first appeared and whether that point was inside the camera volume then (omniscience audit). */
  pending: { id: number; door: string; at: number; home: { x: number; z: number }; x?: number; z?: number; seen?: boolean }[]; escapeIds: number[]; clusterIds: number[];
  escapeSpawned: boolean; clusterSpawned: boolean; clusterReached: boolean;
  /** Checkpoints waiting for a calm moment (escape, cluster). */
  cpWait?: string[];
  /** Checkpoint gunfire: last loud event per officer, and the two barks (ticks, 0 = not yet). */
  lastShot?: Record<number, number>; keepBackAt?: number; runKidAt?: number;
  /** Rescue set piece presentation (PO 10-08): the current speech bubble, scripted trips after the release and the far-street
   * silhouettes (pedestrians with the turned look that cross a street end and vanish; never infected, never hunting). */
  say?: { id: number; text: string; at: number; until: number } | null;
  trips?: { id: number; at: number; helper: number }[];
  /** Released people: tick at which each stops looking back and flees for the checkpoint. */
  flee?: { id: number; at: number }[];
  lurkers?: number[];
}
/** Serializable L3 controller state. Ticks are sim ticks, 0 = not yet. */
export interface L3State {
  phase: 'yard' | 'attack' | 'fallback' | 'corridor' | 'done';
  handgunAt: number; attackAt: number; fallbackAt: number; fallbackCause: '' | 'time' | 'turned' | 'inside'; crossedAt: number; doneAt: number;
  /** Tick the officers left in the yard pulled its gates shut behind the squad (0 = open). */
  gatesClosedAt: number;
  /** Finale chase packs and boom closure are checkpoint state, never renderer state. */
  waitingIds?: number[]; finaleAt?: number; finaleNextAt?: number; finalePacks?: number[]; finaleIds?: number[]; barrierClosedAt?: number;
  /** Finale surges: since when the current group waits at the staging point, the last release, the released pursuers. */
  stagedAt?: number; surgeAt?: number; surgedIds?: number[];
  /** All police (posts + squad designates), the squad designates, soldiers and medkit pickups. */
  officerIds: number[]; squadIds: number[]; soldierIds: number[]; medkitIds: number[];
  /** The live squad after the fallback (`farSince`: tick it first strayed beyond 40 m) and every loss with its cause. */
  squad: { id: number; farSince: number }[]; lost: { id: number; cause: 'bite' | 'kill' | 'separated'; tick: number }[];
  turnedOfficers: number[];
  /** Station waves still waiting at their emergence points (`id` 0 = not yet out). */
  waves: { id: number; dir: 'river' | 'blvd' | 'oak' | 'commerce' | 'station'; at: number; wave: number }[]; waveIds: number[]; wavesSpawned: number;
  /** Corridor population: segments populated, the planned emergences (with their first visible point for the audit) and ids. */
  populated: boolean[]; pending: { id: number; door: string; home: { x: number; z: number }; segment: number; at: number; x?: number; z?: number; seen?: boolean; horde?: boolean; streetExtra?: boolean; kind?: 'spill' | 'pressure' }[]; segmentIds: number[][];
  /** Forward pressure: furthest progress (x) and when it last grew; emergences behind it. */
  furthest: number; furthestAt: number; pressureAt: number; pressureIds: number[];
  /** Highest segment entered (-1 yard), squad size at each segment end, last gunshot tick per shooter, infected retired out of view. */
  segment: number; cpWait?: string[]; cpSeen?: string[]; segmentSquad: number[]; lastShot: Record<number, number>; retired: number;
  /** Side-street spills per cross-link (count, last tick) and the infected they brought out. */
  spills: Record<string, { n: number; at: number }>; spillIds: number[];
  /** The one avenue without a segment-3 horde pack (seeded). */
  hordeStreet?: 'blvd' | 'commerce' | 'oak';
}
/** Serializable L4 controller state. Ticks are sim ticks, 0 = not yet. */
export interface L4State {
  phase: 'convoy' | 'plaza' | 'war' | 'collapse' | 'cellar' | 'done';
  rideAt: number; arrivedAt: number; gunAt: number; turnDueAt: number; turnAt: number; warAt: number; lineBreakAt: number; lineCause: '' | 'time' | 'soldiers' | 'inside' | 'forced';
  descendAt: number; barredAt: number; doneAt: number; markerAt: number;
  /** Convoy: entity ids head first, arc length of each, the common speed, and whether the courier is seated in the player bus. */
  convoyIds: number[]; convoyS: number[]; convoyV: number; seated: boolean;
  /** People: evacuees from the buses, the evacuees who turn, soldiers (`qmId` the quartermaster, `hmgIds` the gunners), residents, medkits. */
  evacueeIds: number[]; turnerIds: number[]; soldierIds: number[]; qmId: number; hmgIds: number[]; residentIds: number[]; medkitIds: number[];
  /** Armed civilians (weapon assigned at spawn, drawn and used from the turn on). */
  armed: { id: number; weapon: 'pistol' | 'hunting-rifle' | 'pipe' | 'bat' | 'crowbar'; armedAt: number }[];
  /** Counts at the beats the acceptance checks compare. */
  soldiersAtTurn: number; civiliansAtTurn: number; infectedAtT30: number; killsAtBreak: number; infectedAtBreak: number; soldiersAtBreak: number; soldiersAtCellar: number;
  /** The war: waves emerged, the next wave tick, infected brought from the street edges, and the collapse waves. */
  alphaIds: number[]; alphaAnchors: string[];
  wave: number; waveAt: number; pend: number[]; carIds: number[]; emergedIds: number[]; collapseWaveAt: number; collapseIds: number[]; collapseWaves: number;
  /** Collapse: infected planned at doors along both routes (emerge out of view) and the soldier pockets still to be placed. */
  pendingDoor: { id: number; door: string; home: { x: number; z: number } }[]; pockets: number[];
  /** Spectacle: tank (route progress, next shot, shots fired), helicopter, HMG bursts, fuel truck and the live damage. */
  tankId: number; tankS: number; tankFireAt: number; tankShots: number; tankPhase: 'off' | 'enter' | 'hold' | 'gone';
  heliId: number; heliAngle: number; heliPhase: 'off' | 'arrive' | 'orbit' | 'withdraw' | 'gone'; heliAt: number; heliBurstAt: number; heliBurst: number; heliShots: number; heliTarget: { x: number; z: number } | null;
  hmgBursts: number; hmgLastAt: Record<number, number>;
  fuelId: number; craterId: number; burning: number[]; fires: number; glass: number[]; scorch: number; lastShot: Record<number, number>;
  /** Kills by the player and by allies (soldiers, armed civilians) since the turn; the kill share check reads these. */
  kills: { player: number; soldiers: number; armedCivilians: number; unarmedCivilians: number; heli: number; tank: number; other: number };
}
/** Serializable L5 controller state. Ticks are sim ticks, 0 = not yet. */
export interface L5State {
  phase: 'cellar' | 'emerged' | 'search' | 'metro' | 'shelter' | 'done';
  startAt: number; emergedAt: number; searchAt: number; accountedAt: number; metroAt: number; shutterAt: number; doneAt: number;
  /** The five survivors in casting order: entity id and fate (`hidden` until found, then `following`, `dead` or `turned`). */
  survivors: { key: string; id: number; status: 'hidden' | 'following' | 'dead' | 'turned' | 'sheltered'; foundAt: number; cueAt: number; lostAt: number; hold: number }[];
  found: number; lookoutId: number; stationIds: number[]; infectedIds: number[]; medkitIds: number[]; corpseIds: number[]; fireIds: number[];
  /** Sunset gloom, 1 = full sun at the basement exit, falling monotonically; the sun intensity factor the renderer applies. */
  gloom: number;
  /** The latest sign of life the courier heard (HUD ping), and the "Wait!" bark. */
  cue: { key: string; x: number; z: number; until: number; text: string } | null;
  lastShot: Record<number, number>; waitedAt: number; infectedMax: number; deadAtMetro: number;
}
export interface StepState { status: 'pending' | 'active' | 'completed' | 'cancelled'; started: number; kills: number[]; events: Record<string, number>; interaction: number; driveArrived?: boolean; holds?: Record<string, number> }
export interface MissionState {
  /** L1 v2 story state (technician, accident timeline, infected exits, result counters). */
  l1?: L1State;
  /** L2 set-piece state; checkpoints snapshot it (ticks are shifted on restore). */
  l2?: L2State;
  /** L3 controller state; checkpoints snapshot it (ticks are shifted on restore). */
  l3?: L3State;
  /** L4 controller state; checkpoints snapshot it (ticks are shifted on restore). */
  l4?: L4State;
  /** L5 controller state; checkpoints snapshot it (ticks are shifted on restore). */
  l5?: L5State;
  l6?: L6State;
  id: string; phase: 'briefing' | 'playing' | 'cinematic' | 'retry' | 'result' | 'progression';
  /** Remaining global gameplay time (cinematics and retry screens pause it). */
  deadlineTicks: number | null;
  volumes: boolean[]; killedBosses: string[];
  completedObjectives: string[]; steps: Record<string, StepState>; actors: Record<string, number>;
  items: string[]; states: Record<string, boolean>; counters: Record<string, number>; gates: Record<string, boolean>;
  /** Tick until which the world keeps running after the final objective because action is ongoing (PO 2026-10-13); the HUD may show the completion banner. */
  runOutUntil?: number;
  marker: string | null; checkpoint: string | null; tier: Tier | null; timeOfDay: TimeOfDay | null;
  subtitle: { id: string; text: string; until: number } | null;
  cinematic: { id: string; elapsed: number; resume: 'playing' | 'retry' } | null; failure: FailReason | null;
  stats: MissionResult; result: MissionResult | null;
}
export interface MissionCheckpoint {
  tick: number; state: MissionState; entities: EntitySnapshot[];
  /** Snapshots of the optional L1 toy systems (bicycle, yard gates, dumpsters, outbreak overlay). */
  seams?: Record<string, unknown>;
}

/** E24 checkpoint state. Times are simulation ticks. */
export interface L6State {
  /** Checkpointed dialogue uses the same HUD bubble as earlier story levels. */
  say?: { id: number; text: string; at: number; until: number };
  phase: 'shelter'|'first'|'fails'|'retreat'|'exit'|'done';
  startAt:number; breach1At:number; breach2At:number; abandonAt:number; nextWave:number; firstBang:boolean; secondBang:boolean;
  leaderX:number; leaderZ:number; paused:boolean; flashlight:boolean; mainPower:boolean; emergency:boolean;
  exitAt:number; gateAt:number; injuryLineAt:number; lastShot:number; mid:boolean; platform:boolean;
  survivors:{key:string;id:number;injured:boolean;routine:'guard'|'sit'|'talk'|'treat'|'rest'|'share';status:'shelter'|'following'|'dead'|'turned'|'out';straggler:boolean;collected:boolean;rejoined:boolean;hold:number}[];
  gates:{id:number;x:number;closedAt:number;hold:number}[];
  infectedIds:number[]; spawnLog:{id:number;door:number;x:number;z:number;tick:number;wave:number;offscreen:boolean}[];
}
