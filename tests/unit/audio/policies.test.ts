import { expect, test } from 'vitest';
import { VoiceLimiter } from '../../../src/audio/VoiceLimiter';
import { HordeClusters } from '../../../src/audio/HordeClusters';
import { MusicDirector } from '../../../src/audio/MusicDirector';
import { AmbienceSchedule } from '../../../src/audio/AmbienceSchedule';
import { ambienceTiers } from '../../../src/data/audioCues';
test('T-E16-04 @E16 @E16-AC04 storm culls lowest priorities first and never exceeds either cap', () => {
    for (const tier of ['high', 'low'] as const) {
        const limiter = new VoiceLimiter(tier), culled: number[] = [];
        for (let id = 0; id < 200; id++)
            limiter.add({ id, priority: id, stop: () => { culled.push(id); } });
        expect(limiter.voices.size).toBe(tier === 'high' ? 32 : 16);
        expect([...limiter.voices.values()].map(v => v.priority).sort((a, b) => a - b)).toEqual(Array.from({ length: limiter.limit }, (_, i) => 200 - limiter.limit + i));
        expect(culled).toEqual(Array.from({ length: 200 - limiter.limit }, (_, i) => i));
        const reject = limiter.add({ id: 201, priority: 1, stop: () => { culled.push(201); } });
        expect(reject).toBe(false);
        limiter.setTier('low');
        expect(limiter.voices.size).toBeLessThanOrEqual(16);
        limiter.clear();
        expect(limiter.voices.size).toBe(0);
    }
});
test('T-E16-05 @E16 @E16-AC05 150 infected yield 3–6 true centroids, four close vocals, monotone gain', () => {
    const horde = new HordeClusters(), positions = Array.from({ length: 150 }, (_, id) => ({ id, x: (id % 5) * 8 - 16 + (id % 3) * 0.1, z: Math.floor(id / 5) % 5 * 8 - 16 }));
    horde.update(positions, { x: 0, z: 0 });
    expect(horde.clusters.length).toBeGreaterThanOrEqual(3);
    expect(horde.clusters.length).toBeLessThanOrEqual(6);
    expect(horde.nearby.length).toBeLessThanOrEqual(4);
    for (const p of horde.nearby)
        expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(6);
    for (const cluster of horde.clusters) {
        const members = positions.filter(p => horde.assignment(p) === cluster.id);
        expect(Math.hypot(cluster.x - members.reduce((n, p) => n + p.x, 0) / members.length, cluster.z - members.reduce((n, p) => n + p.z, 0) / members.length)).toBeLessThan(0.01);
    }
    let before = 0;
    for (let count = 1; count <= 150; count++) {
        const gain = horde.gain(count);
        expect(gain).toBeGreaterThanOrEqual(before);
        before = gain;
    }
    horde.update(positions, { x: 100, z: 100 });
    expect(horde.clusters).toHaveLength(0);
});
test('T-E16-10 @E16 @E16-AC10 music goes base-only after 10 quiet seconds and drive by the next bar', () => {
    const music = new MusicDirector('L1');
    music.update(0, { alerted: 10 });
    expect(music.transitions[0].time).toBe(0);
    expect(music.layers).toContain('drive');
    music.update(0.13, { alerted: 0 });
    music.update(10.13, { alerted: 0 });
    expect(music.layers).toContain('drive');
    music.update(12, { alerted: 0 });
    expect(music.layers).toEqual(['base']);
    music.update(12.31, { alerted: 10 });
    expect(music.pending!.time).toBe(14);
    music.update(14, { alerted: 10 });
    expect(music.layers).toContain('drive');
    for (const transition of music.transitions)
        expect(Math.abs(transition.time / music.bar - Math.round(transition.time / music.bar))).toBeLessThan(0.01);
    music.update(14.1, { alerted: 0, damage: 80, phase: 'boss', vehicleSpeed: 15 });
    expect(music.score).toBeGreaterThanOrEqual(0.75);
});
test('T-E16-13 @E16 @E16-AC13 all tiers have beds, with repeatable seeded one-shot timing', () => {
    for (let tier = 0; tier <= 5; tier++) {
        expect(ambienceTiers[tier].beds.length).toBeGreaterThanOrEqual(2);
        const run = (seed: number) => { const a = new AmbienceSchedule(tier, seed); const log = []; for (let t = 0; t < 60; t += 0.1) {
            const e = a.update(t);
            if (e)
                log.push(e);
        } return log; };
        const a = run(42);
        expect(a.length).toBeGreaterThan(5);
        expect(a).toEqual(run(42));
        expect(a).not.toEqual(run(43));
    }
});
