import { expect, test } from 'vitest';
import { storyMusic, musicBeats } from '../../../src/data/musicBeats';
import type { MissionState } from '../../../src/sim/missions/types';

test('@E16 L1 outbreak and L2 ambush/escape keep story intensity until safety, including restored saves', () => {
    for (const level of ['L1', 'L2']) for (const [beat, minimum] of Object.entries(musicBeats[level])) {
        const state = { id: level, phase: 'playing', steps: {}, [level === 'L1' ? 'l1' : 'l2']: { phase: beat } } as unknown as MissionState;
        expect(storyMusic(level, state).minimum).toBe(minimum);
        expect(storyMusic(level, structuredClone(state))).toEqual(storyMusic(level, state));
        expect(storyMusic(level, { ...state, phase: 'briefing' }).minimum).toBe(0);
        expect(storyMusic(level, { ...state, phase: 'result' }).minimum).toBe(0);
    }
    expect(storyMusic('L2', { id: 'L2', phase: 'playing', l2: { phase: 'escape' }, steps: {} } as unknown as MissionState).minimum).toBe(0.5);
});
test('@E16 L3 active objective floors take the highest parallel escalation', () => {
    const state = { id: 'L3', phase: 'playing', steps: { 'market-route': { status: 'active' }, 'market-cover': { status: 'active' }, gates: { status: 'pending' } } } as unknown as MissionState;
    expect(storyMusic('L3', state)).toEqual({ beat: 'market-cover', minimum: 0.5 });
    state.steps['market-cover'].status = 'completed';
    expect(storyMusic('L3', state).minimum).toBe(0.25);
    expect(storyMusic('L3', { ...state, phase: 'result' }).minimum).toBe(0);
});
