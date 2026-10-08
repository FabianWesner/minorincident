import type { Anchor, FailReason, MissionResult } from './types';
export type MissionEvent =
  | { tick: number; type: 'mission.briefing'; id: string; text: string }
  | { tick: number; type: 'objective.started' | 'objective.completed' | 'checkpoint.set' | 'checkpoint.restored' | 'cinematic.started' | 'cinematic.completed' | 'progression.requested' | 'mission.spawned' | 'item.granted'; id: string }
  | { tick: number; type: 'mission.failed'; reason: FailReason }
  | { tick: number; type: 'dialogue.line'; id: string; text: string }
  | { tick: number; type: 'level.completed'; id: string; result: MissionResult }
  | { tick: number; type: 'escort.rescued'; id: number }
  | { tick: number; type: 'mission.signal'; name: string; actorId?: number }
  | { tick: number; type: 'migration.started'; id: string; to: Anchor }
  | { tick: number; type: 'world.tier-requested'; tier: number }
  | { tick: number; type: 'gate.changed'; id: string; open: boolean }
  /** E20 set-piece beats, in order (AC06): alarm, departure, arrival, crew exit, crew at the doors, doors open, radio, gate closed. */
  | { tick: number; type: 'l2.alarm' | 'l2.truckDeparted' | 'l2.truckArrived' | 'l2.crewExit' | 'l2.firefightersAtDoors' | 'l2.doorsOpen' | 'l2.radio' | 'l2.gateClosed' }
  /** E20 rescue set piece sound (PO 10-08): muffled banging and screams behind the glass, the forcing, distant danger. Audio only. */
  | { tick: number; type: 'l2.cue'; cue: string; position: { x: number; z: number }; gain?: number; lowpass?: number }
  /** E20 §5.2 allied fighter strike (firefighter melee, officer shot); the hit itself is an ordinary `combat.hit`. */
  | { tick: number; type: 'ally.attack'; sourceId: number; targetId: number; role: 'firefighter' | 'officer' };
