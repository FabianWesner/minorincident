/** G-25: ordinary Settings quality switches at the reported L4 checkpoint.
 * This is a crash reproduction, not full real-input console qualification. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { launchBrowser } from '../../browser-pool/client.ts';
import { provenance } from './probe.ts';

const origin = process.env.SWEEP_G_ORIGIN ?? 'http://127.0.0.1:4981';
const out = process.env.SWEEP_G_OUT ?? 'test-results/sweep-g/G-25-quality';
mkdirSync(out, { recursive: true });
const result = { ...provenance(), generatedAt: new Date().toISOString(), method: 'Fresh isolated pooled WebGPU context; native L4 turn checkpoint; ordinary Escape > Settings quality > Back > Resume. No GPU timing.', errors: [], switches: [], captures: [] };
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', error => result.errors.push({ kind: 'pageerror', text: error.stack ?? error.message }));
  page.on('console', message => { if (message.type() === 'error') result.errors.push({ kind: 'console', text: message.text() }); });
  await page.addInitScript('window.__name=f=>f');
  await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&debug=1&quality=high&audio=muted&dpr=1`);
  await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
  await page.getByTestId('start-game').click();
  await page.getByTestId('character-female').click();
  await page.getByTestId('level-L4').click({ force: true });
  await page.waitForFunction(() => !!window.__SCENE__.game.world.missions);
  await page.evaluate(async () => {
    const api = window.__SS__; await api.ready;
    await api.loadLevel('L4', { seed: 1, checkpoint: 'turn' });
    api.missions.begin(); api.cheats.god(true); window.__SCENE__.game.ui.show(null); api.resume();
  });
  await page.waitForTimeout(1500);
  for (const quality of ['low', 'high', 'low', 'high']) {
    await page.keyboard.press('Escape');
    await page.getByTestId('pause-settings').click();
    await page.getByTestId('setting-quality').selectOption(quality);
    await page.getByTestId('settings-back').click(); await page.getByTestId('resume-game').click();
    const before = await page.evaluate(() => window.__SS__.tick());
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => {
      const game = window.__SCENE__.game;
      const { setting, tier } = game.quality.snapshot();
      return { tick: window.__SS__.tick(), backend: window.__SS__.perf().backend,
        runtimeQuality: { setting, tier }, shadowSize: game.view.lighting.sun.shadow.mapSize.toArray(),
        renderedFrames: game.view.renderedFrames };
    });
    result.switches.push({ requestedQuality: quality, before, ...after, progress: after.tick > before });
  }
  const path = `${out}/final.jpg`;
  await page.screenshot({ path, type: 'jpeg', quality: 85 });
  result.captures.push({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
} catch (error) { result.failure = String(error); }
finally { await browser.close(); writeFileSync(`${out}/receipt.json`, JSON.stringify(result, null, 2)); }
console.log(JSON.stringify(result));
process.exitCode = result.failure || result.errors.length || result.switches.length !== 4 || result.switches.some(change => !change.progress) ? 1 : 0;
