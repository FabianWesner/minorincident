import { Rng, fnv1a } from '../core/Rng';
/**
 * Weapon pickup stingers (original, synthesised; no third-party recording). Each `pickup.fanfare.*` cue is the synthesised part of a short fanfare
 * (brass, organ, snare roll, guitar chord, twang, orchestra hit); the recorded foley layers (slide clack, bolt, clang, tube thump) are mixed in by
 * tools/audio/build.ts from `fanfare` in assets/audio/imports.json. Every part is pure maths on a seeded Rng, so a rebuild is bit-identical.
 */
const tau = 2 * Math.PI;
type Buf = Float32Array;
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
const note = (name: string): number => {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(name)!, base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return mtof(12 * (Number(m[3]) + 1) + base);
};
function mixIn(out: Buf, part: Buf, at: number, rate: number, gain = 1): void {
    const start = Math.round(at * rate);
    for (let i = 0; i < part.length && start + i < out.length; i++) out[start + i] += part[i] * gain;
}
/** Attack, short decay to a sustain level, linear release into the last `release` seconds. */
const adsr = (t: number, dur: number, a: number, d: number, s: number, r: number) => Math.min(t < a ? t / a : 1 - (1 - s) * Math.min(1, (t - a) / d), Math.max(0, (dur - t) / r));
/** Sawtooth-ish ensemble brass: harmonics open up as the note attacks (the "blat"), two slightly detuned players. */
function brass(f: number, dur: number, rate: number, vel = 1, bright = 9): Buf {
    const out = new Float32Array(Math.round(dur * rate));
    for (let i = 0; i < out.length; i++) {
        const t = i / rate, open = Math.min(1, t / 0.07), env = adsr(t, dur, 0.018, 0.12, 0.7, Math.min(0.12, dur / 2));
        let v = 0;
        for (const detune of [1, 1.004])
            for (let k = 1; k <= 12; k++) v += Math.sin(tau * f * detune * k * t) / k * Math.exp(-(k - 1) / (1 + bright * open * 0.6));
        out[i] = v * env * vel * 0.3;
    }
    return out;
}
/** Hammond-style drawbar organ with a gentle tremolo; stadium organ. */
function organ(f: number, dur: number, rate: number, vel = 1): Buf {
    const out = new Float32Array(Math.round(dur * rate)), bars: [number, number][] = [[1, 1], [2, 0.8], [3, 0.55], [4, 0.45], [6, 0.3], [8, 0.2]];
    for (let i = 0; i < out.length; i++) {
        const t = i / rate, env = adsr(t, dur, 0.008, 0.05, 0.85, Math.min(0.06, dur / 2)), trem = 1 + 0.12 * Math.sin(tau * 6.2 * t);
        let v = 0;
        for (const [k, w] of bars) v += Math.sin(tau * f * k * t) * w;
        out[i] = v * env * trem * vel * 0.17;
    }
    return out;
}
/** Referee pea whistle: a 2.9 kHz sine rattled by a ~35 Hz pea, with a little breath noise. */
function whistle(dur: number, rate: number, rng: Rng): Buf {
    const out = new Float32Array(Math.round(dur * rate));
    for (let i = 0; i < out.length; i++) {
        const t = i / rate, env = adsr(t, dur, 0.02, 0.05, 0.9, 0.06), pea = 0.65 + 0.35 * Math.sin(tau * 34 * t), f = 2900 + 90 * Math.sin(tau * 34 * t) + 120 * Math.min(1, t / 0.1);
        out[i] = (Math.sin(tau * f * t) * 0.75 + Math.sin(tau * f * 2 * t) * 0.12 + (rng.next() * 2 - 1) * 0.07) * env * pea * 0.4;
    }
    return out;
}
/** Snare hit: band-limited noise burst plus a 190 Hz shell tone. */
function snare(rate: number, rng: Rng, vel = 1, dur = 0.14): Buf {
    const out = new Float32Array(Math.round(dur * rate));
    let a = 0, b = 0;
    for (let i = 0; i < out.length; i++) {
        const t = i / rate, n = rng.next() * 2 - 1;
        a += 0.55 * (n - a); b += 0.04 * (a - b); // a: low-passed noise, a - b: band-pass around the snare wires
        out[i] = ((a - b) * 0.9 * Math.exp(-t * 32) + Math.sin(tau * 190 * t) * 0.35 * Math.exp(-t * 45)) * vel * 0.8;
    }
    return out;
}
/** Karplus-Strong plucked string. `damp` closer to 1 keeps highs longer. */
function string(f: number, dur: number, rate: number, rng: Rng, damp = 0.5, feedback = 0.997): Buf {
    const n = Math.max(2, Math.round(rate / f)), line = new Float32Array(n), out = new Float32Array(Math.round(dur * rate));
    for (let i = 0; i < n; i++) line[i] = rng.next() * 2 - 1;
    let pos = 0, last = 0;
    for (let i = 0; i < out.length; i++) {
        const cur = line[pos], filtered = (cur * damp + last * (1 - damp)) * feedback;
        last = cur; line[pos] = filtered; pos = (pos + 1) % n;
        out[i] = cur;
    }
    return out;
}
/** Overdriven power chord: root, fifth and octave strings, soft-clipped, with a body low-pass. */
function powerChord(root: number, dur: number, rate: number, rng: Rng, drive = 6): Buf {
    const out = new Float32Array(Math.round(dur * rate));
    for (const [ratio, w] of [[1, 1], [1.5, 0.9], [2, 0.8], [3, 0.5]] as const) mixIn(out, string(root * ratio, dur, rate, rng, 0.42, 0.9985), 0, rate, w * 0.5);
    let lp = 0;
    for (let i = 0; i < out.length; i++) {
        lp += 0.35 * (Math.tanh(out[i] * drive) - lp);
        out[i] = lp * Math.min(1, (dur - i / rate) / 0.15) * 0.8;
    }
    return out;
}
/** Western twang: a bent, vibrato-laden plucked note with a spring-reverb tail. */
function twang(f: number, dur: number, rate: number, bend = 0.9): Buf {
    const out = new Float32Array(Math.round(dur * rate));
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
        const t = i / rate, glide = 1 - (1 - bend) * Math.exp(-t * 28), vib = 1 + (t > 0.25 ? 0.012 * Math.min(1, (t - 0.25) / 0.2) * Math.sin(tau * 5.5 * t) : 0);
        phase += tau * f * glide * vib / rate;
        let v = 0;
        for (let k = 1; k <= 10; k++) v += Math.sin(phase * k) / k * Math.exp(-t * (1.6 + k * 0.9)) * (1 + (k === 3 ? 0.5 : 0));
        out[i] = v * Math.min(1, t / 0.002) * Math.min(1, (dur - t) / 0.1) * 0.5;
    }
    return out;
}
/** Feedback-comb "room" for a bigger sound; mixes the wet signal back at `wet`. */
function room(x: Buf, rate: number, wet: number, times = [0.037, 0.053, 0.071], fb = 0.5): void {
    const src = Float32Array.from(x);
    for (const [index, time] of times.entries()) {
        const d = Math.round(time * rate), line = new Float32Array(src.length);
        for (let i = 0; i < src.length; i++) line[i] = src[i] + (i >= d ? line[i - d] * fb : 0);
        for (let i = d; i < x.length; i++) x[i] += line[i - d] * wet / (index + 1);
    }
}
/** Orchestra hit: stacked brass and strings chord, timpani drop, cymbal wash. */
function orchestraHit(dur: number, rate: number, rng: Rng): Buf {
    const out = new Float32Array(Math.round(dur * rate));
    for (const [n, w] of [['D2', 1], ['A2', 0.8], ['D3', 0.9], ['F3', 0.6], ['A3', 0.8], ['D4', 0.7], ['F4', 0.5]] as const) mixIn(out, brass(note(n), Math.min(dur, 1.1), rate, 1, 12), 0, rate, w * 0.7);
    let wash = 0;
    for (let i = 0; i < out.length; i++) {
        const t = i / rate, n = rng.next() * 2 - 1;
        wash += 0.8 * (n - wash);
        const timpani = Math.sin(tau * (48 + 60 * Math.exp(-t * 14)) * t) * Math.exp(-t * 4.5);
        out[i] += timpani * 0.9 + (n - wash) * 0.5 * Math.exp(-t * 3.2);
    }
    room(out, rate, 0.4, [0.047, 0.083, 0.121], 0.55);
    return out;
}
/** Xylophone-like bar: sine plus a 4x partial, fast decay. */
function bar(f: number, dur: number, rate: number, vel = 1): Buf {
    const out = new Float32Array(Math.round(dur * rate));
    for (let i = 0; i < out.length; i++) { const t = i / rate; out[i] = (Math.sin(tau * f * t) + Math.sin(tau * f * 4.01 * t) * 0.3) * Math.exp(-t * 9) * Math.min(1, t / 0.002) * vel * 0.5; }
    return out;
}
/** A flame lighting: a filtered-noise swell with crackle. */
function ignite(dur: number, rate: number, rng: Rng): Buf {
    const out = new Float32Array(Math.round(dur * rate));
    let lp = 0;
    for (let i = 0; i < out.length; i++) {
        const t = i / rate, n = rng.next() * 2 - 1, swell = Math.min(1, t / 0.12) * Math.exp(-Math.max(0, t - 0.12) * 3.5);
        lp += (0.08 + 0.25 * Math.min(1, t / 0.15)) * (n - lp);
        const crackle = rng.next() > 0.9985 ? (rng.next() * 2 - 1) * 1.2 : 0;
        out[i] = lp * swell * 1.8 + crackle * Math.exp(-t * 3);
    }
    return out;
}
/** Rising shimmer arpeggio for utility abilities and light stings. */
function sparkle(notes: string[], gap: number, rate: number, dur: number, vel = 1): Buf {
    const out = new Float32Array(Math.round(dur * rate));
    notes.forEach((n, index) => mixIn(out, bar(note(n), 0.5, rate, vel * (0.7 + 0.1 * index)), index * gap, rate));
    return out;
}
/** Synthesised bodies per cue id. Returns a peak-normalised (0.5) mono buffer of `duration` seconds. */
export function fanfare(id: string, duration: number, rate: number): Float32Array {
    const key = id.replace('pickup.fanfare.', ''), rng = new Rng(fnv1a(id), 'fanfare'), out = new Float32Array(Math.ceil(duration * rate));
    const add = (part: Buf, at: number, gain = 1) => mixIn(out, part, at, rate, gain);
    switch (key) {
        case 'bat': // stadium organ charge, closed by a referee whistle
            for (const [n, at, len] of [['C5', 0.12, 0.11], ['E5', 0.25, 0.11], ['G5', 0.38, 0.11], ['E5', 0.58, 0.14], ['G5', 0.76, 0.5]] as const) add(organ(note(n), len, rate), at);
            for (const [n, at, len] of [['C5', 0.12, 0.11], ['E5', 0.25, 0.11], ['G5', 0.38, 0.11], ['E5', 0.58, 0.14], ['G5', 0.76, 0.5]] as const) add(organ(note(n) / 2, len, rate), at, 0.5);
            add(whistle(0.32, rate, rng), 1.0, 0.7);
            room(out, rate, 0.18);
            break;
        case 'fire-axe': // overdriven E5 power chord, a lower stab under it
            add(powerChord(82.41, 1.7, rate, rng), 0.04);
            add(powerChord(41.2, 1.2, rate, rng, 4), 0.04, 0.55);
            room(out, rate, 0.15);
            break;
        case 'handgun': // after the slide clack: two short brass stabs
            add(brass(note('Bb3'), 0.12, rate, 1, 11), 0.25); add(brass(note('F4'), 0.12, rate, 1, 11), 0.25, 0.8);
            add(brass(note('Bb3'), 0.5, rate, 1, 11), 0.42); add(brass(note('F4'), 0.5, rate, 1, 11), 0.42, 0.8); add(brass(note('Bb4'), 0.5, rate, 1, 11), 0.42, 0.7);
            room(out, rate, 0.12);
            break;
        case 'army-mg': { // snare roll accelerating and swelling into a brass stab; the bolt layers sit at the start and on the stab
            let at = 0.28, gap = 0.085, vel = 0.4;
            while (at < 1.12) { add(snare(rate, rng, vel), at, 2.4); at += gap; gap = Math.max(0.032, gap * 0.93); vel = Math.min(1, vel + 0.04); }
            for (const [n, w] of [['D3', 1], ['A3', 0.9], ['D4', 0.8], ['A4', 0.6]] as const) add(brass(note(n), 0.75, rate, 1, 12), 1.14, w * 0.7);
            add(snare(rate, rng, 1, 0.3), 1.14, 2.6);
            room(out, rate, 0.14);
            break;
        }
        case 'shotgun': // pump layers first, then a bent western twang phrase
            add(twang(note('B3'), 0.3, rate, 0.88), 0.5, 0.9);
            add(twang(note('E4'), 1.0, rate, 0.9), 0.72);
            add(twang(note('E3'), 1.0, rate, 0.96), 0.72, 0.5);
            room(out, rate, 0.3, [0.061, 0.097], 0.6);
            break;
        case 'rocket': // the orchestra hit lands as the tube settles on the shoulder
            add(orchestraHit(1.55, rate, rng), 0.42);
            break;
        case 'molotov': // light: flame catching, a small pizzicato lift
            add(ignite(0.8, rate, rng), 0.12, 0.7);
            add(sparkle(['D5', 'A5'], 0.12, rate, 0.9, 0.7), 0.35);
            break;
        case 'corgi-lure': // light, playful: squeak glides then a bright three-note lift
            for (const [from, to, at] of [[900, 1500, 0.02], [1100, 1800, 0.16]] as const) {
                const squeak = new Float32Array(Math.round(0.11 * rate));
                for (let i = 0, phase = 0; i < squeak.length; i++) { const t = i / rate; phase += tau * (from + (to - from) * t / 0.11) / rate; squeak[i] = Math.sin(phase) * Math.sin(Math.PI * t / 0.11) * 0.5; }
                add(squeak, at);
            }
            add(sparkle(['C6', 'E6', 'G6'], 0.1, rate, 0.9), 0.4);
            break;
        case 'throwable':
            add(sparkle(['G5', 'C6'], 0.1, rate, 0.85), 0.14);
            break;
        case 'ability':
            add(sparkle(['C5', 'E5', 'G5', 'C6'], 0.09, rate, 1.2), 0.0);
            room(out, rate, 0.25);
            break;
        case 'melee': // the clang layer, then a short brass stab
            add(brass(note('G3'), 0.4, rate, 1, 11), 0.12); add(brass(note('D4'), 0.4, rate, 1, 11), 0.12, 0.8);
            room(out, rate, 0.12);
            break;
        case 'gun':
            add(brass(note('C4'), 0.12, rate, 1, 11), 0.2); add(brass(note('G4'), 0.45, rate, 1, 11), 0.34); add(brass(note('C4'), 0.45, rate, 1, 11), 0.34, 0.8);
            room(out, rate, 0.12);
            break;
        default:
            throw new Error(`Unknown pickup fanfare: ${id}`);
    }
    let peak = 0;
    for (const v of out) peak = Math.max(peak, Math.abs(v));
    const edge = Math.round(0.012 * rate);
    for (let i = 0; i < out.length; i++) out[i] = out[i] / (peak || 1) * 0.5 * Math.min(1, (out.length - 1 - i) / edge);
    return out;
}
