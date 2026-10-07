import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { audioCues, lazyCategories } from '../../../src/data/audioCues';
import { audioCredits, codeCredits } from '../../../src/data/credits';
import imports from '../../../assets/audio/imports.json';
import { noticesWith, render } from '../../../tools/credits/generate';

test('@E16 generated Credits & Licenses data and THIRD_PARTY_NOTICES.md are in sync with their sources', () => {
    const { ts, notices } = render();
    expect(readFileSync('src/data/credits.ts', 'utf8'), 'run npx tsx tools/credits/generate.ts').toBe(ts);
    const current = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
    expect(noticesWith(current, notices), 'run npx tsx tools/credits/generate.ts').toBe(current);
});

test('@E16 every registry audio file and every recorded slice has a credit with author, source and license', () => {
    const sources = imports.sources as Record<string, { author: string; url: string; license: string; licenseUrl: string; member: string }>;
    const recipes = imports.cues as Record<string, { source: string }>;
    const used = [...Object.values(imports.streams).map(s => s.source), ...Object.entries(recipes).map(([id, r]) => { expect(audioCues[id], id).toBeDefined(); return r.source; })];
    for (const id of used) {
        const s = sources[id];
        const credit = audioCredits.find(c => c.url === s.url && c.author === s.author && c.license === s.license);
        expect(credit, id).toBeDefined();
        expect(credit!.licenseUrl).toBe(s.licenseUrl);
        expect(credit!.files, id).toContain(s.member.split('/').at(-1));
    }
    for (const credit of audioCredits) {
        expect(credit.license).toMatch(/^(CC0|CC-BY [34]\.0)$/);
        expect(credit.url).toMatch(/^https:\/\//);
    }
    // Every category file the registry loads is either credited recordings or the self-made synthesis credited as original work.
    for (const cue of Object.values(audioCues))
        if (recipes[cue.id]) expect(used).toContain(recipes[cue.id].source);
    expect(lazyCategories.has('infected')).toBe(true);
});

test('@E16 every production dependency is listed with its locked permissive license', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> };
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as { packages: Record<string, { version: string; license: string }> };
    for (const name of Object.keys(pkg.dependencies)) {
        const locked = lock.packages[`node_modules/${name}`];
        const credit = codeCredits.find(c => c.title === `${name} ${locked.version}`);
        expect(credit, name).toBeDefined();
        expect(credit!.license).toBe(locked.license);
        expect(credit!.license).toMatch(/^(MIT|Apache-2\.0|BSD-[23]-Clause|ISC)$/);
    }
    for (const reference of ['Bruno Simon', 'Mesh2Motion'])
        expect(codeCredits.some(c => c.author.startsWith(reference)), reference).toBe(true);
});
