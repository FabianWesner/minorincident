/** Reproducible L3 delivery evidence at the fixed game camera, 160px silhouette. */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import manifest from '../../src/assets/manifest.json';

const ids = ['veh.sedan-white', 'veh.suv-dark', 'veh.pickup-red', 'veh.ambulance', 'veh.school-bus', 'veh.military-apc'];
const output = 'test-results/l3-traffic-and-army-vehicles';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 360 } });
  for (const id of ids) {
    const decay = id === 'veh.military-apc' ? undefined : 'wrecked';
    const label = id + (decay ? `.${decay}` : '');
    const directory = `${output}/${label}`;
    mkdirSync(directory, { recursive: true });
    await page.goto(`http://127.0.0.1:${process.env.E2E_PORT ?? 3318}/preview/?asset=${id}&production=1&test=1`);
    await page.waitForFunction(() => !!window.__ASSET__);
    await page.evaluate(() => window.__ASSET__!.ready);
    if (decay) await page.locator('#decay').evaluate((el, value) => { (el as HTMLSelectElement).value = value; }, decay);
    await page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
    const def = manifest.find(a => a.id === id)!;
    const { x, y, z } = def.dimensions;
    const width = (x + z) / Math.sqrt(2);
    const height = y * Math.cos(Math.PI * .2) + width * Math.sin(Math.PI * .2);
    const distance = Math.max(width, height) * 360 / (2 * 160 * Math.tan(25 * Math.PI / 360));
    const views = [];
    for (const quality of ['high', 'lod1', 'lod2'] as const) {
      await page.evaluate(async ({ quality, distance }) => { await window.__ASSET__!.deliveryView!(quality, distance); }, { quality, distance });
      const info = await page.evaluate(() => window.__ASSET__!.info());
      if (info.placeholder) throw new Error(`${label} ${quality}: placeholder`);
      await page.screenshot({ path: `${directory}/game-${quality === 'high' ? 'lod0' : quality}.png` });
      views.push({ quality, distance, ...info });
    }
    writeFileSync(`${directory}/game-camera.json`, JSON.stringify({ id: label, fov: 25, azimuth: 45, polar: .3 * Math.PI, targetPixels: 160, views }, null, 2) + '\n');
  }
} finally { await browser.close(); }
