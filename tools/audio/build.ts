import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { audioCategories, audioCues, categoryDuration } from '../../src/data/audioCues';
import { synthesize, wave } from '../../src/audio/synthesis';
const selected = new Set(process.argv.length > 2 ? process.argv.slice(2) : audioCategories);
for (const category of selected)
    if (!audioCategories.includes(category))
        throw new Error(`Unknown audio category: ${category}`);
const rate = 48000, output = 'public/assets/audio', temp = mkdtempSync(join(tmpdir(), 'minor-incident-audio-'));
mkdirSync(output, { recursive: true });
const licenses = ['# Audio sources and licenses', '', 'All audio below is self-made procedural synthesis by the Minor Incident contributors.',
    'Source: `src/audio/synthesis.ts`, generated with `npx tsx tools/audio/build.ts`.',
    'Released under MIT, the repository license. No Bruno SFX or third-party recordings are used.', '', '| File | License | Source | SHA256 |', '| --- | --- | --- | --- |'];
try {
    for (const category of audioCategories) {
        if (selected.has(category)) {
            const samples = new Float32Array(Math.ceil(categoryDuration(category) * rate));
            for (const cue of Object.values(audioCues))
                if (cue.category === category)
                    samples.set(synthesize(cue, rate), Math.round(cue.offset * rate));
            const wav = join(temp, `${category}.wav`);
            writeFileSync(wav, wave([samples], rate));
            for (const [ext, codec] of [['webm', 'libopus'], ['m4a', 'aac']]) {
                const file = `${category}.${ext}`;
                const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-c:a', codec, '-b:a', '64k', ...(ext === 'm4a' ? ['-movflags', '+faststart'] : []), `${output}/${file}`], { stdio: 'inherit' });
                if (result.status !== 0)
                    throw new Error(`Audio encoding failed: ${file}`);
            }
        }
        for (const ext of ['webm', 'm4a']) {
            const file = `${category}.${ext}`;
            const hash = createHash('sha256').update(readFileSync(`${output}/${file}`)).digest('hex');
            licenses.push(`| ${file} | self-made (MIT) | synthesis.ts | ${hash} |`);
        }
    }
    writeFileSync(`${output}/LICENSES.md`, licenses.join('\n') + '\n');
}
finally {
    rmSync(temp, { recursive: true, force: true });
}
