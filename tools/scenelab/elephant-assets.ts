/** Z-D1: explicit authored LODs at a fixed game lens/elevation, headless Metal.
 * Run through tools/e2e-lock.sh; captures four species at identical world scale. */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { SceneSession, origin, stopServer } from './session';
import { PNG } from 'pngjs';
const out = 'docs/reports/elephant-asset';
const session = new SceneSession({ viewport: { width: 480, height: 360 } });
const qualities = ['high', 'lod1', 'lod2'] as const;
const ids = ['amb.elephant', 'inf.elephant', 'inf.lion', 'inf.gorilla'];
const metadata: unknown[] = [];
mkdirSync(out, { recursive: true });
try {
  await session.open();
  const sheet = new PNG({ width: 1920, height: 1080 });
  for (const [column, id] of ids.entries()) {
    await session.page.goto(`${origin}/preview/?asset=${id}&test=1&renderer=webgl`);
    await session.page.waitForFunction(() => !!window.__ASSET__);
    await session.page.evaluate(() => window.__ASSET__!.ready);
    await session.page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
    for (const [row, quality] of qualities.entries()) {
      await session.page.evaluate(async ({ quality, id, row }) => {
        await window.__ASSET__!.deliveryView!(quality, 13);
        let label = document.querySelector<HTMLDivElement>('#lod-label');
        if (!label) { label = document.createElement('div'); label.id = 'lod-label'; label.style.cssText = 'position:fixed;top:0;left:0;color:white;background:#17151bcc;font:14px sans-serif;padding:5px'; document.body.append(label); }
        label.textContent = `${id} / LOD${row} / 25° lens, 36° elevation, 13 m`;
      }, { quality, id, row });
      const info = await session.page.evaluate(() => window.__ASSET__!.info());
      if (info.placeholder) throw new Error(`${id}/${quality}: placeholder`);
      metadata.push({ id, quality, ...info });
      PNG.bitblt(PNG.sync.read(await session.page.screenshot()), sheet, 0, 0, 480, 360, column * 480, row * 360);
    }
  }
  // Reference source remains read-only; include a resized copy in the evidence sheet.
  const reference = PNG.sync.read(readFileSync('initial-drafts/animals-pets-and-zoo.png'));
  const combined = new PNG({ width: sheet.width, height: sheet.height + 600 });
  PNG.bitblt(sheet, combined, 0, 0, sheet.width, sheet.height, 0, 0);
  const width = Math.round(600 * reference.width / reference.height);
  for (let y = 0; y < 600; y++) for (let x = 0; x < width; x++) {
    const from = (Math.floor(y * reference.height / 600) * reference.width + Math.floor(x * reference.width / width)) * 4;
    const to = ((sheet.height + y) * combined.width + x) * 4;
    reference.data.copy(combined.data, to, from, from + 4);
  }
  writeFileSync(`${out}/after-lods.png`, PNG.sync.write(combined));
  writeFileSync(`${out}/lod-views.json`, JSON.stringify(metadata, null, 2) + '\n');
  // Record the original placeholder with its original size, on the same lens.
  // A local fixture manifest is exposed only for this browser navigation and restored immediately.
  if (!existsSync(`${out}/before-placeholder.png`)) {
  const path = 'src/assets/manifest.json', original = readFileSync(path, 'utf8');
  try {
    const manifest = JSON.parse(original);
    const def = manifest.find((d: { id: string }) => d.id === 'amb.elephant');
    def.status = 'placeholder'; def.dimensions = { x: 1, y: 1, z: 1, tolerance: .1 };
    writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
    await session.page.goto(`${origin}/preview/?asset=amb.elephant&test=1&renderer=webgl&before=1`);
    await session.page.waitForFunction(() => !!window.__ASSET__);
    await session.page.evaluate(() => window.__ASSET__!.ready);
    await session.page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
    await session.page.evaluate(() => window.__ASSET__!.deliveryView!('high', 13));
    await session.page.screenshot({ path: `${out}/before-placeholder.png` });
  } finally { writeFileSync(path, original); }
  }
} finally { await session.close(); stopServer(); }
