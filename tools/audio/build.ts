import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { audioCategories, audioCues, categoryDuration } from '../../src/data/audioCues';
import { synthesize, wave } from '../../src/audio/synthesis';
import imports from '../../assets/audio/imports.json';
const scoreOnly = process.argv.includes('--score-only');
const selected = new Set(scoreOnly ? [] : process.argv.length > 2 ? process.argv.slice(2) : audioCategories);
for (const category of selected)
    if (!audioCategories.includes(category))
        throw new Error(`Unknown audio category: ${category}`);
const rate = 48000, output = 'public/assets/audio', temp = mkdtempSync(join(tmpdir(), 'minor-incident-audio-'));
mkdirSync(output, { recursive: true });
const cache = process.env.AUDIO_MASTER_CACHE ?? join(tmpdir(), 'minor-incident-audio-masters');
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const pcmCache = new Map<string, Float32Array>();
const licenses = ['# Audio sources and licenses', '',
    'Built with `npx tsx tools/audio/build.ts`; source recipes: `assets/audio/imports.json`.',
    'CC-BY recordings remain under their own license. Edits: excerpts, EQ, fades, loudness normalization, Opus/AAC encoding.',
    'Residual synthesized system cues: Minor Incident contributors, self-made (MIT), `src/audio/synthesis.ts`.',
    'No Bruno SFX or John Murphy recordings/samples are used.', '', '| File | License | Author / source / license URL | SHA256 |', '| --- | --- | --- | --- |'];
function run(args: string[]): Buffer {
    const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-threads', '1', ...args], { maxBuffer: 256 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`Audio processing failed: ${result.stderr.toString()}`);
    return result.stdout;
}
function master(id: string): string {
    const source = imports.sources[id as keyof typeof imports.sources];
    if (!source) throw new Error(`Unknown recording: ${id}`);
    const root = join(cache, source.pack), download = join(root, source.downloadFile), path = join(root, source.member);
    mkdirSync(root, { recursive: true });
    if (!existsSync(download)) {
        const result = spawnSync('curl', ['--fail', '--location', '--retry', '2', '--max-time', '120', '--silent', '--show-error', source.downloadUrl, '-o', download]);
        if (result.status !== 0) throw new Error(`Recording download failed: ${id}`);
    }
    if (hash(download) !== source.downloadSha256) throw new Error(`Recording download hash changed: ${id}`);
    if (!existsSync(path)) {
        const result = spawnSync('bsdtar', ['-xf', download, '-C', root, source.member]);
        if (result.status !== 0) throw new Error(`Recording extraction failed: ${id}`);
    }
    if (hash(path) !== source.sha256) throw new Error(`Recording master hash changed: ${id}`);
    return path;
}
interface Recipe { source: string; start: number; filter?: string; }
function recording(recipe: Recipe, duration: number, loop = false, music = false): Float32Array {
    const key = `${recipe.source}:${recipe.start}:${duration}:${recipe.filter ?? ''}:${music}`;
    if (!pcmCache.has(key)) {
        // Sample trimming also works for older tiny FLACs whose seek tables are broken.
        const raw = run(['-i', master(recipe.source), '-t', String(duration),
            '-af', `atrim=start=${recipe.start}:duration=${duration},asetpts=PTS-STARTPTS,${recipe.filter ? `${recipe.filter},` : ''}${music ? 'loudnorm=I=-18:TP=-2:LRA=9,' : ''}apad,atrim=duration=${duration}`,
            '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-']);
        let samples = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
        // Short recordings (single hits) are zero-padded to the cue length; only an empty decode is an error.
        if (samples.length < Math.round(duration * rate)) { const padded = new Float32Array(Math.round(duration * rate)); padded.set(samples); samples = padded; }
        let peak = 0;
        for (const value of samples) peak = Math.max(peak, Math.abs(value));
        if (peak < 0.00001) throw new Error(`Recording slice is silent: ${recipe.source} at ${recipe.start}s`);
        const trim = music ? 1 : peak > 0 ? 0.5 / peak : 1;
        const fade = Math.min(Math.round((loop ? 0.04 : 0.004) * rate), Math.floor(samples.length / 8));
        for (let i = 0; i < samples.length; i++)
            samples[i] *= trim * Math.min(1, i / Math.max(1, fade), (samples.length - 1 - i) / Math.max(1, fade));
        pcmCache.set(key, samples);
    }
    return pcmCache.get(key)!;
}
/** Synthesized slices never exceed the ceiling (recorded slices are already peak-normalised to 0.5, music to -2 dBTP). */
function capPeak(samples: Float32Array, max: number): Float32Array {
    let peak = 0;
    for (const value of samples) peak = Math.max(peak, Math.abs(value));
    if (peak > max) for (let i = 0; i < samples.length; i++) samples[i] *= max / peak;
    return samples;
}
function encode(name: string, samples: Float32Array, bitrate = '64k'): void {
    const wav = join(temp, `${name}.wav`);
    writeFileSync(wav, wave([samples], rate));
    for (const [ext, codec] of [['webm', 'libopus'], ['m4a', 'aac']])
        run(['-y', '-i', wav, '-c:a', codec, '-b:a', bitrate, ...(ext === 'm4a' ? ['-movflags', '+faststart'] : []), `${output}/${name}.${ext}`]);
}
function notice(sourceIds: string[]): string {
    return [...new Set(sourceIds)].map(id => {
        const s = imports.sources[id as keyof typeof imports.sources];
        return `${s.license}: ${s.title} — ${s.author}; [source](${s.url}); [license](${s.licenseUrl})`;
    }).filter((line, index, all) => all.indexOf(line) === index).join('<br>') || 'self-made (MIT): Minor Incident contributors; src/audio/synthesis.ts';
}
try {
    for (const category of audioCategories) {
        if (selected.has(category)) {
            const samples = new Float32Array(Math.ceil(categoryDuration(category) * rate));
            for (const cue of Object.values(audioCues)) {
                if (cue.category !== category) continue;
                const recipe = (imports.cues as Record<string, Recipe>)[cue.id];
                samples.set(recipe ? recording(recipe, cue.duration, cue.loop, cue.bus === 'music') : capPeak(synthesize(cue, rate), 0.7), Math.round(cue.offset * rate));
            }
            if (!category.startsWith('music')) capPeak(samples, 0.6); // sprite ceiling: about -4.4 dBFS before Opus/AAC overshoot, so every file stays under -1 dBTP
            // Streamed stereo score is 96k. Compact mono sprites keep both codecs below 4MB.
            encode(category, samples, category === 'ambience' ? '32k' : category.startsWith('music-') ? '48k' : '64k');
            pcmCache.clear();
        }
        for (const ext of ['webm', 'm4a']) {
            const file = `${category}.${ext}`;
            const ids = Object.values(audioCues).filter(c => c.category === category).flatMap(c => {
                const recipe = (imports.cues as Record<string, Recipe>)[c.id]; return recipe ? [recipe.source] : [];
            });
            licenses.push(`| ${file} | ${ids.length ? 'CC0 / CC-BY / self-made (MIT); see segment map' : 'self-made (MIT)'} | ${notice(ids)} | ${hash(`${output}/${file}`)} |`);
        }
    }
    for (const [state, stream] of Object.entries(imports.streams)) {
        const name = `score-${state}`;
        if (scoreOnly || process.argv.length <= 2 || !existsSync(`${output}/${name}.webm`)) {
            const wav = join(temp, `${name}.wav`);
            // Preserve the guitar recordings' stereo image; only positional SFX sprites are mono.
            run(['-y', '-i', master(stream.source), '-t', String(stream.duration),
                '-af', `atrim=start=${stream.start}:duration=${stream.duration},asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-2:LRA=9,afade=t=in:d=0.04,afade=t=out:st=${stream.duration - 0.04}:d=0.04`,
                '-ar', String(rate), '-ac', '2', wav]);
            // Measure the completed excerpt, then trim it: single-pass normalization can drift
            // on a slow build when an output duration cuts the normalizer's lookahead tail.
            const analysis = spawnSync('ffmpeg', ['-hide_banner', '-i', wav, '-af', 'loudnorm=I=-18:TP=-2:LRA=9:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
            if (analysis.status !== 0) throw new Error(`Music loudness analysis failed: ${state}`);
            const match = analysis.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
            if (!match) throw new Error(`Missing music loudness measurement: ${state}`);
            const measured = JSON.parse(match[0]) as { input_i: string; input_tp: string };
            const trim = Math.min(-18 - Number(measured.input_i), -2 - Number(measured.input_tp));
            for (const [ext, codec] of [['webm', 'libopus'], ['m4a', 'aac']])
                run(['-y', '-i', wav, '-af', `volume=${trim}dB`, '-c:a', codec, '-b:a', '96k', ...(ext === 'm4a' ? ['-movflags', '+faststart'] : []), `${output}/${name}.${ext}`]);
        }
        for (const ext of ['webm', 'm4a'])
            licenses.push(`| ${name}.${ext} | ${imports.sources[stream.source as keyof typeof imports.sources].license} | ${notice([stream.source])}; excerpt ${stream.start}–${stream.start + stream.duration}s | ${hash(`${output}/${name}.${ext}`)} |`);
    }
    licenses.push('', '## Exact source per sprite slice', '', '| Cue | Source recording | Start in master (s) | Sprite offset / duration (s) |', '| --- | --- | --- | --- |');
    for (const [id, recipe] of Object.entries(imports.cues)) {
        const cue = audioCues[id];
        if (!cue) throw new Error(`Recipe has no cue: ${id}`);
        licenses.push(`| ${id} | ${notice([recipe.source])} | ${recipe.start} | ${cue.offset.toFixed(3)} / ${cue.duration.toFixed(3)} |`);
    }
    writeFileSync(`${output}/LICENSES.md`, licenses.join('\n') + '\n');
    mkdirSync('assets/audio', { recursive: true });
    writeFileSync('assets/audio/LICENSES.md', licenses.join('\n') + '\n');
}
finally {
    rmSync(temp, { recursive: true, force: true });
}
