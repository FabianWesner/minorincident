import { expect, test } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { audioCues, audioCategories, audioFile, eventCues, telegraphCues } from '../../../src/data/audioCues';
import { infectedDefinitions } from '../../../src/data/infected';
import imports from '../../../assets/audio/imports.json';
import { audioCredits } from '../../../src/data/audioCredits';
test('@E16 event stingers and audible UI cues use recorded sources', () => {
    const recipes = imports.cues as Record<string, { source: string }>;
    const naturalEvents = Object.values(audioCues).filter(c => c.id.startsWith('stinger.') || c.bus === 'ui' && c.gain > 0 || c.id === 'l1.outro.sting' || c.id === 'l1.ringing' || c.id === 'tinnitus' || c.id.startsWith('diegetic.') || c.id.startsWith('dialogue.') || c.id.startsWith('civilian.hey'));
    for (const cue of naturalEvents) {
        expect(recipes[cue.id], cue.id).toBeDefined();
        expect(recipes[cue.id].source, cue.id).not.toBe('blinding');
    }
    expect(recipes['stinger.low-hp'].source).toBe(recipes['impact.thump'].source);
    expect(recipes['l1.outro.sting'].source).toBe('aftermath');
});
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
        expect(line).toMatch(/self-made \(MIT\)|CC0|CC-BY (3\.0|4\.0)/);
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
    expect(readFileSync('assets/audio/LICENSES.md', 'utf8')).toBe(licenses);
    for (const [id, source] of Object.entries(imports.sources)) {
        expect(['CC0', 'CC-BY 3.0', 'CC-BY 4.0'], id).toContain(source.license);
        expect(source.url).toMatch(/^https:\/\//);
        expect(source.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\/(licenses\/by\/(3\.0|4\.0)|publicdomain\/zero\/1\.0)\/$/);
        expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
        if (source.license.startsWith('CC-BY')) {
            expect(audioCredits.some(c => c.author === source.author && c.url === source.url), id).toBe(true);
            expect(readFileSync('THIRD_PARTY_NOTICES.md', 'utf8')).toContain(source.author);
        }
    }
    for (const [id, recipe] of Object.entries(imports.cues)) {
        expect(audioCues[id], id).toBeDefined();
        expect(imports.sources[recipe.source as keyof typeof imports.sources], id).toBeDefined();
        expect(licenses).toContain(`| ${id} |`);
    }
});
