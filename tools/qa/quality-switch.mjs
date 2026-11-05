/** Full level-family regression for ordinary Settings changes. Run after build:qa
 * with a preview at QA_ORIGIN, under tools/e2e-lock.sh (one browser slot).
 * QA_BACKENDS/QA_LEVELS narrow diagnostic runs; defaults cover both backends/L1–L10. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { qualityBudgets } from '../../src/core/Quality.ts';
import { launchBrowser } from '../browser-pool/client.ts';

const origin = process.env.QA_ORIGIN ?? 'http://127.0.0.1:4911';
const out = process.env.QA_OUT ?? 'test-results/fix51-p1/quality';
const levels = process.env.QA_LEVELS?.split(',') ?? Array.from({ length: 10 }, (_, i) => `L${i + 1}`);
const backends = process.env.QA_BACKENDS?.split(',') ?? ['webgpu', 'webgl'];
mkdirSync(out, { recursive: true });
const receipt = { method: 'Native level loads; physical Escape > Settings > quality > Back > Resume; live ticks, rendered frames, changed/nonempty canvas and console guard.', rows: [], errors: [], failures: [] };
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
try {
  for (const backend of backends) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    try {
      const page = await context.newPage();
      page.on('pageerror', e => receipt.errors.push({ backend, kind: 'pageerror', message: e.message }));
      page.on('console', m => { if (m.type() === 'error') receipt.errors.push({ backend, kind: 'console', message: m.text() }); });
      await page.addInitScript('window.__name=f=>f');
      await page.goto(`${origin}/?test=1&testApi=1&scenelab=1&ui=1&renderer=${backend}&quality=high&audio=muted&dpr=1`);
      await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
      await page.evaluate(async () => { await window.__SS__.ready; window.__SS__.pause(); });
      for (const level of levels) {
        await page.evaluate(async level => {
          const a = window.__SS__;
          await a.loadLevel(level, { seed: 1, ...(level === 'L4' ? { checkpoint: 'turn' } : {}) });
          a.missions.begin(); a.cheats.god(true); window.__SCENE__.game.ui.show(null); a.resume();
        }, level);
        for (const quality of ['low', 'high', 'low', 'high']) {
          await page.keyboard.press('Escape');
          await page.getByTestId('pause-settings').click();
          await page.getByTestId('setting-quality').selectOption(quality);
          await page.getByTestId('settings-back').click();
          await page.getByTestId('resume-game').click();
          const before = await page.evaluate(() => ({ tick: window.__SS__.tick(), frames: window.__SS__.perf().renderedFrames }));
          const imageBefore = PNG.sync.read(await page.locator('canvas').first().screenshot());
          await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
          await page.waitForTimeout(900);
          const after = await page.evaluate(() => {
            const a = window.__SS__, shadow = window.__SCENE__.game.view.lighting?.sun.shadow, map = shadow?.map;
            return { tick: a.tick(), frames: a.perf().renderedFrames, backend: a.perf().backend, contextLost: a.perf().contextLost, quality: a.getState().render.quality,
              shadow: map ? { requested: shadow.mapSize.x, width: map.width, height: map.height, depthWidth: map.depthTexture.image.width, depthHeight: map.depthTexture.image.height } : null };
          });
          const imageAfter = PNG.sync.read(await page.locator('canvas').first().screenshot());
          let changed = 0, detailed = 0;
          for (let i = 0; i < imageAfter.data.length; i += 4) {
            if (Math.abs(imageAfter.data[i] - imageBefore.data[i]) + Math.abs(imageAfter.data[i + 1] - imageBefore.data[i + 1]) + Math.abs(imageAfter.data[i + 2] - imageBefore.data[i + 2]) > 24) changed++;
            if (i > imageAfter.width * 4 && Math.abs(imageAfter.data[i] - imageAfter.data[i - imageAfter.width * 4]) > 6) detailed++;
          }
          const row = { level, backend, quality, before, after, changed, detailed };
          receipt.rows.push(row); console.log(JSON.stringify(row));
          assert.equal(after.backend, backend); assert.equal(after.quality, quality);
          if (after.shadow) {
            const size = qualityBudgets[quality].shadowSize;
            assert.deepEqual(after.shadow, { requested: size, width: size, height: size, depthWidth: size, depthHeight: size }, `${level}/${backend}/${quality}: actual shadow allocation`);
          }
          assert.ok(after.tick > before.tick, `${level}/${backend}/${quality}: world stopped ticking`);
          assert.ok(after.frames > before.frames && !after.contextLost, `${level}/${backend}/${quality}: renderer stopped`);
          assert.ok(changed > 100 && detailed > 100, `${level}/${backend}/${quality}: canvas frozen/empty`);
          assert.equal(receipt.errors.length, 0, JSON.stringify(receipt.errors.slice(-3)));
        }
        await page.locator('canvas').first().screenshot({ path: `${out}/${level}-${backend}.jpg`, type: 'jpeg', quality: 82 });
        writeFileSync(`${out}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
      }
    } finally { await context.close(); }
  }
} catch (error) { receipt.failures.push(String(error)); process.exitCode = 1; }
finally { await browser.close(); writeFileSync(`${out}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n'); }
assert.equal(receipt.failures.length + receipt.errors.length, 0, JSON.stringify({ failures: receipt.failures, errors: receipt.errors.slice(-3) }));
