/**
 * Independent asset QA sheet: game camera (FOV25, azimuth45, polar0.30pi) at 135/190 px for LOD0/1/2,
 * plus an inspection ring (4 azimuths) for LOD0 and LOD2. Needs a preview/dev server on E2E_PORT.
 * Usage: E2E_PORT=3361 sh tools/e2e-lock.sh npx tsx tools/assets/qa-sheet.ts <id> [decay|-] <outDir> [peerId]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [id, decayArg = '-', out = 'test-results/qa-sheet'] = process.argv.slice(2);
const decay = decayArg === '-' ? undefined : decayArg;
const manifest: { id: string; dimensions: { x: number; y: number; z: number } }[] = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8'));
const port = process.env.E2E_PORT ?? 3361;
const label = id + (decay ? `.${decay}` : '');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 360 } });
  await page.goto(`http://127.0.0.1:${port}/preview/?asset=${encodeURIComponent(id)}&production=1&test=1&renderer=webgl&inspection=1`);
  await page.waitForFunction(() => !!window.__ASSET__);
  await page.evaluate(() => window.__ASSET__!.ready);
  if (decay) await page.locator('#decay').evaluate((el, value) => { (el as HTMLSelectElement).value = value; }, decay);
  await page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
  await page.waitForTimeout(1500);
  const def = manifest.find(a => a.id === id)!;
  const { x, y, z } = def.dimensions;
  const width = (x + z) / Math.SQRT2, height = y * Math.cos(Math.PI * .2) + width * Math.sin(Math.PI * .2);
  const sheet = new PNG({ width: 1440, height: 720 });
  const qualities = ['high', 'lod1', 'lod2'] as const;
  for (const [row, pixels] of [135, 190].entries()) {
    const distance = Math.max(width, height) * 360 / (2 * pixels * Math.tan(25 * Math.PI / 360));
    for (const [col, quality] of qualities.entries()) {
      await page.evaluate(async ({ quality, distance }) => { await window.__ASSET__!.deliveryView!(quality, distance); }, { quality, distance });
      await page.waitForTimeout(500);
      PNG.bitblt(PNG.sync.read(await page.screenshot()), sheet, 0, 0, 480, 360, col * 480, row * 360);
    }
  }
  writeFileSync(`${out}/${label}.game.png`, PNG.sync.write(sheet));
  const ring = new PNG({ width: 1920, height: 720 });
  for (const [row, quality] of (['high', 'lod2'] as const).entries()) {
    for (const [col, azimuth] of [45, 135, 225, 315].entries()) {
      await page.evaluate(async ({ quality, azimuth }) => { await window.__ASSET__!.inspectionView!(quality, azimuth); }, { quality, azimuth });
      await page.waitForTimeout(500);
      PNG.bitblt(PNG.sync.read(await page.screenshot()), ring, 0, 0, 480, 360, col * 480, row * 360);
    }
  }
  writeFileSync(`${out}/${label}.ring.png`, PNG.sync.write(ring));
  console.log(`${out}/${label}.game.png ${out}/${label}.ring.png`, JSON.stringify(await page.evaluate(() => window.__ASSET__!.info())).slice(0, 200));
} finally { await browser.close(); }
