import { test, expect, vi } from 'vitest';
import { AudioRegistry } from '../../../src/audio/AudioRegistry';
import { audioVariationPools } from '../../../src/data/audioCues';
test('@load initial audio retains gameplay cues and defers ambient beds and music', async () => {
    const registry = new AudioRegistry({ decodeAudioData: async () => ({} as AudioBuffer) } as unknown as BaseAudioContext, async () => new ArrayBuffer(0));
    await registry.prepare('L1', false);
    expect(registry.buffers.has('ui')).toBe(true);
    expect(registry.buffers.has('impacts')).toBe(true);
    expect(registry.buffers.has('barks')).toBe(true);
    expect(registry.buffers.has('l1arc')).toBe(true);
    expect(registry.buffers.has('ambience')).toBe(false);
    expect(registry.buffers.has('music-L1')).toBe(false);
    await registry.prepare('L1');
    expect(registry.buffers.has('ambience')).toBe(true);
    expect(registry.buffers.has('music-L1')).toBe(true);
});
test('T-E16-19b @E16 @E16-AC19 failed Opus decode falls back to AAC and caches the decoded sprite', async () => {
    const buffer = { length: 48000, duration: 1 } as AudioBuffer;
    const decode = vi.fn().mockRejectedValueOnce(new Error('Codec unsupported')).mockResolvedValue(buffer), read = vi.fn(async () => new ArrayBuffer(12));
    const registry = new AudioRegistry({ decodeAudioData: decode } as unknown as BaseAudioContext, read);
    await Promise.all([registry.load('ui'), registry.load('ui')]);
    expect(read.mock.calls).toHaveLength(2);
    expect(read).toHaveBeenNthCalledWith(1, '/assets/audio/ui.webm');
    expect(read).toHaveBeenNthCalledWith(2, '/assets/audio/ui.m4a');
    expect(registry.get('ui.click', 1)).not.toBeNull();
    expect(registry.get('ui.click', 1.01)).toBeNull();
    expect(registry.get('ui.click', 1.1)).not.toBeNull();
    registry.get('unknown.cue', 1);
    expect(registry.errors).toEqual(['Missing cue: unknown.cue']);
    registry.reset(2);
    expect(registry.errors).toEqual([]);
});
test('@E16 recorded pools do not repeat, keep spam policy, and replay deterministically after reset', async () => {
    const buffer = {} as AudioBuffer;
    const registry = new AudioRegistry({ decodeAudioData: async () => buffer } as unknown as BaseAudioContext, async () => new ArrayBuffer(0));
    await registry.load('impacts');
    const run = () => Array.from({ length: 30 }, (_, i) => registry.get('flesh.bat', i)!).map(r => ({ variant: r.variant, rate: r.rate, gain: r.gain }));
    registry.reset(42);
    const first = run();
    expect(new Set(first.map(r => r.variant)).size).toBe(4);
    for (let i = 0; i < first.length; i++) {
        expect(audioVariationPools['flesh.bat']).toContain(first[i].variant);
        if (i) expect(first[i].variant).not.toBe(first[i - 1].variant);
        expect(first[i].rate).toBeGreaterThanOrEqual(0.97);
        expect(first[i].rate).toBeLessThanOrEqual(1.03);
        expect(20 * Math.log10(first[i].gain)).toBeGreaterThanOrEqual(-1);
        expect(20 * Math.log10(first[i].gain)).toBeLessThanOrEqual(1);
    }
    expect(registry.get('flesh.bat', 29.01)).toBeNull();
    registry.reset(42);
    expect(run()).toEqual(first);
});
