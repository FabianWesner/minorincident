import { expect, test, vi } from 'vitest';
import { PNG } from 'pngjs';
import { measureCourierShare } from '../../../tools/scenelab/run';
import type { SceneSession } from '../../../tools/scenelab/session';

test('Mega/Alpha visibility excludes health-bar movement when the reference model changes', async () => {
  const pixels = (bar: number[], body: boolean, courier: boolean) => {
    const png = new PNG({ width: 10, height: 10 });
    for (let i = 0; i < 100; i++) png.data[i * 4 + 3] = 255;
    for (const i of [...bar, ...(body ? [20, 21, 22, 23] : []), ...(courier ? [70, 71, 72] : [])]) png.data.fill(255, i * 4, i * 4 + 4);
    return PNG.sync.write(png);
  };
  // Same four body pixels, but the animated head places the health bar elsewhere.
  // Comparing Alpha to Mega's background would incorrectly count eight pixels.
  // Shots in order: all, courier hidden, crowd hidden, environment + crowd hidden, everything hidden, Alpha, Alpha with crowd hidden.
  const frames = [pixels([0, 1], true, true), pixels([0, 1], true, false), pixels([0, 1], false, true), pixels([0, 1], false, true), pixels([0, 1], false, false), pixels([5, 6], true, true), pixels([5, 6], false, true)];
  const session = { ready: async () => {}, page: { evaluate: vi.fn(async () => 2), screenshot: vi.fn(async () => frames.shift()!) } } as unknown as SceneSession;
  const result = await measureCourierShare(session, true);
  expect(result.megaPixels).toBe(4);
  expect(result.alphaPixels).toBe(4);
  expect(result.megaAlphaRatio).toBe(1);
});
