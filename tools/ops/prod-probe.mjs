// Probe a deployed build like a player: menu → courier → L1 → Begin, then report load time and page errors.
//   node --import tsx tools/ops/prod-probe.mjs [url]   (shared pool; default https://minor-incident.com)
import { launchBrowser } from '../browser-pool/client.ts';

const url = process.argv[2] ?? 'https://minor-incident.com';
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
try {
  await page.goto(`${url}/?audio=muted`, { waitUntil: 'load', timeout: 60_000 });
  await page.getByRole('heading', { name: 'MINOR INCIDENT' }).waitFor({ timeout: 60_000 });
  await page.getByTestId('start-game').click();
  await page.getByTestId('character-female').click();
  await page.getByTestId('level-L1').click();
  const t0 = Date.now();
  await page.getByTestId('mission-button').click({ timeout: 120_000 });
  await page.getByTestId('pause-button').waitFor({ state: 'visible', timeout: 120_000 });
  const L1BeginSeconds = Math.round((Date.now() - t0) / 10) / 100;
  console.log(JSON.stringify({ title: await page.title(), L1BeginSeconds, errors }));
  if (errors.length) process.exitCode = 1;
} catch (e) {
  console.log(JSON.stringify({ failed: String(e).split('\n')[0], errors }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
