import { expect, test, vi } from 'vitest';
import { PNG } from 'pngjs';
import { measureCourierShare, measureCut } from '../../../tools/scenelab/run';
import type { SceneSession } from '../../../tools/scenelab/session';

const pixels = (count: number) => {
  const png = new PNG({ width: 20, height: 20 });
  for (let i = 0; i < 400; i++) { png.data[i * 4] = i < count ? 255 : 0; png.data[i * 4 + 3] = 255; }
  return PNG.sync.write(png);
};

test('visibility probe measures static occlusion with an independent reference, even below 150 pixels', async () => {
  let courier = false, environment = false;
  const session = {
    ready: vi.fn(),
    page: {
      evaluate: vi.fn((_callback, flags?: boolean[]) => {
        [courier, , environment] = flags ?? [false, false, false]; return Infinity;
      }),
      screenshot: vi.fn(() => pixels(courier ? 0 : environment ? 100 : 40)),
    },
  } as unknown as SceneSession;
  const result = await measureCourierShare(session);
  expect(result.visible).toBe(40); expect(result.reference).toBe(100); expect(result.share).toBe(.4);
  expect(courier).toBe(false); expect(environment).toBe(false);
  session.page.screenshot = vi.fn(async () => pixels(0));
  expect((await measureCourierShare(session)).share).toBe(0);
});

test('cut probe compares the same simulation frame and never exempts screen-wide cover pixels', async () => {
  let off = false;
  const session = {
    ready: vi.fn(), step: vi.fn(),
    page: {
      evaluate: vi.fn(() => { off = !off; return { center: [.5, .5], solidRadius: .2, strength: 1, cover: 1, occluder: '' }; }),
      screenshot: vi.fn(() => {
        const png = PNG.sync.read(pixels(0));
        if (!off) { png.data[(10 * 20 + 10) * 4] = 255; png.data[0] = 255; }
        return PNG.sync.write(png);
      }),
    },
  } as unknown as SceneSession;
  const result = await measureCut(session);
  expect(session.step).not.toHaveBeenCalled(); expect(result.inside).toBe(1); expect(result.outside).toBe(1);
});
