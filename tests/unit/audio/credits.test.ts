import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { audioCues, lazyCategories } from '../../../src/data/audioCues';
import { audioCredits, codeCredits, technologyCredits, toolchainCredits } from '../../../src/data/credits';
import { madeBy } from '../../../src/data/madeBy';
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

/** PO 10-15: "Make sure in Credits we mention all libs we are using ... and also all technologies". Fails when any dependency, devDependency or shipped audio source lacks a credit. */
test('every dependency, devDependency, non-npm technology and audio source is credited with name, URL and license', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    const shown = [...codeCredits, ...toolchainCredits, ...technologyCredits, ...audioCredits];
    for (const name of Object.keys(pkg.dependencies))
        expect(codeCredits.some(c => c.title.startsWith(`${name} `)), `dependency ${name}`).toBe(true);
    for (const name of Object.keys(pkg.devDependencies))
        expect([...codeCredits, ...toolchainCredits].some(c => c.title.startsWith(`${name} `)), `devDependency ${name}`).toBe(true);
    for (const title of ['WebGPU', 'WebGL 2', 'Web Audio API', 'three.js WebGPURenderer', 'Rapier', 'Blender', 'FFmpeg', 'Basis Universal', 'meshoptimizer', 'Cloudflare Pages', 'Hetzner Cloud', 'GitHub', 'Mesh2Motion'])
        expect(shown.some(c => c.title.includes(title)), title).toBe(true);
    // Every source the audio ledger ships (music streams, cue recordings, fanfare layers) is credited by author, page and license.
    const sources = imports.sources as Record<string, { title: string; author: string; url: string; license: string }>;
    const shipped = new Set([...Object.values(imports.streams).map(s => s.source), ...Object.values(imports.cues).map(c => c.source), ...Object.values(imports.fanfare as Record<string, { source: string }[]>).flatMap(l => l.map(x => x.source))]);
    for (const id of shipped) {
        const s = sources[id];
        expect(audioCredits.some(c => c.url === s.url && c.author === s.author && c.license === s.license), `audio source ${id} (${s.title})`).toBe(true);
    }
    // The weapon pass sources, by name.
    for (const name of ['The Free Firearm Sound Library', 'gun reload sounds', 'Residue SFX'])
        expect(audioCredits.some(c => c.title.includes(name) && c.url.startsWith('https://') && c.license === 'CC0'), name).toBe(true);
    for (const c of shown) { expect(c.title.length, c.title).toBeGreaterThan(0); expect(c.licenseUrl, c.title).toMatch(/^https:\/\//); expect(c.license.length, c.title).toBeGreaterThan(0); }
});

test('credits open with the makers: Fabian Wesner (LinkedIn), every AI model, harness and tool', () => {
    expect(madeBy.author).toMatchObject({ name: 'Fabian Wesner', url: 'https://www.linkedin.com/in/fabian-wesner/' });
    const names = madeBy.groups.flatMap(g => g.names).join(' | ');
    for (const name of ['Claude Opus 5.5', 'Claude Sonnet 5.5', 'Claude Haiku 5.5', 'Claude Fable 5.1', 'GPT-6.1 Sol', 'GPT-6 Luna', 'GPT-6 Astra', 'Claude Code', 'Codex CLI', 'codex-scheduler', 'Blender'])
        expect(names, name).toContain(name);
    const ui = readFileSync('src/ui/GameUI.ts', 'utf8');
    for (const heading of ['Runtime libraries and references', 'Build, test and asset tools', 'Technologies and platforms', 'Music, sound and voices'])
        expect(ui, heading).toContain(heading);
    expect(ui).toContain('All LLMs and harnesses, all libraries and all technologies');
    // Both credit screens render the makers before the generated licence list.
    for (const [file, then] of [['src/ui/GameUI.ts', "section('code'"], ['src/ui/CampaignUI.ts', 'Bruno Simon']] as const) {
        const source = readFileSync(file, 'utf8'), first = source.indexOf('madeBy.headline');
        expect(first, file).toBeGreaterThan(0);
        expect(first, file).toBeLessThan(source.indexOf(then));
    }
});
