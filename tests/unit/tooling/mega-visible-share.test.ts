import { afterEach, expect, test, vi } from 'vitest';
import { PNG } from 'pngjs';
import { measureCourierShare } from '../../../tools/scenelab/run';
import type { SceneSession } from '../../../tools/scenelab/session';
afterEach(() => vi.unstubAllGlobals());

test('Mega/Alpha visibility excludes health-bar movement when the reference model changes', async () => {
  const pixels = (bar: number[], body: boolean, courier: boolean) => {
    const png = new PNG({ width: 10, height: 10 });
    for (let i = 0; i < 100; i++) png.data[i * 4 + 3] = 255;
    for (const i of [...bar, ...(body ? [20, 21, 22, 23] : []), ...(courier ? [70, 71, 72] : [])]) png.data.fill(255, i * 4, i * 4 + 4);
    return PNG.sync.write(png);
  };
  // Same four body pixels, but the reference head moves the bar. Exercise the real page callbacks against a canvas;
  // page screenshots represent the independently changing DOM HUD and must never be sampled.
  let alpha = false, courier = false, crowd = false, bars = false;
  vi.stubGlobal('window', { __SCENE__: {
    ready: async () => {}, bossRevealProbe: () => ({ center: [.5, .5], radius: .1, strength: 0 }),
    hideProbe: (c: boolean, w: boolean, _environment: boolean, b = false) => { courier = c; crowd = w; bars = b; return 2; },
    alphaReferenceProbe: (enabled: boolean) => { alpha = enabled; },
  } });
  vi.stubGlobal('document', { querySelector: () => ({ toDataURL: () => `data:image/png;base64,${pixels(bars ? [] : alpha ? [5, 6] : [0, 1], !crowd, !courier).toString('base64')}` }) });
  const session = { ready: async () => {}, page: { evaluate: vi.fn((callback: (arg?: unknown) => unknown, flags?: unknown) => callback(flags)), screenshot: vi.fn() } } as unknown as SceneSession;
  const result = await measureCourierShare(session, true);
  expect(result.megaPixels).toBe(4);
  expect(result.alphaPixels).toBe(4);
  expect(result.megaAlphaRatio).toBe(1);
  expect(session.page.screenshot).not.toHaveBeenCalled();
});
