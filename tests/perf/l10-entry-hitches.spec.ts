import { test, expect } from '../e2e/fixtures';
import { measureL10Entry } from '../../tools/perf/l10Entry';

test.use({ channel: 'chrome', headless: true, trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });

for (const backend of ['webgl2', 'webgpu'] as const) for (const entry of ['debug', 'continue'] as const) {
  test(`PO #100 @E32 @perf ${backend} ${entry}: no frame over 200 ms after the loading card`, async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const result = await measureL10Entry(page, baseURL!, entry, backend, 'test-results/fixes-13h-l10/entry-guard');
    expect(result.backend).toBe(backend === 'webgl2' ? 'webgl' : 'webgpu');
    expect(result.cardClosed).toBeGreaterThan(0);
    expect(result.playableFrames).toBeGreaterThan(100);
    expect(result.state!.transform.x).toBeGreaterThan(750);
    expect(result.frames.at(-1)!.tick).toBeGreaterThanOrEqual(2965);
    expect(result.max, JSON.stringify(result.hitches)).toBeLessThanOrEqual(200);
  });
}
