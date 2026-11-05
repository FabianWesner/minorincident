/** Native L10 approach fixtures for visual inspection, not completion receipts. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from '../browser-pool/client.ts';
import { cure } from '../../src/levels/L10/district.ts';
import { cureEncounters } from '../../src/levels/L10/encounters.ts';

const origin = process.env.QA_ORIGIN ?? 'http://127.0.0.1:4911';
const out = process.env.QA_OUT ?? 'test-results/fix51-p1/l10-views';
mkdirSync(out, { recursive: true });
const receipt = { method: 'Visual fixtures only: native level/encounters, protected stationary courier at fixed authored approach anchors; no population injection. Teleport and pause/step prepare views; no completion/latency claim.', rows: [], errors: [] };
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
try {
  for (const quality of ['low', 'high']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    try {
      const page = await context.newPage(); await page.addInitScript('window.__name=f=>f');
      page.on('console', m => { if (m.type() === 'error') receipt.errors.push(m.text()); });
      page.on('pageerror', e => receipt.errors.push(e.message));
      await page.goto(`${origin}/?test=1&testApi=1&scenelab=1&quality=${quality}&audio=muted&dpr=1`);
      await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
      const load = await page.evaluate(async quality => {
        const a = window.__SS__; await a.ready; await a.loadLevel('L10', { seed: 1 }); a.missions.begin(); a.pause(); a.cheats.god(true);
        a.settings.set({ quality, cameraShake: false }); window.__SCENE__.game.ui.show(null);
        return a.perf().loadTiming;
      }, quality);
      await page.evaluate(() => window.__SS__.step(3600));
      for (const region of cure.regions) {
        const group = cureEncounters.find(g => g.region === region.id && !g.assault);
        const point = { x: group.at[0] - 35, z: group.at[1] };
        await page.evaluate(async point => {
          const a = window.__SS__; a.teleport(1, point); a.camera.follow();
          for (let i = 0; i < 60; i++) await a.step(6);
        }, point);
        for (const zoom of [.5, 1.5]) {
          await page.evaluate(async zoom => { const a = window.__SS__; a.camera.zoom(zoom); await a.screenshotReady(); }, zoom);
          const file = `${region.id}-${quality}-z${zoom}.jpg`;
          await page.locator('canvas').first().screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 84 });
          const state = await page.evaluate(() => {
            const a = window.__SS__, p = a.getEntity(1).transform;
            return { tick: a.tick(), player: p, quality: a.getState().render.quality, frames: a.perf().renderedFrames,
              enemies: a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 30).map(e => ({ id: e.id, archetype: e.archetype, state: e.infected.state, position: e.transform })) };
          });
          receipt.rows.push({ region: region.id, quality, zoom, file, state, load });
          writeFileSync(`${out}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
          console.log(`${region.id}/${quality}/${zoom}: ${state.enemies.length} nearby`);
        }
      }
    } finally { await context.close(); }
  }
} finally { await browser.close(); writeFileSync(`${out}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n'); }
if (receipt.errors.length) throw new Error(receipt.errors.join('\n'));
