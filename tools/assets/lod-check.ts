/** Review shipped assets in the game renderer: three LODs, two game-angle views. */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const roofOff = process.argv.includes('--roof-off');
const ids = process.argv.slice(2).filter(id => id !== '--roof-off');
if (!ids.length) throw new Error('Usage: tsx tools/assets/lod-check.ts <id> ... (E2E_PORT selects an existing server)');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  for (const id of ids) {
    await page.goto(`http://127.0.0.1:${process.env.E2E_PORT ?? 3300}/preview/?asset=${id}&test=1&renderer=webgl&production=1&inspection=1`);
    await page.waitForFunction(() => !!window.__ASSET__);
    await page.evaluate(() => window.__ASSET__!.ready);
    await page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
    const sheet = new PNG({ width: 1200, height: 600 });
    for (const [row, azimuth] of [45, 225].entries()) for (const [column, quality] of (['high', 'lod1', 'lod2'] as const).entries()) {
      await page.evaluate(async ({ quality, azimuth, roofOff }) => { await window.__ASSET__!.inspectionView!(quality, azimuth, !roofOff); }, { quality, azimuth, roofOff });
      if (await page.evaluate(() => window.__ASSET__!.info().placeholder)) throw new Error(`${id}:${quality}: placeholder`);
      await page.evaluate(({ id, quality, azimuth }) => {
        let label = document.querySelector<HTMLDivElement>('#lod-check-label');
        if (!label) { label = document.createElement('div'); label.id = 'lod-check-label'; label.style.cssText = 'position:fixed;top:0;left:0;color:white;background:#17151bcc;font:12px sans-serif;padding:5px'; document.body.append(label); }
        label.textContent = `${id} ${quality === 'high' ? 'lod0' : quality} · ${azimuth}°`;
      }, { id, quality, azimuth });
      PNG.bitblt(PNG.sync.read(await page.screenshot()), sheet, 0, 0, 400, 300, column * 400, row * 300);
    }
    const directory = `assets/${id}/renders`; mkdirSync(directory, { recursive: true });
    writeFileSync(`${directory}/${roofOff ? 'lod-roof-off' : 'lod-check'}.png`, PNG.sync.write(sheet));
    console.log(`${directory}/${roofOff ? 'lod-roof-off' : 'lod-check'}.png`);
  }
} finally { await browser.close(); }
