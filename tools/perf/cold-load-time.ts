/** Real menu click -> closed loading card, with a new Chromium profile for every sample.
 * Run through quiet-run.sh (one browser). Optional LOAD_TRACE=1 captures diagnostic traces/profiles;
 * keep those samples separate from the unprofiled acceptance distributions.
 * Usage: tsx tools/perf/cold-load-time.ts <origin> <webgpu|webgl2> <low|high> [runs=20] [level=L1] [menuWait=0]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loadavg } from 'node:os';

const [origin, backend = 'webgpu', quality = 'low', count = '20', level = 'L1', menuWait = '0'] = process.argv.slice(2);
const out = process.env.LOAD_OUT ?? 'test-results/load-stalls';
const diagnostic = process.env.LOAD_TRACE === '1';
const gameplayMs = Number(process.env.LOAD_GAMEPLAY_MS ?? 0);
mkdirSync(out, { recursive: true });
const results: Record<string, unknown>[] = [];
for (let run = 0; run < Number(count); run++) {
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
      const p = window.__coldLoad = { stages: [], tasks: [], frames: [], contexts: [], start: null, done: null, playing: null };
      const context = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) { const result = context.call(this, type, ...args); if (result && !p.contexts.includes(type)) p.contexts.push(type); return result; };
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
        if (last !== null && p.done !== null && last >= p.done) p.frames.push({ at: last, ms: at - last, playing: p.playing !== null });
        last = at; requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    })();`);
    const query = new URLSearchParams({ quality, audio: 'muted', dpr: '1', ...(level === 'L1' ? {} : { debug: '1' }), ...(backend === 'webgl2' ? { renderer: 'webgl' } : {}) });
    await page.goto(`${origin}/?${query}`);
    await page.getByTestId('start-game').click();
    await page.getByTestId('character-female').click();
    await page.getByTestId(`level-${level}`).waitFor();
    if (Number(menuWait)) await page.waitForTimeout(Number(menuWait));
    const cdp = diagnostic ? await page.context().newCDPSession(page) : null;
    if (cdp) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.start');
      await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,blink.user_timing,gpu,disabled-by-default-gpu.service', transferMode: 'ReturnAsStream' });
    }
    await page.getByTestId(`level-${level}`).click({ force: true });
    await page.waitForFunction('window.__coldLoad.done !== null', undefined, { polling: 50 });
    if (gameplayMs) {
      await page.getByRole('button', { name: 'Begin mission', exact: true }).click();
      await page.keyboard.down('w');
      await page.waitForTimeout(gameplayMs / 2);
      await page.keyboard.up('w');
      await page.keyboard.down('d');
      await page.waitForTimeout(gameplayMs / 2);
      await page.keyboard.up('d');
    }
    const result = await page.evaluate<Record<string, unknown>>(`(() => {
      const p = window.__coldLoad;
      return { ...p, ms: p.done - p.start, maxFrameMs: Math.max(0, ...p.frames.map(f => f.ms)),
        measures: performance.getEntriesByType('measure').map(e => ({ name: e.name, at: e.startTime, ms: e.duration })),
        resources: performance.getEntriesByType('resource').filter(e => e.startTime + e.duration >= p.start).map(e => ({ name: new URL(e.name).pathname, at: e.startTime, ms: e.duration, bytes: e.transferSize })) };
    })()`);
    const record = { origin, backend, quality, level, run, menuWait: Number(menuWait), diagnostic, gameplayMs, load: loadavg(), errors, ...result };
    results.push(record);
    writeFileSync(`${out}/${label}.json`, JSON.stringify(record));
    console.log(JSON.stringify({ ...record, frames: undefined, resources: undefined, tasks: undefined }));
    if (cdp) {
      writeFileSync(`${out}/${label}.cpuprofile.gz`, gzipSync(JSON.stringify((await cdp.send('Profiler.stop')).profile)));
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
const summary = { origin, backend, quality, level, diagnostic, n: sorted.length, median: sorted[Math.floor(sorted.length / 2)], p90: sorted[Math.ceil(sorted.length * .9) - 1], max: sorted.at(-1), maxFrameMs: Math.max(...results.map(result => result.maxFrameMs as number)), errors: results.flatMap(result => result.errors as string[]) };
writeFileSync(`${out}/${level}-${backend}-${quality}-summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
