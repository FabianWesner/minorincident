/** Real menu click -> closed loading card, with a new Chromium profile for every sample.
 * Run through quiet-run.sh (one browser). Optional LOAD_TRACE=1 captures diagnostic traces/profiles;
 * keep those samples separate from the unprofiled acceptance distributions.
 * Usage: tsx tools/perf/cold-load-time.ts <origin> <webgpu|webgl2> <low|high> [runs=20] [level=L1] [menuWait=0]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { loadavg } from 'node:os';
import { preset } from '../../src/sim/progression/Campaign';
import { SAVE_KEY, validateSave } from '../../src/sim/progression/Save';

const [origin, backend = 'webgpu', quality = 'low', count = '20', level = 'L1', menuWait = '0'] = process.argv.slice(2);
const out = process.env.LOAD_OUT ?? 'test-results/load-stalls';
const diagnostic = process.env.LOAD_TRACE === '1';
const gameplayMs = Number(process.env.LOAD_GAMEPLAY_MS ?? 0);
const lastGameplayOnly = process.env.LOAD_GAMEPLAY_LAST === '1';
const waits = menuWait.split(',').map(Number);
assert.ok(waits.every(wait => Number.isFinite(wait) && wait >= 0), 'menu waits must be nonnegative milliseconds');
mkdirSync(out, { recursive: true });
const results: Record<string, unknown>[] = [];
for (let run = 0; run < Number(count); run++) {
  const wait = waits[run % waits.length];
  const sampleGameplayMs = !lastGameplayOnly || run === Number(count) - 1 ? gameplayMs : 0;
  const label = `${level}-${backend}-${quality}-${run}`;
  const browser = await chromium.launch({ headless: true, args: [
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist',
    ...(backend === 'webgpu' ? ['--enable-unsafe-webgpu'] : []),
  ] });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.setDefaultTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(`(() => {
      window.__name = fn => fn;
      const p = window.__coldLoad = { stages: [], tasks: [], frames: [], contexts: [], adapter: null, glRenderer: null, start: null, done: null, playing: null };
      if (navigator.gpu) {
        const request = navigator.gpu.requestAdapter;
        navigator.gpu.requestAdapter = function(...args) { return request.apply(this, args).then(adapter => {
          if (adapter) { const info = adapter.info; p.adapter = { vendor: info?.vendor, architecture: info?.architecture, description: info?.description, fallback: adapter.isFallbackAdapter ?? info?.isFallbackAdapter }; }
          return adapter;
        }); };
      }
      const context = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        const result = context.call(this, type, ...args);
        if (result && !p.contexts.includes(type)) p.contexts.push(type);
        if (result && type === 'webgl2') { const extension = result.getExtension('WEBGL_debug_renderer_info'); if (extension) p.glRenderer = result.getParameter(extension.UNMASKED_RENDERER_WEBGL); }
        return result;
      };
      new PerformanceObserver(list => { for (const e of list.getEntries()) p.tasks.push({ at: e.startTime, ms: e.duration }); }).observe({ type: 'longtask', buffered: true });
      document.addEventListener('click', e => {
        if (e.target.closest('[data-testid="level-${level}"]')) p.start = performance.now();
        if (e.target.textContent === 'Begin mission') p.playing = performance.now();
      }, true);
      let shown = false, previous = '', last = null;
      const watch = () => {
        const card = document.querySelector('[data-testid=level-transition]');
        if (p.start !== null && card) {
          if (!card.hidden) {
            shown = true;
            const status = document.querySelector('[data-testid=transition-status]')?.textContent;
            const progress = document.querySelector('[data-testid=transition-progress]')?.value;
            const key = status + ':' + progress;
            if (key !== previous) { p.stages.push({ at: performance.now(), status, progress }); previous = key; }
          } else if (shown && p.done === null) p.done = performance.now();
        }
      };
      new MutationObserver(watch).observe(document, { subtree: true, attributes: true, childList: true, characterData: true });
      const frame = at => {
        if (last !== null && p.done !== null && at >= p.done) p.frames.push({ at: Math.max(last, p.done), ms: at - Math.max(last, p.done), playing: p.playing !== null });
        last = at; requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    })();`);
    if (diagnostic) await page.addInitScript(`(() => {
      const wrap = (type, names) => {
        if (!type) return;
        for (const name of names) {
          const original = type.prototype[name];
          if (!original) continue;
          type.prototype[name] = function(...args) {
            const start = performance.now(), result = original.apply(this, args);
            const mark = () => { if (performance.now() - start > 10) performance.measure(type.name + '.' + name, { start, end: performance.now() }); };
            if (result instanceof Promise) result.then(mark, mark); else mark();
            return result;
          };
        }
      };
      wrap(window.GPUDevice, ['createRenderPipeline', 'createRenderPipelineAsync', 'createShaderModule', 'createBuffer', 'createCommandEncoder']);
      wrap(window.GPUQueue, ['writeTexture', 'writeBuffer', 'submit', 'onSubmittedWorkDone']);
      wrap(window.WebGL2RenderingContext, ['getProgramParameter', 'texImage2D', 'texSubImage2D', 'clientWaitSync', 'linkProgram']);
    })();`);
    // Later levels use an unlocked campaign, with empty HTTP/GPU caches. This avoids
    // an unrelated speculative L1 load in front of the selected level.
    if (level !== 'L1') {
      const save = preset(`${level}-default` as Parameters<typeof preset>[0]);
      save.settings.quality = quality as 'low' | 'high';
      if (!validateSave(save)) throw Error(`Invalid ${level} measurement campaign`);
      await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: JSON.stringify(save) });
    }
    const query = new URLSearchParams({ quality, audio: 'muted', dpr: '1', ...(backend === 'webgl2' ? { renderer: 'webgl' } : {}) });
    await page.goto(`${origin}/?${query}`);
    await page.getByTestId('start-game').click();
    if (level === 'L1') await page.getByTestId('character-female').click();
    await page.getByTestId(`level-${level}`).waitFor();
    if (wait) await page.waitForTimeout(wait);
    const cdp = diagnostic ? await page.context().newCDPSession(page) : null;
    let performanceStartedAt = 0;
    if (cdp) {
      await cdp.send('Profiler.enable');
      performanceStartedAt = await page.evaluate(() => performance.now());
      await cdp.send('Profiler.start');
      const { categories } = await cdp.send('Tracing.getCategories');
      writeFileSync(`${out}/trace-categories.json`, JSON.stringify(categories));
      await cdp.send('Tracing.start', { categories: ['devtools.timeline', 'v8', 'blink.user_timing', ...categories.filter(name => /gpu|dawn/i.test(name))].join(','), transferMode: 'ReturnAsStream' });
    }
    await page.getByTestId(`level-${level}`).click({ force: true });
    await page.waitForFunction('window.__coldLoad.done !== null', undefined, { polling: 50 });
    if (sampleGameplayMs) {
      const begin = page.getByRole('button', { name: 'Begin mission', exact: true });
      if (await begin.isVisible()) await begin.click();
      await page.getByTestId('pause-button').waitFor();
      await page.keyboard.down('w');
      await page.waitForTimeout(sampleGameplayMs / 2);
      await page.keyboard.up('w');
      await page.keyboard.down('d');
      await page.waitForTimeout(sampleGameplayMs / 2);
      await page.keyboard.up('d');
    }
    // Include the first presented frames even for the load-only observations.
    await page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
    const result = await page.evaluate<Record<string, unknown>>(`(() => {
      const p = window.__coldLoad;
      return { ...p, bundle: document.querySelector('script[type=module][src]')?.src, ms: p.done - p.start, maxFrameMs: Math.max(0, ...p.frames.map(f => f.ms)),
        measures: performance.getEntriesByType('measure').map(e => ({ name: e.name, at: e.startTime, ms: e.duration })),
        resources: performance.getEntriesByType('resource').filter(e => e.startTime + e.duration >= p.start).map(e => ({ name: new URL(e.name).pathname, at: e.startTime, ms: e.duration, bytes: e.transferSize })) };
    })()`);
    const record = { sampledAt: new Date().toISOString(), origin, backend, quality, level, run, menuWait: wait, diagnostic, gameplayMs: sampleGameplayMs, load: loadavg(), errors, ...result };
    results.push(record);
    writeFileSync(`${out}/${label}.json`, JSON.stringify(record));
    console.log(JSON.stringify({ ...record, frames: undefined, resources: undefined, tasks: undefined }));
    if (cdp) {
      writeFileSync(`${out}/${label}.cpuprofile.gz`, gzipSync(JSON.stringify({ ...(await cdp.send('Profiler.stop')).profile, performanceStartedAt })));
      const complete = new Promise<string>(resolve => cdp.once('Tracing.tracingComplete', event => resolve(event.stream!)));
      await cdp.send('Tracing.end');
      const handle = await complete;
      let trace = '';
      for (;;) {
        const chunk = await cdp.send('IO.read', { handle });
        trace += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString() : chunk.data;
        if (chunk.eof) break;
      }
      await cdp.send('IO.close', { handle });
      writeFileSync(`${out}/${label}.trace.json.gz`, gzipSync(trace));
    }
  } finally { await browser.close(); }
}
const sorted = results.map(result => result.ms as number).sort((a, b) => a - b);
const gameplaySamples = results.filter(result => Number(result.gameplayMs) >= 10_000);
const summary = { origin, backend, quality, level, diagnostic, gameplaySamples: gameplaySamples.length, menuWaits: waits, n: sorted.length, median: (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2, p90: sorted[Math.ceil(sorted.length * .9) - 1], max: sorted.at(-1), maxFrameMs: Math.max(...results.map(result => result.maxFrameMs as number)), errors: results.flatMap(result => result.errors as string[]) };
writeFileSync(`${out}/${level}-${backend}-${quality}-summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
if (process.env.LOAD_ASSERT === '1') {
  assert.equal(diagnostic, false, 'profiled samples are diagnostic only');
  assert.ok(summary.n >= 20, 'at least 20 cold profiles per configuration');
  assert.ok(summary.max! <= 6000, `worst cold load: ${summary.max} ms`);
  assert.deepEqual(summary.errors, []);
  assert.ok(results.every(result => {
    const contexts = result.contexts as string[];
    return backend === 'webgpu' ? contexts.includes('webgpu') && !contexts.includes('webgl2') : contexts.includes('webgl2');
  }), 'requested rendering backend must be active');
  assert.ok(results.every(result => {
    const adapter = result.adapter as { fallback?: boolean; description?: string } | null;
    return backend === 'webgpu' ? adapter && adapter.fallback !== true && !/swiftshader|llvmpipe/i.test(adapter.description ?? '') : typeof result.glRenderer === 'string' && !/swiftshader|llvmpipe/i.test(result.glRenderer);
  }), 'native hardware rendering is required');
  assert.ok(gameplayMs >= 10_000, 'record at least ten seconds of real gameplay movement');
  assert.ok(results.every(result => (result.frames as unknown[]).length >= 2), 'first post-card frames must be present in every cold observation');
  assert.ok(gameplaySamples.length > 0 && gameplaySamples.every(result => (result.frames as unknown[]).length >= 100), 'record real gameplay frames for every configuration');
  assert.ok(summary.maxFrameMs <= 200, `post-card frame: ${summary.maxFrameMs} ms`);
  assert.ok(process.env.LOAD_BASELINE, 'LOAD_BASELINE must name the baseline evidence directory');
  const before = JSON.parse(readFileSync(`${process.env.LOAD_BASELINE}/${level}-${backend}-${quality}-summary.json`, 'utf8'));
  assert.ok(before.n >= 20 && !before.diagnostic, 'baseline needs at least 20 unprofiled cold loads');
  assert.deepEqual(summary.menuWaits, before.menuWaits, 'use the same menu wait schedule before and after');
  assert.ok(summary.median <= before.median, `median ${summary.median} ms > baseline ${before.median} ms`);
  writeFileSync(`${out}/${level}-${backend}-${quality}-summary.json`, JSON.stringify({ ...summary, gate: 'PASS', baselineMedian: before.median }, null, 2));
  console.log(JSON.stringify({ level, backend, quality, gate: 'PASS' }));
}
