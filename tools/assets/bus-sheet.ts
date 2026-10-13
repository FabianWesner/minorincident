/**
 * Large game-lighting sheets for one vehicle (bus-hero QA): a 2x2 ring at 4 azimuths for the chosen quality plus
 * optional close-up crops. Needs a vite dev/preview server on E2E_PORT.
 * Usage: E2E_PORT=3377 sh tools/e2e-lock.sh npx tsx tools/assets/bus-sheet.ts <id> <decay|-> <outDir> <tag> [high|lod1|lod2] [az,az,az,az] [l,t,r,b close-up crop]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [id, decayArg = '-', out = 'test-results/bus-sheet', tag = 'sheet', quality = 'high', azArg = '45,135,225,315', cropArg = ''] = process.argv.slice(2);
const decay = decayArg === '-' ? undefined : decayArg;
const port = process.env.E2E_PORT ?? 3377;
const azimuths = azArg.split(',').map(Number);
const crop = cropArg ? cropArg.split(',').map(Number) as [number, number, number, number] : undefined;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
try {
  const width = 800, height = 540;
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`http://127.0.0.1:${port}/preview/?asset=${encodeURIComponent(id)}&production=1&test=1&renderer=webgl&inspection=1`);
  await page.waitForFunction(() => !!window.__ASSET__);
  await page.evaluate(() => window.__ASSET__!.ready);
  if (decay) await page.locator('#decay').evaluate((el, value) => { (el as HTMLSelectElement).value = value; }, decay);
  await page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
  const cols = azimuths.length > 1 ? 2 : 1, rows = Math.ceil(azimuths.length / cols);
  const sheet = new PNG({ width: cols * width, height: rows * height });
  for (const [i, azimuth] of azimuths.entries()) {
    await page.evaluate(async ({ quality, azimuth }) => { await window.__ASSET__!.inspectionView!(quality as 'high', azimuth); }, { quality, azimuth });
    if (crop) await page.evaluate(c => window.__ASSET__!.frame!(c), crop);
    await page.waitForTimeout(400);
    PNG.bitblt(PNG.sync.read(await page.screenshot()), sheet, 0, 0, width, height, (i % cols) * width, Math.floor(i / cols) * height);
  }
  writeFileSync(`${out}/${tag}.png`, PNG.sync.write(sheet));
  console.log(`${out}/${tag}.png`);
} finally { await browser.close(); }
