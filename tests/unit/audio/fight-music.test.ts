import { expect, test } from 'vitest';
import { MusicDirector } from '../../../src/audio/MusicDirector';

const levels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];

test('@E16 every level goes calm, combat, peak in a dense fight and relaxes with hysteresis', () => {
    for (const level of levels) {
        const music = new MusicDirector(level);
        music.update(0, { alerted: 0, danger: false, minimum: 0 });
        expect(music.state, level).toBe('calm');
        music.update(1, { alerted: 2, danger: true, minimum: 0 });
        expect(music.state, level).toBe('combat');
        expect(music.peak, level).toBe(false);
        expect(music.layers, level).not.toContain('peak');
        // Ten engaged infected: peak layers, same combat state.
        music.update(2, { alerted: 10, danger: true, minimum: 0 });
        expect(music.state, level).toBe('combat');
        expect(music.peak, level).toBe(true);
        expect(music.layers, level).toContain('peak');
        // Crowd thinned to one: the peak holds 5 s after the last dense sample, combat holds 7 s after the last threat.
        music.update(3, { alerted: 1, danger: true, minimum: 0 });
        expect(music.peak, level).toBe(true);
        music.update(7.5, { alerted: 1, danger: true, minimum: 0 });
        expect(music.peak, level).toBe(false);
        expect(music.state, level).toBe('combat');
        music.update(10.5, { alerted: 0, danger: false, minimum: 0 });
        expect(music.state, level).toBe('combat');
        music.update(14.5, { alerted: 0, danger: false, minimum: 0 });
        expect(music.state, level).toBe('calm');
        expect(music.layers, level).toEqual(['base']);
    }
});

test('@E16 a dense fight escalates even where the story floor already holds combat (L2 collapse)', () => {
    const music = new MusicDirector('L2');
    music.update(0, { alerted: 0, danger: false, minimum: 0.5 });
    expect(music.state).toBe('combat');
    expect(music.peak).toBe(false);
    music.update(5, { alerted: 12, danger: true, minimum: 0.5 });
    expect(music.peak).toBe(true);
    expect(music.layers).toContain('peak');
    // After the fight the floor keeps combat; the peak releases.
    music.update(20, { alerted: 0, danger: false, minimum: 0.5 });
    expect(music.peak).toBe(false);
    expect(music.state).toBe('combat');
    expect(music.layers).not.toContain('peak');
});

test('@E16 level completion clears the peak', () => {
    const music = new MusicDirector('L3');
    music.update(0, { alerted: 12, danger: true, minimum: 0 });
    expect(music.peak).toBe(true);
    music.update(1, { alerted: 12, danger: true, minimum: 0, complete: true });
    expect(music.peak).toBe(false);
    expect(music.state).toBe('aftermath');
});
