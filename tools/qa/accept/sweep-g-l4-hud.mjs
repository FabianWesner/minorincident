/** Controlled L4 collapse HUD proof; real WASD separates two observed poses. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { launchBrowser } from '../../browser-pool/client.ts';

const phase = process.argv[2] ?? 'before';
if (!['before', 'after'].includes(phase)) throw new Error('Expected before|after');
const build = JSON.parse(readFileSync(`docs/reports/sweep-g/build${phase === 'after' ? '-final' : ''}.json`, 'utf8'));
for (const bundle of build.bundles) if (createHash('sha256').update(readFileSync(bundle.file)).digest('hex') !== bundle.sha256) throw new Error(`Build changed: ${bundle.file}`);
const out = `test-results/sweep-g/G-08-${phase}`; mkdirSync(out, { recursive: true });
const receipt = { phase, sourceHash: build.sourceHash, generatedAt: new Date().toISOString(), method: 'Controlled authored L4 line-break checkpoint prefix (objective skips during setup only); ordinary WASD between two collapse poses per tier. Read-only actual HUD/ring/destination observation. No performance timing.', cells: [], errors: [] };
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  for (const tier of ['low', 'high']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    try {
      const page = await context.newPage();
      page.on('console', message => { if (message.type() === 'error') receipt.errors.push({ tier, kind: 'console', text: message.text() }); });
      page.on('pageerror', error => receipt.errors.push({ tier, kind: 'pageerror', text: error.message }));
      await page.addInitScript('window.__name=f=>f');
      await page.goto(`${process.env.SWEEP_G_ORIGIN ?? 'http://127.0.0.1:4981'}/?test=poses&testApi=1&scenelab=1&debug=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1`);
      await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
      await page.getByTestId('start-game').click(); await page.getByTestId('character-female').click(); await page.getByTestId('level-L4').click({ force: true });
      await page.waitForFunction(() => !!window.__SCENE__.game.world.missions);
      await page.evaluate(async tier => {
        const api = window.__SS__; await api.ready; await api.loadLevel('L4', { seed: 1, checkpoint: 'line-break' });
        api.settings.set({ quality: tier }); api.cheats.god(true); window.__SCENE__.game.ui.show(null); api.camera.zoom(1.5); api.resume();
      }, tier);
      for (const [index, key] of ['KeyW', 'KeyD'].entries()) {
        await page.keyboard.down(key); await page.waitForTimeout(800); await page.keyboard.up(key);
        await page.evaluate(async () => { window.__SS__.pause(); await window.__SS__.screenshotReady(); });
        const data = await page.evaluate(() => {
          const game = window.__SCENE__.game, mission = game.world.missions, player = game.world.entities.get(1).transform;
          const anchor = mission.def.anchors[mission.state.marker], q = id => document.querySelector(`[data-testid="${id}"]`);
          const visible = element => !!element && !element.hidden && element.offsetParent !== null;
          const text = q('objective-text').textContent, matches = [...text.matchAll(/(?:^| · )(\d+(?:\.\d+)?)\s*m\b/g)];
          return { tick: game.world.tick, levelPhase: mission.state.l4.phase, player: { ...player }, marker: mission.state.marker,
            destination: { ...anchor }, directM: Math.hypot(anchor.x - player.x, anchor.z - player.z), text,
            displayedM: matches.length ? Number(matches.at(-1)[1]) : null,
            hudRouteVisible: visible(q('minimap-route')), legacyRouteVisible: visible(q('mission-route-pin')),
            markerGuidance: q('mission-marker')?.dataset.guidance, ring: window.__SS__.getState().render.missionMarker,
            backend: window.__SS__.perf().backend, quality: game.quality.snapshot().tier };
        });
        const file = `${out}/${tier}-${index + 1}.jpg`; await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
        receipt.cells.push({ tier, index, ...data, file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
        await page.evaluate(() => window.__SS__.resume());
      }
    } finally { await context.close(); }
  }
} catch (error) { receipt.failure = String(error); }
finally { await browser.close(); writeFileSync(`docs/reports/sweep-g/G-08-${phase}.json`, JSON.stringify(receipt, null, 2)); }
console.log(JSON.stringify(receipt));
process.exitCode = receipt.failure || receipt.errors.length || receipt.cells.length !== 4 || receipt.cells.some(cell => cell.quality !== cell.tier || cell.levelPhase !== 'collapse' || cell.hudRouteVisible || cell.legacyRouteVisible || cell.displayedM !== Math.round(cell.directM)) ? 1 : 0;
