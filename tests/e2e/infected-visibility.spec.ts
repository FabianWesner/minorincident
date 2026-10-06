import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { boot, expect, test } from './fixtures';

test('T-E07-WebGL-visible @E07 infected runner body renders pixels on WebGL2', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    const api = window.__SS__!;
    await api.loadScenario('horde-arena'); api.pause();
    api.camera.cinematic({ position: [8, 6, 10], target: [3, .7, 0] });
    await api.screenshotReady();
  });
  const before = PNG.sync.read(await page.locator('canvas').screenshot());
  const proof = await page.evaluate(async () => {
    const api = window.__SS__!;
    const id = api.spawn('infected.runner', { x: 3, z: 0 });
    await api.screenshotReady();
    return { id, backend: api.perf().backend, waist: api.camera.project(3, .5, 0), head: api.camera.project(3, 1.6, 0) };
  });
  mkdirSync('test-results/epics/E07', { recursive: true });
  const after = PNG.sync.read(await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/webgl-infected-visible.png' }));
  // Only the body above the waist is compared: a ground shadow cannot satisfy this check.
  const cx = Math.round((proof.head[0] + 1) / 2 * after.width);
  const top = Math.floor((1 - proof.head[1]) / 2 * after.height) - 12;
  const bottom = Math.floor((1 - proof.waist[1]) / 2 * after.height);
  const width = 100, height = bottom - top;
  const crop = (image: PNG) => {
    const data = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) image.data.copy(data, y * width * 4, ((top + y) * image.width + cx - width / 2) * 4, ((top + y) * image.width + cx + width / 2) * 4);
    return data;
  };
  const bodyPixels = pixelmatch(crop(before), crop(after), undefined, width, height, { threshold: .1 });
  writeFileSync('test-results/epics/E07/webgl-infected-visible.json', JSON.stringify({ ...proof, bodyPixels, crop: { cx, top, bottom, width } }, null, 2) + '\n');
  expect(proof.backend).toBe('webgl');
  expect(bodyPixels, 'visible runner body, excluding ground shadow').toBeGreaterThan(200);
});
