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
  /** E21 beats: the attack starts, a wave emerges, the fallback (first-of rule), a squad member is lost, a segment is entered, the zone line crossed. */
  | { tick: number; type: 'l3.handgun' | 'l3.attack' | 'l3.crossed' }
  | { tick: number; type: 'l3.wave'; wave: number; count: number }
  | { tick: number; type: 'l3.fallback'; cause: 'time' | 'turned' | 'inside'; squad: number[] }
  | { tick: number; type: 'l3.squad-lost'; id: number; cause: 'bite' | 'kill' | 'separated' }
  | { tick: number; type: 'l3.segment'; segment: number; squad: number }
  | { tick: number; type: 'l3.gunfire'; sourceId: number; position: { x: number; z: number } }
  /** E22 beats: the convoy rolls and stops, the machine gun is issued, the first turn, the war starts, a tank round, a helicopter pass, an HMG burst, the line breaks, the cellar door is barred. */
  | { tick: number; type: 'l4.convoyStarted' | 'l4.convoyArrived' | 'l4.gun' | 'l4.war' | 'l4.heliWithdrawn' | 'l4.descended' | 'l4.doorBarred' | 'l4.battle' }
  | { tick: number; type: 'l4.firstTurn'; ids: number[]; humansNear: number }
  | { tick: number; type: 'l4.lineBreaks'; cause: 'time' | 'soldiers' | 'inside' | 'forced' }
  | { tick: number; type: 'l4.wave'; wave: number; count: number; edges: number[] }
  | { tick: number; type: 'l4.tankFire'; from: { x: number; z: number }; to: { x: number; z: number }; shot: number }
  | { tick: number; type: 'l4.heliPass'; from: { x: number; z: number }; to: { x: number; z: number } }
  | { tick: number; type: 'hmg.burst'; sourceId: number }
  | { tick: number; type: 'ally.attack'; sourceId: number; targetId: number; role: 'firefighter' | 'officer' | 'soldier' | 'civilian' | 'heli' | 'tank'; weapon?: 'hmg' | 'rifle' | 'pistol' | 'hunting-rifle' | 'door-gun'; hit?: boolean; from?: { x: number; z: number }; to?: { x: number; z: number } }
