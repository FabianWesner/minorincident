import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { scoreFile } from '../../../src/audio/StreamedMusic';
import imports from '../../../assets/audio/imports.json';

const levels = Array.from({ length: 9 }, (_, i) => `L${i + 1}`);
const licenses = readFileSync('public/assets/audio/LICENSES.md', 'utf8');
const streams = imports.streams as Record<string, { source: string }>;
const sources = imports.sources as Record<string, { license: string; author: string; url: string; title: string }>;

test('every level L1-L9 resolves its own calm and tension recording with a file and a LICENSES.md entry', () => {
    const seen = new Set<string>();
    for (const level of levels)
        for (const state of ['calm', 'tension'] as const) {
            const stem = scoreFile(level, state);
            expect(stem, `${level} ${state}`).toBe(`${state}-${level}`);
            expect(seen.has(stem), `${stem} is unique`).toBe(false);
            seen.add(stem);
            const recipe = streams[stem];
            expect(recipe, `${stem} has a stream recipe`).toBeDefined();
            const source = sources[recipe.source];
            // Only permissive licences with attribution on record.
            expect(source.license).toMatch(/^(CC0|CC-BY [34]\.0)$/);
            expect(source.url).toMatch(/^https:\/\//);
            for (const ext of ['webm', 'm4a']) {
                expect(existsSync(`public/assets/audio/score-${stem}.${ext}`), `${stem}.${ext} exists`).toBe(true);
                expect(licenses, `${stem}.${ext} in LICENSES.md`).toContain(`| score-${stem}.${ext} | ${source.license} |`);
            }
        }
});

test('PO 10-12: combat is the shared rock score in every level; unmapped levels keep every shared score', () => {
    expect(scoreFile('', 'calm')).toBe('calm');
    expect(scoreFile('L99', 'tension')).toBe('tension');
    for (const level of levels) { expect(scoreFile(level, 'combat')).toBe('combat'); expect(scoreFile(level, 'aftermath')).toBe('aftermath'); }
    expect(existsSync('public/assets/audio/score-combat.webm') && existsSync('public/assets/audio/score-combat.m4a')).toBe(true);
});
