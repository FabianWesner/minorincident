import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { test, expect, boot } from '../e2e/fixtures';

/** Capture the actual Fairhaven twins with identical cameras. Pixel evidence
 * complements the landmark/decay unit contracts and the recorded vision review. */
for (const quality of ['high', 'low'] as const) test(`T-E29-18 @E29-AC18 W5/W6 Fairhaven pairs retain landmarks and show additional destruction ${quality}`, async ({ page }) => {
  test.setTimeout(600_000);
  await boot(page, `/?test=1&renderer=webgl&quality=${quality}&dpr=1&audio=muted`);
  const out = `test-results/epics/E29/pairs-${quality}`; mkdirSync(out, { recursive: true });
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8'));
  const points = ['plaza', 'harbor-street', 'metro-entrance', 'kessler-lane'].map(name => {
    const [x, , z] = layout.anchors[`pair-${name}`].position as number[];
    return { name, x, z };
  });
  const images = new Map<string, PNG>(), poses = new Map<string, unknown>(), proof: unknown[] = [];
  for (const level of ['L5', 'L7'] as const) {
    await page.evaluate(async ({ level, quality }) => { const a = window.__SS__!; await a.loadLevel(level, { seed: 29, progression: `${level}-default` }); a.pause(); a.settings.set({ quality }); }, { level, quality });
    for (const point of points) {
      const camera = await page.evaluate(async p => {
        const a = window.__SS__!; a.teleport('player', p); a.camera.cinematic({ position: [p.x + 30, 38, p.z + 30], target: [p.x, .6, p.z] }, true); await a.screenshotReady();
        const camera = a.getState().render.camera; return { position: camera.position, target: camera.target };
      }, point);
      const image = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/${point.name}-${level}.png` }));
      if (level === 'L5') { images.set(point.name, image); poses.set(point.name, camera); continue; }
      expect(camera).toEqual(poses.get(point.name));
      const before = images.get(point.name)!; let changed = 0, visible = 0, count = 0;
      for (let i = 0; i < image.data.length; i += 16) {
        count++;
        if (Math.max(image.data[i], image.data[i + 1], image.data[i + 2]) > 25) visible++;
        if (Math.abs(image.data[i] - before.data[i]) + Math.abs(image.data[i + 1] - before.data[i + 1]) + Math.abs(image.data[i + 2] - before.data[i + 2]) > 30) changed++;
      }
      expect(visible / count).toBeGreaterThan(.1); expect(changed / count).toBeGreaterThan(.1);
      proof.push({ point, camera, visible: visible / count, changed: changed / count });
    }
  }
  writeFileSync(`${out}/pairs.json`, JSON.stringify(proof, null, 2));
});
