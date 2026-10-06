import { Rng, fnv1a } from '../core/Rng';
import type { AudioCue } from '../data/audioCues';
/** Original procedural placeholders; no third-party recordings or voices. Shared by the asset builder
 * and impulse-response generation. Audio assets can be replaced without changing cue contracts. */
export function synthesize(cue: AudioCue, sampleRate: number): Float32Array {
    const samples = new Float32Array(Math.ceil(cue.duration * sampleRate)), rng = new Rng(fnv1a(cue.id), 'synthesis');
    const tau = 2 * Math.PI, f = cue.frequency;
    let low = 0;
    const melody = [0, 4, 7, 9, 7, 4, 2, 0];
    const level = Number(cue.id.match(/\.L(\d)\./)?.[1] ?? 1);
    const layer = cue.id.split('.').at(-1);
    for (let i = 0; i < samples.length; i++) {
        const t = i / sampleRate, phase = t / cue.duration;
        const n = rng.next() * 2 - 1;
        low += 0.025 * (n - low);
        const edge = Math.min(1, t * 150, (cue.duration - t) * 100);
        let value = 0;
        switch (cue.shape) {
            case 'shot':
                value = (n * 0.8 + Math.sin(tau * 90 * t) * 0.35) * Math.exp(-t * 45);
                break;
            case 'noise':
                value = (n * 0.35 + low * 2) * Math.exp(-phase * 5);
                break;
            case 'step':
                value = (Math.sin(tau * f * t) * 0.45 + n * 0.35) * Math.exp(-t * 35);
                break;
            case 'tone':
                value = Math.sin(tau * f * t) * (cue.loop ? 0.25 : 0.35 * Math.sin(Math.PI * phase));
                break;
            case 'vocal': {
                // Source/filter-like voiced phonation. Formant harmonics and syllables provide original bark/effort placeholders.
                const pitch = f * (1 + 0.03 * Math.sin(tau * 5 * t) + 0.1 * phase);
                const syllable = Math.max(0, Math.sin(tau * (cue.id === 'dialogue.radio' ? 3 : 2) * t));
                value = (Math.sin(tau * pitch * t) * 0.35 + Math.sin(tau * pitch * 4 * t) * 0.25 + Math.sin(tau * pitch * 9 * t) * 0.18 + n * 0.035) * (0.3 + syllable * 0.7) * Math.sin(Math.PI * phase);
                break;
            }
            case 'buzz': {
                // Mains hum with failing-ballast dropouts.
                const gate = Math.sin(tau * 11 * t) > -0.2 && Math.sin(tau * 3.7 * t) > -0.6 ? 1 : 0.15;
                value = (Math.sin(tau * 100 * t) * 0.3 + Math.sin(tau * 300 * t) * 0.2 + n * 0.12) * gate * (0.6 + 0.4 * Math.sin(Math.PI * phase));
                break;
            }
            case 'chatter': {
                // Overlapping murmured syllables: band-limited noise with 3-5 Hz modulation.
                const mod = Math.max(0, Math.sin(tau * 5 * t)) * 0.6 + Math.max(0, Math.sin(tau * 3 * t + 1)) * 0.4;
                value = (low * 3 + Math.sin(tau * f * (1 + 0.2 * Math.sin(tau * 2 * t)) * t) * 0.06) * (0.3 + mod * 0.7);
                break;
            }
            case 'bed':
                value = low * 0.9 + Math.sin(tau * f * t) * 0.06 + Math.sin(tau * (f * 1.51) * t) * 0.03;
                break;
            case 'music': {
                const note = Math.floor(phase * 8), local = (phase * 8) % 1;
                const root = cue.id.startsWith('music.') ? 130.8128 : f;
                const semitone = melody[note % 8] - (level >= 4 ? 12 : 0) + (level === 6 && note % 3 === 0 ? -1 : 0);
                const pitch = root * 2 ** (semitone / 12);
                if (layer === 'pulse')
                    value = Math.sin(tau * pitch * 2 * t) * Math.exp(-local * 12) * 0.22;
                else if (layer === 'drive')
                    value = (Math.sin(tau * 65 * t) * Math.exp(-local * 24) + n * Math.exp(-((local + 0.5) % 1) * 35) * 0.6) * 0.22;
                else if (layer === 'peak')
                    value = (Math.sin(tau * pitch * 4 * t) + Math.sin(tau * pitch * 6 * t) * 0.25) * Math.exp(-local * 4) * 0.2;
                else
                    value = (Math.sin(tau * pitch * t) * 0.25 + Math.sin(tau * pitch * 2 * t) * 0.14 + Math.sin(tau * pitch * 3 * t) * 0.08) * Math.exp(-local * 3);
                if (cue.id.endsWith('.warped'))
                    value *= 0.4 + 0.6 * Math.max(0, Math.sin(tau * 3 * t));
                break;
            }
        }
        samples[i] = value * edge;
    }
    return samples;
}
export function wave(samples: readonly Float32Array[], sampleRate: number): Uint8Array {
    const frames = samples[0].length, channels = samples.length, bytes = new Uint8Array(44 + frames * channels * 2), view = new DataView(bytes.buffer);
    const ascii = (offset: number, s: string) => { for (let i = 0; i < s.length; i++)
        view.setUint8(offset + i, s.charCodeAt(i)); };
    ascii(0, 'RIFF');
    view.setUint32(4, bytes.length - 8, true);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    ascii(36, 'data');
    view.setUint32(40, bytes.length - 44, true);
    for (let i = 0; i < frames; i++)
        for (let c = 0; c < channels; c++)
            view.setInt16(44 + (i * channels + c) * 2, Math.round(Math.max(-1, Math.min(1, samples[c][i])) * 32767), true);
    return bytes;
}
