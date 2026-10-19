/** Quiet, independent waiting gestures. Stable across LOD changes and checkpoint reloads. */
const waitingClips = ['npc-cower', 'npc-hug', 'npc-glance', 'npc-look-around'] as const;
export function waitingIdle(id: number): typeof waitingClips[number] { return waitingClips[(Math.imul(id, 2654435761) >>> 16) % waitingClips.length]; }
/** Spread adjacent IDs over the whole cycle instead of starting neighbouring people together. */
export function idleOffset(id: number): number { return ((Math.imul(id, 2654435761) >>> 0) / 4294967296) * 4; }
