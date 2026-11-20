import type { SimWorld } from '../../sim/world/SimWorld';

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
  if (world.scenario === 'L5' && subtitle.id.startsWith('L5.found.')) {
    const key = subtitle.id.slice('L5.found.'.length);
    return mission.state.l5?.survivors.some(row => row.key === key && row.id === id) ?? false;
  }
  if (world.scenario === 'L8') {
    const zoo = mission.l8?.state;
    if (['L8.nadia-path', 'L8.nadia-lion', 'L8.nadia-elephant'].includes(subtitle.id)) return zoo?.keeperId === id;
    if (subtitle.id === 'L8.hale-greeting' || subtitle.id === 'L8.hale-breach') return zoo?.haleId === id;
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

/** Stable per-actor conversational beat: gestures alternate with a breathing/weight-shift idle. */
export function talkClip(id: number, tick: number): string {
  const hash = Math.imul(id, 2654435761) >>> 0;
  const duration = 1.5 + (Math.imul(hash, 2246822519) >>> 0) / 4294967296 * 1.5;
  const beat = Math.floor((tick / 60 + hash % 1000 / 1000 * duration) / duration);
  if (beat % 2 === 0) return 'idle';
  const variant = Math.imul(hash ^ Math.floor(beat / 2), 3266489917) >>> 0;
  return (['npc-gesture', 'npc-glance', 'npc-look-around', 'npc-wave-in', 'npc-plead'] as const)[variant % 5];
}
