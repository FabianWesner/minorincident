import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import { scoredLevels, scoreFile } from '../../../src/audio/StreamedMusic';
import { audioCues, stemBank } from '../../../src/data/audioCues';

const exists = (stem: string) => ['webm', 'm4a'].every(ext => existsSync(`public/assets/audio/${stem}.${ext}`));

test('@E16 L7, L8 and L9 are scored levels with their own score IDs, not L1 identity', () => {
    for (const level of ['L7', 'L8', 'L9', 'L10']) expect(scoredLevels.has(level), level).toBe(true);
    expect(scoredLevels.has('L11')).toBe(false);
    expect(scoreFile('L7', 'calm')).toBe('calm-L7');
    expect(scoreFile('L8', 'tension')).toBe('tension-L8');
    expect(scoreFile('L9', 'calm')).toBe('calm-L9');
});

test('every scored level score ID resolves to a real streamed asset (webm + m4a)', () => {
    for (const level of scoredLevels)
        for (const state of ['calm', 'tension'] as const)
            expect(exists(`score-${scoreFile(level, state)}`), `${level} ${state} -> score-${scoreFile(level, state)}`).toBe(true);
});

test('music stem banks: L1-L6 and the L10 finale (reusing L6) have a sprite; L7-L9 have none and never request one', () => {
    for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']) {
        expect(stemBank(level)).toBe(`music-${level}`);
        expect(exists(`music-${level}`), `music-${level} sprite`).toBe(true);
    }
    expect(stemBank('L10')).toBe('music-L6');
    for (const level of ['L7', 'L8', 'L9']) expect(stemBank(level), level).toBeNull();
});

test('every music-L* cue category in audioCues points at an existing sprite', () => {
    const categories = new Set(Object.values(audioCues).map(cue => cue.category).filter(category => category.startsWith('music-L')));
    expect(categories.size).toBeGreaterThan(0);
    for (const category of categories) expect(exists(category), `${category} sprite`).toBe(true);
});
