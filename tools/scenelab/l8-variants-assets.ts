/** L8-D2: healthy zoo variants next to their infected bases at the fixed game lens, every LOD, headless.
 * Run through tools/e2e-lock.sh. Writes one sheet per species: columns healthy | infected, rows LOD0/1/2. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, origin, stopServer } from './session';
import { PNG } from 'pngjs';
const out = process.env.OUT ?? 'test-results/l8-variants';
const distance = Number(process.env.DISTANCE ?? 13);
const species = (process.env.SPECIES ?? 'lion,gorilla,flamingo').split(',');
const qualities = ['high', 'lod1', 'lod2'] as const;
const W = 480, H = 360;
const session = new SceneSession({ viewport: { width: W, height: H } });
const metadata: unknown[] = [];
mkdirSync(out, { recursive: true });
try {
  await session.open();
  for (const name of species) {
    const sheet = new PNG({ width: W * 2, height: H * 3 });
    for (const [column, id] of [`amb.${name}`, `inf.${name}`].entries()) {
      await session.page.goto(`${origin}/preview/?asset=${id}&test=1&renderer=webgl`);
      await session.page.waitForFunction(() => !!window.__ASSET__);
      await session.page.evaluate(() => window.__ASSET__!.ready);
      await session.page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
      for (const [row, quality] of qualities.entries()) {
        await session.page.evaluate(async ({ quality, id, row, distance }) => {
          await window.__ASSET__!.deliveryView!(quality, distance);
          let label = document.querySelector<HTMLDivElement>('#lod-label');
          if (!label) { label = document.createElement('div'); label.id = 'lod-label'; label.style.cssText = 'position:fixed;top:0;left:0;color:white;background:#17151bcc;font:14px sans-serif;padding:5px'; document.body.append(label); }
          label.textContent = `${id} / LOD${row} / game lens, ${distance} m`;
        }, { quality, id, row, distance });
        const info = await session.page.evaluate(() => window.__ASSET__!.info());
        if (info.placeholder) throw new Error(`${id}/${quality}: placeholder`);
        metadata.push({ id, quality, ...info });
        PNG.bitblt(PNG.sync.read(await session.page.screenshot()), sheet, 0, 0, W, H, column * W, row * H);
      }
    }
    writeFileSync(`${out}/${name}-lods.png`, PNG.sync.write(sheet));
  }
  writeFileSync(`${out}/lod-views.json`, JSON.stringify(metadata, null, 2) + '\n');
} finally { await session.close(); stopServer(); }
