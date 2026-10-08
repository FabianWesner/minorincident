import { expect, test } from 'vitest';
import { MusicDirector } from '../../../src/audio/MusicDirector';
import { isMusicThreat } from '../../../src/audio/MusicThreat';
import type { EntitySnapshot } from '../../../src/sim/world/types';

test('@E16 danger responds immediately in every level, holds seven seconds and restores calm', () => {
    for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']) {
        const music = new MusicDirector(level);
        music.update(0, { alerted: 0, danger: false });
        expect(music.state).toBe('calm');
        music.update(0.3, { alerted: 1, danger: true });
        expect(music.state).toBe('combat');
        expect(music.layers).toContain('drive');
        expect(music.transitions.at(-1)).toMatchObject({ time: 0.3, immediate: true });
        music.update(20, { alerted: 1, danger: true });
        music.update(26.9, { alerted: 0, danger: false });
        expect(music.state).toBe('combat');
        // A boundary recrossing extends the hold without scheduling another fade.
        music.update(26.95, { alerted: 1, danger: true });
        expect(music.transitions).toHaveLength(1);
        music.update(33.9, { alerted: 0, danger: false });
        expect(music.state).toBe('combat');
        music.update(33.96, { alerted: 0, danger: false, incident: true });
        expect(music.state).toBe('calm');
        expect(music.layers).toEqual(['base']);
    }
});
test('@E16 dead/downed, offscreen and wall-obscured infected never count as music threats', () => {
    const entity = { transform: { x: 12, z: 0 }, health: { current: 100 }, infected: { state: 'wander' } } as EntitySnapshot;
    const listener = { x: 0, z: 0 }, clear = () => true;
    expect(isMusicThreat(entity, listener, clear, clear)).toBe(true);
    expect(isMusicThreat(entity, listener, () => false, clear)).toBe(false);
    expect(isMusicThreat(entity, listener, clear, () => false)).toBe(false);
    entity.hidden = true;
    expect(isMusicThreat(entity, listener, clear, clear)).toBe(false);
    entity.hidden = false;
    entity.transform.x = 12.01;
    expect(isMusicThreat(entity, listener, clear, clear)).toBe(false);
    entity.transform.x = 2; entity.health.current = 0;
    expect(isMusicThreat(entity, listener, clear, clear)).toBe(false);
    entity.health.current = 100; entity.infected!.state = 'dead';
    expect(isMusicThreat(entity, listener, clear, clear)).toBe(false);
});

test('@E16 story escalation sustains dramatic music without infected and only a calm beat releases it', () => {
    const music = new MusicDirector('L2');
    music.update(0, { alerted: 0, danger: false, minimum: 0 });
    music.update(1, { alerted: 0, minimum: 0.5 });
    for (const t of [8, 30, 90]) {
        music.update(t, { alerted: 0, danger: false, minimum: 0.5 });
        expect(music.state).toBe('combat');
        expect(music.layers).toContain('drive');
    }
    music.update(91, { alerted: 0, danger: false, minimum: 0 });
    expect(music.state).toBe('calm');
    const l1 = new MusicDirector('L1');
    l1.update(0, { alerted: 0, danger: false, minimum: 0.25 });
    l1.update(90, { alerted: 0, danger: false, minimum: 0.25 });
    expect(l1.state).toBe('tension');
    l1.update(91, { alerted: 1, danger: true, minimum: 0.25 });
    expect(l1.state).toBe('combat');
    l1.update(99, { alerted: 0, danger: false, minimum: 0.25 });
    expect(l1.state).toBe('tension');
});
