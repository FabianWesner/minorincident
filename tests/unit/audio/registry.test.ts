import { test, expect, vi } from 'vitest';
import { AudioRegistry } from '../../../src/audio/AudioRegistry';
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
