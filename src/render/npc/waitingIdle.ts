/** Quiet, independent waiting gestures. Stable across LOD changes and checkpoint reloads. */
const waitingClips = ['npc-cower', 'npc-hug', 'npc-glance', 'npc-look-around'] as const;
/** PO 10-22 #115 "What are they doing?": armed civilians holding the L4 plaza cowered with their guns. Someone who
 * holds a weapon waits alert (glancing or looking around), never crouched or hugging. */
const armedClips = ['npc-glance', 'npc-look-around'] as const;
const weapons = new Set(['pistol', 'hunting-rifle', 'rifle', 'shotgun', 'pipe', 'bat', 'crowbar', 'machete', 'axe']);
/** PO 10-23 Q-159 ("Also in L4 people behave strange"): chatting pairs crouched face to face in the open with no threat in sight.
 * Nobody cowers without a threat; a calm waiter (`threatened` false) glances instead. */
export function waitingIdle(id: number, handProp?: string | null, threatened = false): typeof waitingClips[number] {
  const hash = Math.imul(id, 2654435761) >>> 16;
  if (handProp && weapons.has(handProp)) return armedClips[hash % armedClips.length];
  const clip = waitingClips[hash % waitingClips.length];
  return clip === 'npc-cower' && !threatened ? 'npc-glance' : clip;
}
/** Spread adjacent IDs over the whole cycle instead of starting neighbouring people together. */
export function idleOffset(id: number): number { return ((Math.imul(id, 2654435761) >>> 0) / 4294967296) * 4; }
