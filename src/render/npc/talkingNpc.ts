import type { SimWorld } from '../../sim/world/SimWorld';
import { cureHangar } from '../../data/l10Story';

const inPersonSpeaker: Record<string, 'voss' | 'ruiz' | 'sam'> = {
  'L10.voss-intro': 'voss', 'L10.voss-sample': 'voss', 'L10.voss-cure': 'voss',
  'L10.voss-delivery': 'voss', 'L10.voss-prototype': 'voss', 'L10.voss-stay': 'voss',
  'L10.ruiz': 'ruiz', 'L10.sam-coming': 'sam', 'L10.sam-coming.reyes': 'sam',
  'L10.sam-delivery': 'sam', 'L10.sam-delivery.reyes': 'sam',
};
const soldierSpeakers = new WeakMap<SimWorld, { line: string; until: number; at: number; id: number }>();
const stationSpeakers = new WeakMap<SimWorld, { until: number; at: number; id: number }>();

/** The station script does not assign the captain line to a particular firefighter. */
function stationCaptain(world: SimWorld, until: number): number {
  const previous = stationSpeakers.get(world);
  if (previous?.until === until && world.tick >= previous.at) return previous.id;
  const player = world.entities.get(1)?.transform;
  const crew = world.missions?.state.l2?.crewIds ?? [];
  const candidates = player ? crew.flatMap(id => {
    const actor = world.entities.get(id);
    return actor?.civilian && !actor.hidden && actor.health.current > 0 && !actor.infection && !actor.infected
      ? [{ id, distance: Math.hypot(actor.transform.x - player.x, actor.transform.z - player.z) }] : [];
  }).sort((a, b) => a.distance - b.distance || a.id - b.id) : [];
  const id = candidates[0]?.id ?? 0;
  stationSpeakers.set(world, { until, at: world.tick, id });
  return id;
}

/** Choose one living guard for a generic soldier line and retain that identity for its duration. */
function zooSoldier(world: SimWorld, line: string, until: number): number {
  const previous = soldierSpeakers.get(world);
  if (previous?.line === line && previous.until === until && world.tick >= previous.at) return previous.id;
  const zoo = world.missions?.l8?.state, player = world.entities.get(1)?.transform;
  const guards = zoo && player ? [...zoo.guards, zoo.reyesId, zoo.haleId].flatMap(id => {
    const actor = world.entities.get(id);
    return actor?.civilian && !actor.hidden && actor.health.current > 0 && !actor.infection && !actor.infected
      ? [{ id, distance: Math.hypot(actor.transform.x - player.x, actor.transform.z - player.z) }] : [];
  }).sort((a, b) => a.distance - b.distance || a.id - b.id) : [];
  const id = guards[0]?.id ?? 0;
  soldierSpeakers.set(world, { line, until, at: world.tick, id });
  return id;
}

/** The gate guard is staged while the opening briefing is visible. */
export function zooGateGuard(world: SimWorld, id: number): boolean {
  const state = world.missions?.state;
  if (world.scenario !== 'L8' || !state) return false;
  if (state.phase === 'briefing') return zooSoldier(world, 'L8.gate-soldier', 0) === id;
  return state.subtitle?.id === 'L8.gate-soldier' && zooSoldier(world, state.subtitle.id, state.subtitle.until) === id;
}

/** Actor-anchored speech bubbles in L1, L2 and L6 carry their speaker ID. */
export function bubbleSpeaker(world: SimWorld, id: number): boolean {
  const state = world.missions?.state;
  const say = state?.l1?.say ?? state?.l2?.say ?? state?.l6?.say;
  return id !== 1 && !!say && say.id === id && world.tick >= say.at && world.tick < say.until;
}

/** Resolve authored in-person lines to their existing actor; radio and narration have no actor. */
export function speakingNpc(world: SimWorld, id: number): boolean {
  const mission = world.missions, subtitle = mission?.state.subtitle;
  if (!subtitle || subtitle.until <= world.tick || !mission) return false;
  if (world.scenario === 'L2' && subtitle.id === 'L2.captain') return stationCaptain(world, subtitle.until) === id;
  // The sergeant is the first squad officer, spawned at the armory briefing post.
  if (world.scenario === 'L3' && (subtitle.id === 'L3.sergeant' || subtitle.id === 'L3.handgun')) return mission.state.l3?.squadIds[0] === id;
  if (world.scenario === 'L4' && subtitle.id === 'L4.gun') return mission.state.l4?.qmId === id;
  if (world.scenario === 'L5' && subtitle.id.startsWith('L5.found.')) {
    const key = subtitle.id.slice('L5.found.'.length);
    return mission.state.l5?.survivors.some(row => row.key === key && row.id === id) ?? false;
  }
  if (world.scenario === 'L8') {
    const zoo = mission.l8?.state;
    if (subtitle.id === 'L8.gate-soldier' || subtitle.id.startsWith('L8.route-') && subtitle.id.endsWith('.soldier')) return zooSoldier(world, subtitle.id, subtitle.until) === id;
    if (['L8.nadia-path', 'L8.nadia-lion', 'L8.nadia-elephant', 'L8.nadia-elephant-pass', 'L8.nadia-flamingo-pass', 'L8.nadia-zebra-pass', 'L8.nadia-gorilla-pass', 'L8.nadia-safe', 'L8.nadia-gate-breach'].includes(subtitle.id)) return zoo?.keeperId === id;
    if (subtitle.id === 'L8.hale-greeting' || subtitle.id === 'L8.hale-breach' || subtitle.id === 'L8.hale-dying') return zoo?.haleId === id;
    if (subtitle.id.startsWith('L8.route-') && !subtitle.id.endsWith('.soldier')) return zoo?.keeperId === id;
  }
  if (world.scenario === 'L9') {
    const driving = mission.l9?.driving.state;
    if (['L9.briefing', 'L9.mega-drive', 'L9.stall.sam', 'L9.sam-stays'].includes(subtitle.id)) return driving?.samId === id;
    const key = ['L9.mega-what', 'L9.clingers'].includes(subtitle.id) ? 'mia'
      : ['L9.bus.dale', 'L9.bus.dale-beat'].includes(subtitle.id) ? 'dale' : subtitle.id === 'L9.okafor' ? 'okafor' : undefined;
    return !!key && (driving?.roster.some(actorId => actorId === id && world.entities.get(actorId)?.civilian?.survivor?.key === key) ?? false);
  }
  if (world.scenario !== 'L10') return false;
  const speaker = subtitle && subtitle.until > world.tick ? inPersonSpeaker[subtitle.id] : undefined;
  if (!speaker) return false;
  const entityId = world.missions!.state.actors[`hangar-${speaker}`];
  return entityId === id;
}

export function hangarCastMember(world: SimWorld, id: number): boolean {
  if (world.scenario !== 'L10') return false;
  const actors = world.missions?.state.actors;
  return !!actors && ['voss', 'ruiz', 'researcher', 'sam', 'guard-west', 'guard-east'].some(key => actors[`hangar-${key}`] === id);
}

/** Keep the hangar speakers in the exchange across adjacent lines. */
export function joiningHangarConversation(world: SimWorld, id: number): boolean {
  const state = world.missions?.state;
  if (world.scenario !== 'L10' || !state) return false;
  const player = world.entities.get(1)?.transform;
  if (state.actors['hangar-voss'] === id && state.steps['research-hangar']?.status === 'active' && player
    && Math.hypot(player.x - cureHangar.entrance.x, player.z - cureHangar.entrance.z) < 18) return true;
  if (state.steps.research?.status !== 'active') return false;
  const line = state.counters['hangar-line'];
  return state.actors['hangar-voss'] === id && line >= 0 && line <= 8
    || state.actors['hangar-ruiz'] === id && line >= 4 && line <= 5
    || state.actors['hangar-sam'] === id && line >= 6 && line <= 9;
}

/** The station sergeant can approach during the narrated opening before his line. */
export function joiningArmoryBriefing(world: SimWorld, id: number): boolean {
  const state = world.missions?.state;
  return world.scenario === 'L3' && state?.l3?.phase === 'yard' && state.subtitle?.id === 'L3.briefing' && state.l3.squadIds[0] === id;
}

/** Stable per-actor conversational beat: gestures alternate with a breathing/weight-shift idle. */
export function talkClip(id: number, tick: number): string {
  const hash = Math.imul(id, 2654435761) >>> 0;
  const duration = 1.5 + (Math.imul(hash, 2246822519) >>> 0) / 4294967296 * 1.5;
  const beat = Math.floor((tick / 60 + hash % 1000 / 1000 * duration) / duration);
  if (beat % 2 === 0) return 'idle';
  const variant = Math.imul(hash ^ Math.floor(beat / 2), 3266489917) >>> 0;
  return (['npc-gesture', 'npc-glance', 'npc-look-around', 'npc-wave-in', 'npc-plead'] as const)[variant % 5];
}
