import type { InputFrame } from './InputFrame';
export interface Recording {
  version: 1;
  seed: number;
  level: string;
  checkpoint?: string;
  frames: InputFrame[];
}
/** Pure .ssrec recorder/player, usable in Node and browsers. Captures own their data. */
export class Recorder {
  private recording: Recording | null = null;
  private playback: Recording | null = null;
  private cursor = 0;
  start(meta: Omit<Recording, 'version' | 'frames'>): void { this.reset(); this.recording = { version: 1, ...meta, frames: [] }; }
  capture(frame: InputFrame): void { this.recording?.frames.push(structuredClone(frame)); }
  stop(): Recording {
    if (!this.recording) throw new Error('No recording in progress');
    const result = this.recording; this.recording = null; return result;
  }
  play(data: Recording): void { this.reset(); this.playback = Recorder.parse(Recorder.serialize(data)); }
  next(): InputFrame | null { return this.playback?.frames[this.cursor++] ?? null; }
  get playing(): boolean { return this.playback !== null; }
  reset(): void { this.recording = null; this.playback = null; this.cursor = 0; }
  static serialize(data: Recording): string { return JSON.stringify(data); }
  static parse(text: string): Recording {
    const data: Recording = JSON.parse(text);
    const vector = (v: { x: number; z: number }): boolean => Boolean(v) && Number.isFinite(v.x) && Number.isFinite(v.z);
    const button = (b: InputFrame['left']): boolean => Boolean(b) && typeof b.down === 'boolean' && typeof b.held === 'boolean' && typeof b.up === 'boolean';
    if (!data || data.version !== 1 || !Number.isSafeInteger(data.seed) || typeof data.level !== 'string' || (data.checkpoint !== undefined && typeof data.checkpoint !== 'string') || !Array.isArray(data.frames) || data.frames.some((f) =>
      !f || !vector(f.move) || (f.aim !== null && !vector(f.aim)) || (f.aimPoint != null && !vector(f.aimPoint)) || ![null, 'pointer', 'keyboard', 'touch', 'assist'].includes(f.aimSource) || !button(f.left) || !button(f.right) || ![-1, 0, 1].includes(f.selector) || typeof f.interact !== 'boolean' || typeof f.pause !== 'boolean'
    )) throw new Error('Invalid .ssrec recording');
    return data;
  }
}
