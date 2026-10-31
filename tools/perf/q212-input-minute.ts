/** Separate public-build gameplay check; cold-load-time.ts remains the load measurement. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from '../browser-pool/client';
import { preset } from '../../src/sim/progression/Campaign';
import { SAVE_KEY, validateSave } from '../../src/sim/progression/Save';

const [origin, out, levels = 'L3', quality = 'high'] = process.argv.slice(2);
assert.ok(origin && out, 'pass public preview origin and output directory');
assert.notEqual(new URL(origin).port, '3300');
assert.equal(process.env.MI_PERF_LOCK_HELD, '1', 'Use quiet-run.sh');
assert.ok(quality === 'high' || quality === 'low');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
try {
  for (const level of levels.split(',')) {
    assert.match(level, /^L(?:[1-9]|10)$/);
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    try {
      page.setDefaultTimeout(120_000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.addInitScript(`(() => {
        const p = window.__q212Play = { start: null, frames: [], builds: [], adapter: null };
        const request = navigator.gpu.requestAdapter;
        navigator.gpu.requestAdapter = function(...args) { return request.apply(this, args).then(adapter => {
          if (adapter) p.adapter = { architecture: adapter.info?.architecture, fallback: adapter.isFallbackAdapter ?? adapter.info?.isFallbackAdapter };
          return adapter;
        }); };
        for (const name of ['createRenderPipeline', 'createRenderPipelineAsync', 'createShaderModule']) {
          const original = GPUDevice.prototype[name];
          GPUDevice.prototype[name] = function(...args) {
            if (p.start !== null) p.builds.push({ at: performance.now() - p.start, name, label: args[0]?.label ?? '' });
            return original.apply(this, args);
          };
        }
        let last = null;
        const frame = at => { if (p.start !== null && last !== null) p.frames.push({ at: Math.max(last, p.start) - p.start, ms: at - Math.max(last, p.start) }); last = at; requestAnimationFrame(frame); };
        requestAnimationFrame(frame);
      })();`);
      if (level !== 'L1') {
        const save = preset(`${level}-default` as Parameters<typeof preset>[0]);
        save.settings.quality = quality;
        assert.ok(validateSave(save));
        await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: JSON.stringify(save) });
      }
      await page.goto(`${origin}/?quality=${quality}&audio=muted&dpr=1`);
      await page.getByTestId('title-settings').click();
      await page.getByTestId('setting-quality').selectOption(quality);
      await page.getByTestId('settings-back').click();
      await page.getByTestId('start-game').click();
      if (level === 'L1') await page.getByTestId('character-female').click();
      await page.getByTestId(`level-${level}`).click();
      await page.getByTestId('level-transition').waitFor({ state: 'hidden' });
      const begin = page.getByRole('button', { name: 'Begin mission', exact: true });
      // Arm before the input handoff so its first displayed frame is included.
      await page.evaluate('window.__q212Play.start = performance.now()');
      if (await begin.isVisible()) await begin.click();
      await page.getByTestId('pause-button').waitFor();
      for (const key of ['w', 'd', 's', 'a', 'w', 'd']) {
        await page.keyboard.down(key);
        await page.waitForTimeout(10_000);
        await page.keyboard.up(key);
      }
      const result = await page.evaluate(`(() => {
        const p = window.__q212Play;
        return { ...p, elapsedMs: performance.now() - p.start, maxFrameMs: Math.max(...p.frames.map(f => f.ms)),
          framesOver200: p.frames.filter(f => f.ms > 200),
          bundle: document.querySelector('script[type=module][src]')?.src };
      })()`) as { adapter: { architecture: string; fallback: boolean }; builds: unknown[]; frames: unknown[]; elapsedMs: number; maxFrameMs: number; framesOver200: unknown[]; playing: boolean };
      const playing = await page.getByTestId('pause-button').isVisible() && !(await page.getByRole('button', { name: 'Retry', exact: true }).isVisible());
      await page.screenshot({ path: `${out}/${level}-${quality}.png` });
      writeFileSync(`${out}/${level}-${quality}.json`, JSON.stringify({ sampledAt: new Date().toISOString(), level, quality, origin, errors, ...result, playing }));
      console.log(JSON.stringify({ level, quality, elapsedMs: result.elapsedMs, frames: result.frames.length, maxFrameMs: result.maxFrameMs, lateBuilds: result.builds.length, playing, errors }));
      assert.equal(result.adapter.architecture, 'metal-3');
      assert.equal(result.adapter.fallback, false);
      assert.deepEqual(errors, []);
      assert.ok(playing, 'the mission must remain playable for the full minute');
      assert.ok(result.elapsedMs >= 60_000 && result.frames.length > 1000);
      assert.deepEqual(result.builds, [], 'no shader modules or render pipelines created after Begin');
      assert.deepEqual(result.framesOver200, [], 'no gameplay frame over 200 ms');
    } finally { await page.context().close(); }
  }
} finally { for (const context of browser.contexts()) await context.close(); await browser.close(); }
