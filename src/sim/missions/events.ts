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
  | { tick: number; type: 'gate.changed'; id: string; open: boolean };
