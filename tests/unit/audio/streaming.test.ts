import { afterEach, expect, test, vi } from 'vitest';
import { StreamedMusic } from '../../../src/audio/StreamedMusic';

afterEach(() => vi.unstubAllGlobals());
function fixture(firstPlay?: () => Promise<void>) {
    const media: FakeAudio[] = [], gains: ReturnType<typeof gain>[] = [];
    class FakeAudio {
        preload = ''; loop = false; src = ''; paused = true; currentTime = 0;
        play = vi.fn(async () => { this.paused = false; });
        pause() { this.paused = true; }
        canPlayType() { return 'probably'; }
        removeAttribute() {} load() {}
        constructor() { if (!media.length && firstPlay) this.play.mockImplementationOnce(firstPlay); media.push(this); }
    }
    function gain() { return { gain: { value: 0, cancelAndHoldAtTime: vi.fn(), cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }; }
    vi.stubGlobal('Audio', FakeAudio);
    const context = { currentTime: 1, createMediaElementSource: () => ({ connect: (g: unknown) => g, disconnect: vi.fn() }), createGain: () => { const g = gain(); gains.push(g); return g; } };
    const score = new StreamedMusic(context as unknown as AudioContext, {} as AudioNode);
    return { score, media, gains, context };
}
test('@E16 streamed score retries a deck interrupted before its first play resolves', async () => {
    let resolve!: () => void;
    const { score } = fixture(() => new Promise<void>(r => { resolve = r; }));
    const interrupted = score.transition('calm', 1, 1, 2);
    expect(score.state).toBeNull();
    score.pause();
    await score.resume();
    resolve(); await interrupted;
    expect(score.state).toBe('calm');
    expect(score.snapshot().decks.find(d => d.state === 'calm')!.paused).toBe(false);
    expect(score.errors).toEqual([]);
});
test('@E16 failed incoming music leaves the outgoing deck and its fade untouched', async () => {
    const { score, media, gains } = fixture();
    await score.transition('calm', 1, 1, 2);
    const fades = gains[0].gain.linearRampToValueAtTime.mock.calls.length;
    score.pause();
    await score.transition('combat', 1, 1, 2);
    // Resume first restores the old deck, then attempts the desired replacement.
    const play = vi.spyOn(media[0], 'play');
    const original = globalThis.Audio;
    vi.stubGlobal('Audio', class extends original { constructor() { super(); (this.play as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline')); } });
    await score.resume();
    expect(play).toHaveBeenCalled();
    expect(score.state).toBe('calm');
    expect(gains[0].gain.linearRampToValueAtTime.mock.calls).toHaveLength(fades);
    expect(media[0].paused).toBe(false);
    expect(score.errors).toEqual(['Music playback failed: combat']);
});
test('@E16 L1 streams its own calm recording; other levels and states keep the shared score', async () => {
    const { score, media } = fixture();
    score.level = 'L1';
    await score.transition('calm', 1, 1, 2);
    await score.transition('tension', 1, 1, 2);
    expect(media.map(m => m.src)).toEqual([expect.stringContaining('/assets/audio/score-calm-L1.webm'), expect.stringContaining('/assets/audio/score-tension.webm')]);
    score.reset();
    score.level = 'L2';
    await score.transition('calm', 1, 1, 2);
    // The cached calm deck is repointed, never duplicated: at most one deck per state.
    expect(media).toHaveLength(2);
    expect(media[0].src).toContain('/assets/audio/score-calm.webm');
    expect(score.snapshot().decks.find(d => d.state === 'calm')!.file).toBe('calm');
});
test('@E16 danger preloads silently and crossfades immediately in 0.8 s without a second full bed', async () => {
    const { score, media, gains, context } = fixture();
    score.prepareDanger();
    expect(media[0].paused).toBe(true);
    expect(media[0].play).not.toHaveBeenCalled();
    await score.transition('calm', 1, 1, 2);
    context.currentTime = 1.3;
    await score.transition('combat', 1.3, 1, 2, true);
    expect(score.transitions.at(-1)?.time).toBe(1.3);
    expect(gains[0].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.6, 2.1);
    expect(gains[1].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 2.1);
    context.currentTime = 2.11; score.update();
    expect(media[1].paused).toBe(true);
    expect(media[0].paused).toBe(false);
    await score.transition('calm', 2.11, 1, 2, true);
    expect(gains[0].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 2.91);
    expect(gains[1].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.5, 2.91);
});
