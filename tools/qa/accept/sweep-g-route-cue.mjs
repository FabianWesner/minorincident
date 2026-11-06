/** Observe every actual objective child around a physical L1 movement interval. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { launchBrowser } from '../../browser-pool/client.ts';
import { provenance } from './probe.ts';
const phase = process.env.SWEEP_G_PHASE ?? 'before';
const origin = process.env.SWEEP_G_ORIGIN ?? 'http://127.0.0.1:4981';
const out = `test-results/sweep-g/G-08-L1-cue-${phase}`; mkdirSync(out, { recursive: true });
const result = { ...provenance(), method: 'Production L1 beginning setup, actual objective meshes. Physical WASD intervals; read-only child positions, HUD and actual camera snapshots. No target/marker/world position writes.', phase, cells: [], errors: [] };
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
 for (const tier of ['low', 'high']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => result.errors.push({ tier, kind: 'pageerror', text: String(e) }));
  page.on('console', m => { if (m.type() === 'error') result.errors.push({ tier, kind: 'console', text: m.text() }); });
  await page.addInitScript('window.__name=f=>f');
  await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&debug=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1`);
  await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
  await page.evaluate(async tier => { const a = window.__SS__; await a.ready; await a.loadLevel('L1', { seed: 1 }); a.settings.set({ quality: tier }); a.missions.begin(); a.pause(); window.__SCENE__.game.ui.show(null); }, tier);
  await page.evaluate(() => window.__SS__.resume());
  await page.waitForFunction(() => !window.__SCENE__.game.world.storyLock && window.__SCENE__.game.view.marker?.visible, null, { timeout: 120000 });
  await page.evaluate(() => { window.__SS__.pause(); window.__SCENE__.game.ui.show(null); });
  const samples = [], captures = [];
  for (let i = 0; i < 3; i++) {
   if (i) {
    await page.evaluate(() => window.__SS__.resume());
    const key = i === 1 ? 'KeyD' : 'KeyW'; await page.keyboard.down(key); await page.waitForTimeout(450); await page.keyboard.up(key);
    await page.evaluate(() => { window.__SS__.pause(); window.__SCENE__.game.ui.show(null); });
   }
   await page.evaluate(async () => { await window.__SS__.screenshotReady(); });
   samples.push(await page.evaluate(() => {
    const g = window.__SCENE__.game, m = g.world.missions, marker = g.view.marker;
    return { tick: g.world.tick, player: { ...g.world.entities.get(1).transform }, markerId: m.state.marker, authoredAnchor: { ...m.def.anchors[m.state.marker] }, markerVisible: marker.visible, markerWorld: marker.getWorldPosition(marker.position.clone()).toArray(), children: marker.children.map((c, index) => ({ index, visible: c.visible, position: c.getWorldPosition(c.position.clone()).toArray(), type: c.geometry?.type })), tracker: document.querySelector('[data-testid="mission-tracker"]')?.textContent, camera: g.view.view.getState(), quality: g.quality.snapshot().tier };
   }));
   const file = `${out}/${tier}-${i}.jpg`; await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
   captures.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), reviewed: false });
  }
  result.cells.push({ tier, samples, captures }); await page.close();
 }
} catch (error) { result.failure = String(error); }
finally { await browser.close(); writeFileSync(`docs/reports/sweep-g/G-08-L1-cue-${phase}.json`, JSON.stringify(result, null, 2) + '\n'); }
console.log(JSON.stringify({ failure: result.failure, errors: result.errors, cells: result.cells.map(c => ({ tier: c.tier, samples: c.samples })) }));
process.exitCode = result.failure || result.errors.length ? 1 : 0;
