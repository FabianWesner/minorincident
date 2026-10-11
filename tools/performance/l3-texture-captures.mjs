// Run under tools/e2e-lock.sh; fixed seed/tick/camera, separate from load timing.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const [base, label] = process.argv.slice(2), dir = 'docs/reports/l3-textures-data';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--ignore-certificate-errors-spki-list=' + process.env.LOAD_SPKI] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(base + '/?test=1&dpr=1&quality=high&audio=muted&seed=42');
  await page.waitForFunction(() => !!window.__SS__, undefined, { timeout: 120000 });
  await page.evaluate(async () => {
    const api = window.__SS__; await api.ready; api.pause();
    await api.loadLevel('L3', { seed: 42, progression: 'L3-default' }); api.pause();
  });
  for (const spot of ['l3-station-yard', 'l3-commerce-street', 'l3-army-checkpoint']) {
    await page.evaluate(async spot => {
      const api = window.__SS__; api.camera.preset('D-CORRIDOR/W2/' + spot); await api.step(0); await api.screenshotReady();
    }, spot);
    await page.screenshot({ path: `${dir}/${label}-${spot}.png` });
  }
  writeFileSync(`${dir}/${label}-captures.json`, JSON.stringify({ base, seed: 42, state: await page.evaluate(() => window.__SS__.getState()), errors }, null, 2));
  if (errors.length) throw Error(JSON.stringify(errors));
} finally { await browser.close(); }
