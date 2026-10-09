/** Fixed game-camera peer evidence for the L5 military asset lane. */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import manifest from '../../src/assets/manifest.json';
const output = 'test-results/l5-military-wrecks-and-line';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 360 } });
  for (const id of ['veh.tank', 'veh.military-apc', 'veh.military-truck', 'decay.abandoned-checkpoint']) {
    const wreck = id.startsWith('veh.');
    const label = id + (wreck ? '.wrecked' : '');
    const peer = wreck ? id : 'kit.army-checkpoint';
    const directory = `${output}/${label}`;
    mkdirSync(directory, { recursive: true });
    const records = [];
    for (const pixels of [135, 190]) {
      for (const role of ['wreck', 'peer']) {
        const asset = role === 'peer' ? peer : id;
        await page.goto(`http://127.0.0.1:${process.env.E2E_PORT ?? 3357}/preview/?asset=${asset}&production=1&test=1&renderer=webgl`);
        await page.waitForFunction(() => !!window.__ASSET__);
        await page.evaluate(() => window.__ASSET__!.ready);
        if (role === 'wreck' && wreck) await page.locator('#decay').evaluate(el => { (el as HTMLSelectElement).value = 'wrecked'; });
        await page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
        const { x, y, z } = manifest.find(a => a.id === asset)!.dimensions;
        const width = (x + z) / Math.sqrt(2);
        const height = y * Math.cos(Math.PI * .2) + width * Math.sin(Math.PI * .2);
        const distance = Math.max(width, height) * 360 / (2 * pixels * Math.tan(25 * Math.PI / 360));
        for (const quality of role === 'peer' ? ['high'] as const : ['high', 'lod1', 'lod2'] as const) {
          await page.evaluate(async ({ quality, distance }) => { await window.__ASSET__!.deliveryView!(quality, distance); }, { quality, distance });
          const info = await page.evaluate(() => window.__ASSET__!.info());
          if (info.placeholder || info.events.length) throw new Error(`${label} ${role} ${quality}: placeholder/fallback ${JSON.stringify(info.events)}`);
          const path = `${directory}/${role}-${pixels}-${quality}.png`;
          await page.screenshot({ path });
          records.push({ asset, role, quality, pixels, distance, ...info });
        }
      }
    }
    writeFileSync(`${directory}/game-camera.json`, JSON.stringify({ id: label, peer, fov: 25, azimuth: 45, polar: Math.PI * .3, records }, null, 2) + '\n');
  }
} finally { await browser.close(); }
