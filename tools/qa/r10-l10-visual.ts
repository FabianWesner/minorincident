/** Matched baseline/candidate L10 views plus a 60-frame burning-police-car probe.
 * R10_DIST=<QA dist> sh tools/e2e-lock.sh node --import tsx tools/qa/r10-l10-visual.ts before|after
 * Captures are supplementary to the physical tools/playtest route runs. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { launchBrowser } from '../browser-pool/client';

const side = process.argv[2];
if (side !== 'before' && side !== 'after') throw new Error('Expected before|after');
const out = `test-results/r10-l10/visual-${side}`;
mkdirSync(out, { recursive: true });
const port = Number(process.env.E2E_PORT ?? 3895);
if (port === 3300) throw new Error('Private QA port required');
const server = await preview({ configFile: false, build: { outDir: resolve(process.env.R10_DIST ?? `test-results/r10-l10/${side}-dist`) }, preview: { host: '127.0.0.1', port, strictPort: true } });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const rows: unknown[] = [];
const spots: [string, number, number][] = [['police', 1414, 15], ['command', 2260, -66], ['evac', 2315, -63], ['triage', 3400, -93], ['forecourt', 3505, -96], ['approach', 3910, -69], ['console', 3950, -27]];
try {
  for (const tier of ['low', 'high'] as const) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); page.setDefaultTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript('globalThis.__name = fn => fn');
    await page.goto(`http://127.0.0.1:${port}/?test=1&scenelab=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1&preload=0`);
    await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
    await page.evaluate(async tier => { await window.__SS__!.ready; window.__SS__!.pause(); window.__SS__!.settings.set({ quality: tier, cameraShake: false }); }, tier);
    const spec = JSON.parse(readFileSync('tests/scenes/catalog/l10-crossing-r3.json', 'utf8'));
    await page.evaluate(async spec => { await window.__SCENE__!.load(spec); }, spec);
    const fires = [];
    for (let frame = 0; frame <= 60; frame++) {
      if (frame) await page.evaluate(async () => { await window.__SS__!.step(1); });
      fires.push(await page.evaluate(() => window.__SS__!.getState().render.vfx));
      if ([0, 1, 15, 60].includes(frame)) { await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/fire-${tier}-f${frame}.jpg`, type: 'jpeg', quality: 88 }); }
    }
    rows.push({ side, tier, kind: 'police-fire-frames', fires });
    await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L10', { seed: 32, progression: 'L10-default' } as never); a.missions.begin(); a.pause(); a.cheats.god(true); });
    for (const [name, x, z] of spots) {
      await page.evaluate(async ({ x, z }) => { const a = window.__SS__!; a.cheats.killAll(); a.teleport(1, { x, z }); a.camera.follow(); await a.step(180); a.cheats.killAll(); }, { x, z });
      for (const zoom of [1, 1.5]) {
        await page.evaluate(async zoom => { const a = window.__SS__!; a.camera.zoom(zoom); await a.step(1); await a.screenshotReady(); }, zoom);
        const file = `${out}/${name}-${tier}-z${zoom}.jpg`;
        await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
        rows.push({ side, tier, name, zoom, file, state: await page.evaluate(() => ({ vfx: window.__SS__!.getState().render.vfx, perf: window.__SS__!.perf() })) });
      }
    }
    rows.push({ tier, errors });
    writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1));
    await context.close();
  }
} finally { await browser.close(); await server.close(); writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1)); }
