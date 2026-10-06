import { spawnSync } from 'node:child_process';
/** Independent PCM/FFT and FFmpeg EBU R128 analysis; no production cue/mix values are read here. */
export interface Pcm {
    sampleRate: number;
    channels: Float64Array[];
}
export function pcm(wav: Uint8Array): Pcm {
    const v = new DataView(wav.buffer, wav.byteOffset, wav.byteLength), rate = v.getUint32(24, true), count = v.getUint16(22, true), bits = v.getUint16(34, true);
    if (bits !== 16)
        throw new Error('Expected PCM16 WAV');
    let offset = 12;
    while (offset + 8 < wav.length) {
        const id = String.fromCharCode(...wav.subarray(offset, offset + 4)), size = v.getUint32(offset + 4, true);
        if (id === 'data') {
            const frames = size / (count * 2), channels = Array.from({ length: count }, () => new Float64Array(frames));
            for (let f = 0; f < frames; f++)
                for (let c = 0; c < count; c++)
                    channels[c][f] = v.getInt16(offset + 8 + (f * count + c) * 2, true) / 32768;
            return { sampleRate: rate, channels };
        }
        offset += 8 + size + (size % 2);
    }
    throw new Error('WAV data chunk missing');
}
export function energy(p: Pcm, start = 0, end = p.channels[0].length / p.sampleRate): number { let sum = 0, n = 0; for (const channel of p.channels)
    for (let i = Math.floor(start * p.sampleRate); i < Math.min(channel.length, Math.floor(end * p.sampleRate)); i++) {
        sum += channel[i] ** 2;
        n++;
    } return sum / Math.max(1, n); }
export function rmsDb(p: Pcm, start = 0, end?: number): number { return 10 * Math.log10(Math.max(1e-15, energy(p, start, end))); }
function spectrum(channel: Float64Array, start: number, n: number): Float64Array {
    const real = new Float64Array(n), imag = new Float64Array(n);
    for (let i = 0; i < n; i++)
        real[i] = (channel[start + i] ?? 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1)
            j ^= bit;
        j ^= bit;
        if (i < j) {
            [real[i], real[j]] = [real[j], real[i]];
        }
    }
    for (let length = 2; length <= n; length <<= 1) {
        const a = -2 * Math.PI / length;
        for (let i = 0; i < n; i += length)
            for (let j = 0; j < length / 2; j++) {
                const r = Math.cos(a * j), im = Math.sin(a * j), k = i + j, l = k + length / 2, tr = real[l] * r - imag[l] * im, ti = real[l] * im + imag[l] * r;
                real[l] = real[k] - tr;
                imag[l] = imag[k] - ti;
                real[k] += tr;
                imag[k] += ti;
            }
    }
    const powers = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++)
        powers[i] = real[i] ** 2 + imag[i] ** 2;
    return powers;
}
export function centroid(p: Pcm, start = 0, end = 0.2): number { let weighted = 0, total = 0; const n = 2048; for (const channel of p.channels)
    for (let offset = Math.floor(start * p.sampleRate); offset < end * p.sampleRate; offset += n / 2) {
        const powers = spectrum(channel, offset, n);
        for (let i = 1; i < powers.length; i++) {
            weighted += powers[i] * i * p.sampleRate / n;
            total += powers[i];
        }
    } return weighted / total; }
export function bandEnergy(p: Pcm, start: number, end: number, low = 1000, high = 4000): number { let total = 0, count = 0; const n = 2048; for (const channel of p.channels)
    for (let offset = Math.floor(start * p.sampleRate); offset + n <= end * p.sampleRate; offset += n) {
        const powers = spectrum(channel, offset, n);
        for (let i = Math.ceil(low * n / p.sampleRate); i <= Math.floor(high * n / p.sampleRate); i++)
            total += powers[i];
        count++;
    } return total / Math.max(1, count); }
export function pitch(p: Pcm, start: number, end: number): number {
    // Autocorrelation fundamental, parabolic refinement. Engine pass-by tone lies between 120–220Hz.
    const channel = p.channels[0], from = Math.floor(start * p.sampleRate), to = Math.floor(end * p.sampleRate), correlations: number[] = [];
    let best = 0, max = -Infinity;
    for (let lag = Math.floor(p.sampleRate / 220); lag <= Math.ceil(p.sampleRate / 120); lag++) {
        let sum = 0, a = 0, b = 0;
        for (let i = from; i < to - lag; i++) {
            sum += channel[i] * channel[i + lag];
            a += channel[i] ** 2;
            b += channel[i + lag] ** 2;
        }
        const c = sum / Math.sqrt(a * b);
        correlations[lag] = c;
        if (c > max) {
            max = c;
            best = lag;
        }
    }
    const l = correlations[best - 1] ?? max, r = correlations[best + 1] ?? max, delta = 0.5 * (l - r) / (l - 2 * max + r || 1);
    return p.sampleRate / (best + delta);
}
export function rt60(p: Pcm, start = 0.18): number {
    const from = Math.floor(start * p.sampleRate), length = p.channels[0].length, curve = new Float64Array(length);
    let integral = 0;
    for (let i = length - 1; i >= from; i--) {
        for (const c of p.channels)
            integral += c[i] ** 2;
        curve[i] = integral;
    }
    const max = curve[from];
    let count = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = from; i < length; i++) {
        const db = 10 * Math.log10(curve[i] / max);
        if (db < -5 && db > -25) {
            const t = i / p.sampleRate;
            count++;
            sx += t;
            sy += db;
            sxx += t * t;
            sxy += t * db;
        }
    }
    if (count < 10)
        throw new Error('Insufficient reverb decay');
    const slope = (count * sxy - sx * sy) / (count * sxx - sx * sx);
    return -60 / slope;
}
export function loudness(path: string): {
    lufs: number;
    truePeak: number;
} {
    const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
    if (result.status !== 0)
        throw new Error(result.stderr);
    const text = result.stderr.slice(result.stderr.lastIndexOf('Summary:'));
    const lufs = Number(text.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]), truePeak = Number(text.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);
    if (!Number.isFinite(lufs) || !Number.isFinite(truePeak))
        throw new Error(`No loudness result: ${text}`);
    return { lufs, truePeak };
}
