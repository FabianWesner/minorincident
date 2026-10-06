import { expect, test } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { audioCues, audioCategories, audioFile, eventCues, telegraphCues } from '../../../src/data/audioCues';
import { infectedDefinitions } from '../../../src/data/infected';
test('T-E16-01a @E16 @E16-AC01 every sim event and archetype resolves to a real sprite cue', () => {
    const source = readFileSync('src/sim/world/types.ts', 'utf8') + readFileSync('src/data/audioEvents.ts', 'utf8');
    const types = [...source.matchAll(/type:\s*((?:'[^']+'\s*\|\s*)*'[^']+')/g)].flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(t => t[1]));
    for (const type of types)
        expect(eventCues[type as keyof typeof eventCues], type).toBeDefined();
    expect(types.length).toBeGreaterThan(35);
    for (const id of Object.values(eventCues))
        expect(audioCues[id], id).toBeDefined();
    for (const def of infectedDefinitions) {
        expect(audioCues[telegraphCues[def.id]], def.id).toBeDefined();
        expect(def.windup).toBeGreaterThanOrEqual(def.special === 'scream' ? 0.8 : 0.35);
    }
    for (const cue of Object.values(audioCues))
        for (const format of ['webm', 'm4a'] as const)
            expect(existsSync(`public${audioFile(cue.category, format)}`), cue.id).toBe(true);
});
test('T-E16-19 @E16 @E16-AC19 L1 assets fit 4MB, SFX are sprite packed, and every file has Opus/AAC', () => {
    const initial = new Set(Object.values(audioCues).filter(c => c.initial).map(c => c.category));
    let total = 0;
    for (const category of audioCategories) {
        for (const format of ['webm', 'm4a'] as const) {
            const path = `public${audioFile(category, format)}`;
            expect(existsSync(path)).toBe(true);
            if (initial.has(category))
                total += statSync(path).size;
        }
        const cues = Object.values(audioCues).filter(c => c.category === category);
        expect(cues.length).toBeGreaterThan(1);
        expect(cues[0].offset).toBe(0);
        for (let i = 1; i < cues.length; i++)
            expect(cues[i].offset).toBeGreaterThanOrEqual(cues[i - 1].offset + cues[i - 1].duration);
    }
    expect(total).toBeLessThanOrEqual(4 * 1024 * 1024);
});
test('T-E16-20 @E16 @E16-AC20 every audio file has an allowed license/hash and no Bruno SFX match', () => {
    const root = 'public/assets/audio', licenses = readFileSync(`${root}/LICENSES.md`, 'utf8'), hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
    const files = readdirSync(root).filter(f => f !== 'LICENSES.md'), localHashes = new Set<string>();
    for (const file of files) {
        const line = licenses.split('\n').find(l => l.startsWith(`| ${file} |`));
        expect(line, file).toBeDefined();
        expect(line).toMatch(/self-made \(MIT\)/);
        expect(line).toContain(hash(`${root}/${file}`));
        localHashes.add(hash(`${root}/${file}`));
        expect(file).toMatch(/\.(webm|m4a)$/);
    }
    // Main checkout is the read-only reference in lanes; optionally absent on CI.
    const candidates = ['folio-2025/static/sounds', '/Users/fabianwesner/Workspace/suburban-survivors/folio-2025/static/sounds'];
    const reference = candidates.find(existsSync);
    if (reference)
        for (const entry of readdirSync(reference, { recursive: true, withFileTypes: true }))
            if (entry.isFile() && !entry.parentPath.includes('/musics') && /\.(mp3|wav|ogg|m4a|webm)$/i.test(entry.name))
                expect(localHashes.has(hash(`${entry.parentPath}/${entry.name}`)), entry.name).toBe(false);
    expect(readFileSync('THIRD_PARTY_NOTICES.md', 'utf8')).toContain('src/audio/synthesis.ts');
});
