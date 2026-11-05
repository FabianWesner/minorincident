import { spawnSync } from 'node:child_process';
/** FFmpeg EBU R128 loudness analysis; no production cue/mix values are read here. */
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
