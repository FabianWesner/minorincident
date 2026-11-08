import { Rng } from '../../src/core/Rng';
import type { AudioCue } from '../../src/data/audioCues';

/** Original MIT hits and double-pulse heartbeat, shared by both audio builders. */
export function synthesizeL10Farm(cue: AudioCue, rate: number): Float32Array {
  const samples = new Float32Array(Math.ceil(cue.duration * rate));
  const rng = new Rng(1029, cue.id), variant = Number(cue.id.at(-1)) || 0;
  const pulse = (a: number) => a < 0 ? 0 : Math.sin(2 * Math.PI * 56 * a) * Math.exp(-a * 40);
  for (let n = 0; n < samples.length; n++) {
    const t = n / rate, env = Math.min(1, t * 250, (cue.duration - t) * 100);
    const hit = cue.loop ? (pulse(t % 1) + pulse((t % 1) - .17) * .65) * .4
      : ((rng.next() * 2 - 1) * .28 + Math.sin(2 * Math.PI * (85 + variant * 25) * t) * .38 + Math.sin(2 * Math.PI * (480 + variant * 170) * t) * .16) * Math.exp(-t * (5 + variant));
    samples[n] = hit * env;
  }
  return samples;
}
