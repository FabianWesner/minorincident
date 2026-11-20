import type { SimWorld } from '../../sim/world/SimWorld';
import { cureHangar } from '../../data/l10Story';

const inPersonSpeaker: Record<string, 'voss' | 'ruiz' | 'sam'> = {
  'L10.voss-intro': 'voss', 'L10.voss-sample': 'voss', 'L10.voss-cure': 'voss',
  'L10.voss-delivery': 'voss', 'L10.voss-prototype': 'voss', 'L10.voss-stay': 'voss',
  'L10.ruiz': 'ruiz', 'L10.sam-coming': 'sam', 'L10.sam-coming.reyes': 'sam',
  'L10.sam-delivery': 'sam', 'L10.sam-delivery.reyes': 'sam',
};

/** Resolve authored in-person lines to their existing actor; radio and narration have no actor. */
export function speakingNpc(world: SimWorld, id: number): boolean {
  const mission = world.missions, subtitle = mission?.state.subtitle;
  if (!subtitle || subtitle.until <= world.tick || !mission) return false;
  // The sergeant is the first squad officer, spawned at the armory briefing post.
  if (world.scenario === 'L3' && (subtitle.id === 'L3.sergeant' || subtitle.id === 'L3.handgun')) return mission.state.l3?.squadIds[0] === id;
  if (world.scenario === 'L4' && subtitle.id === 'L4.gun') return mission.state.l4?.qmId === id;
  if (world.scenario === 'L5' && subtitle.id.startsWith('L5.found.')) {
    const key = subtitle.id.slice('L5.found.'.length);
    return mission.state.l5?.survivors.some(row => row.key === key && row.id === id) ?? false;
  }
  if (world.scenario === 'L8') {
    const zoo = mission.l8?.state;
    if (['L8.nadia-path', 'L8.nadia-lion', 'L8.nadia-elephant'].includes(subtitle.id)) return zoo?.keeperId === id;
    if (subtitle.id === 'L8.hale-greeting' || subtitle.id === 'L8.hale-breach') return zoo?.haleId === id;
    if (subtitle.id.startsWith('L8.route-') && !subtitle.id.endsWith('.soldier')) return zoo?.keeperId === id;
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

/** Stable per-actor conversational beat: gestures alternate with a breathing/weight-shift idle. */
export function talkClip(id: number, tick: number): string {
  const hash = Math.imul(id, 2654435761) >>> 0;
  const duration = 1.5 + (Math.imul(hash, 2246822519) >>> 0) / 4294967296 * 1.5;
  const beat = Math.floor((tick / 60 + hash % 1000 / 1000 * duration) / duration);
  if (beat % 2 === 0) return 'idle';
  const variant = Math.imul(hash ^ Math.floor(beat / 2), 3266489917) >>> 0;
  return (['npc-gesture', 'npc-glance', 'npc-look-around', 'npc-wave-in', 'npc-plead'] as const)[variant % 5];
}
