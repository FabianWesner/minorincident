import { test, expect } from '../e2e/fixtures';
import { measureL10Entry } from '../../tools/perf/l10Entry';

test.use({ channel: 'chrome', headless: true, trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });

for (const backend of ['webgl2', 'webgpu'] as const) for (const entry of ['debug', 'continue'] as const) {
  test(`PO #100 @E32 @perf ${backend} ${entry}: no frame over 200 ms after the loading card`, async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const result = await measureL10Entry(page, baseURL!, entry, backend, 'test-results/fixes-13h-l10/entry-guard');
    expect(result.backend).toBe(backend === 'webgl2' ? 'webgl' : 'webgpu');
    expect(result.cardClosed).toBeGreaterThan(0);
    expect(result.frames.filter(f => f.scenario === 'L10' && f.at < result.cardClosed! && f.dt > 200).every(f => f.cardVisible), 'long loading intervals must actually be covered by the card').toBe(true);
    expect(result.playableFrames).toBeGreaterThan(100);
    // The recording crosses both reported cold-graph boundaries (755/14 and 790/25),
    // rather than stopping just before the first promotion as the old API walk did.
    expect(result.state!.transform.x).toBeGreaterThan(800);
    expect(result.frames.at(-1)!.tick).toBeGreaterThanOrEqual(5131);
    const play = result.frames.filter(f => f.scenario === 'L10' && f.at >= result.cardClosed!);
    expect(play.every(f => f.sun !== f.spot), 'only the selected prewarmed source participates in a draw').toBe(true);
    expect(new Set(play.map(f => f.sun)).size, 'the replay must draw both cached light variants').toBe(2);
    expect(new Set(play.map(f => f.heroLight)).size, 'the replay must exercise lamp promotion').toBeGreaterThan(1);
    expect(result.max, JSON.stringify(result.hitches)).toBeLessThanOrEqual(200);
  });
}
