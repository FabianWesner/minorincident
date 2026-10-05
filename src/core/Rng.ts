/** FNV-1a string hash, also used for canonical simulation snapshots. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}

/** Mulberry32 stream seeded by (levelSeed, streamName); never wall-clock seeded. */
export class Rng {
  private state: number;
  private cursor = 0;
  constructor(readonly seed: number, readonly stream: string) { this.state = fnv1a(`${seed}:${stream}`); }
  next(): number {
    this.cursor++;
    let t = this.state = (this.state + 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  snapshot(): { stream: string; state: number; cursor: number } { return { stream: this.stream, state: this.state, cursor: this.cursor }; }
}
