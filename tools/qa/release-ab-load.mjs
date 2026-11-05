/** Native menu loads. Timings require quiet-run; RELEASE_BYTES_ONLY=1 records
 * one isolated-context resource ledger and view:warm-up proxy under shared admission. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { launchBrowser } from '../browser-pool/client.ts';
import { newCampaign, preset } from '../../src/sim/progression/Campaign.ts';
import { SAVE_KEY } from '../../src/sim/progression/Save.ts';

const levels = (process.argv[2] ?? 'L1,L2,L3,L4,L5,L6,L7,L8,L9,L10').split(',');
const backend = process.argv[3] ?? 'webgpu';
if (!['webgpu', 'webgl2'].includes(backend)) throw new Error('Backend must be webgpu or webgl2');
const tier = process.env.RELEASE_QUALITY === 'high' ? 'high' : 'low';
const diagnostic = process.env.RELEASE_CPU_PROFILE === '1';
const bytesOnly = process.env.RELEASE_BYTES_ONLY === '1';
if (bytesOnly && diagnostic) throw new Error('Byte-only collection cannot profile timings');
const out = resolve(process.env.RELEASE_OUT ?? 'test-results/release-ab-1101', 'loads'); mkdirSync(out, { recursive: true });
const rows = [], browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const sources = [['prod', 'http://127.0.0.1:4902'], ['candidate', process.env.RELEASE_CANDIDATE_ORIGIN ?? 'http://127.0.0.1:4901']].filter(([side]) => !process.env.RELEASE_SIDES || process.env.RELEASE_SIDES.split(',').includes(side));
if (!sources.length) throw new Error('RELEASE_SIDES must include prod or candidate');
try {
  for (const level of levels) for (const [side, origin] of sources) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const completedRequests = [];
    const startedRequests = [];
    context.on('requestfinished', request => completedRequests.push(request));
    if (bytesOnly) context.on('request', request => startedRequests.push(request));
    const page = await context.newPage(); page.setDefaultTimeout(120000);
    const errors = []; page.on('pageerror', e => { errors.push(e.message); if (bytesOnly) console.error(`${level}: ${e.message}`); });
    const save = level === 'L1' ? newCampaign() : preset(`${level}-default`); save.settings.quality = tier;
    await page.addInitScript(({ save, key, backend }) => {
      window.__name = f => f; localStorage.setItem(key, JSON.stringify(save));
      performance.setResourceTimingBufferSize(10000);
      if (backend === 'webgl2') Object.defineProperty(navigator, 'gpu', { value: undefined });
      const p = window.__releaseLoad = { start: null, shown: null, done: null, stages: [], frames: [], contexts: [], adapter: null, glRenderer: null };
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (name, ...args) { const context = get.call(this, name, ...args); if (context) p.contexts.push(name); if (name === 'webgl2' && context) { const extension = context.getExtension('WEBGL_debug_renderer_info'); if (extension) p.glRenderer = context.getParameter(extension.UNMASKED_RENDERER_WEBGL); } return context; };
      if (navigator.gpu) { const request = navigator.gpu.requestAdapter.bind(navigator.gpu); navigator.gpu.requestAdapter = async (...args) => { const a = await request(...args); p.adapter = a ? { vendor: a.info?.vendor, architecture: a.info?.architecture, description: a.info?.description, fallback: a.isFallbackAdapter ?? a.info?.isFallbackAdapter } : null; return a; }; }
      document.addEventListener('click', e => { if (e.target.closest?.('[data-testid^="level-L"]')) p.start = performance.now(); }, true);
      let last = null;
      const watch = () => { const card = document.querySelector('[data-testid=level-transition]'); if (!card || p.start === null) return;
        if (!card.hidden) { p.shown ??= performance.now(); const text = card.textContent; if (text !== p.stages.at(-1)?.text) p.stages.push({ at: performance.now() - p.start, text }); }
        else if (p.shown !== null) p.done ??= performance.now();
      };
      new MutationObserver(watch).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      const frame = at => { if (last !== null && p.done !== null) p.frames.push(at - Math.max(last, p.done)); last = at; requestAnimationFrame(frame); }; requestAnimationFrame(frame);
    }, { save, key: SAVE_KEY, backend });
    try {
      for (const temperature of bytesOnly ? ['isolated-context-bytes'] : ['cold', 'warm']) {
        completedRequests.length = 0;
        startedRequests.length = 0;
        await page.goto(`${origin}/?quality=${tier}&audio=muted&dpr=1${backend === 'webgl2' ? '&renderer=webgl' : ''}`);
        await page.getByTestId('title-settings').click(); await page.getByTestId('setting-quality').selectOption(tier); await page.getByTestId('settings-back').click();
        await page.getByTestId('start-game').click();
        if (await page.getByTestId('character-female').isVisible()) await page.getByTestId('character-female').click();
        let cdp, performanceStartedAt;
        if (diagnostic) {
          cdp = await context.newCDPSession(page); await cdp.send('Profiler.enable');
          performanceStartedAt = await page.evaluate(() => performance.now()); await cdp.send('Profiler.start');
        }
        await page.getByTestId(`level-${level}`).click({ force: true });
        await page.waitForFunction(() => window.__releaseLoad.done !== null, null, { polling: 25 });
        await page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise(resolve => requestAnimationFrame(resolve)); });
        // Freeze both frontiers now. Byte-only proof also includes unfinished
        // requests already started, so delaying their completion cannot hide bytes.
        const completedAtReady = [...completedRequests], startedAtReady = [...startedRequests];
        if (cdp) {
          const { profile } = await cdp.send('Profiler.stop');
          writeFileSync(resolve(out, `${level}-${side}-${temperature}.cpuprofile.gz`), gzipSync(JSON.stringify({ ...profile, performanceStartedAt })));
          await cdp.detach();
        }
        const result = await page.evaluate(() => ({ ...window.__releaseLoad, ms: window.__releaseLoad.done - window.__releaseLoad.start, loadMeasures: performance.getEntriesByType('measure').map(m => ({ name: m.name, startTime: m.startTime, duration: m.duration })), quality: JSON.parse(localStorage.getItem('minor-incident.ui.v1') ?? '{}').quality, bundle: document.querySelector('script[type=module][src]')?.src, begin: [...document.querySelectorAll('button')].some(b => !b.hidden && b.textContent === 'Begin mission') }));
        if (bytesOnly) {
          for (const key of ['ms', 'start', 'shown', 'done', 'stages', 'frames']) delete result[key];
          result.loadMeasures = result.loadMeasures.filter(measure => measure.name === 'view:warm-up');
        }
        // Read after the timed window; retain the delivered resource inventory
        // for per-level byte accounting without instrumenting asset loading.
        const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(r => ({ name: r.name, initiatorType: r.initiatorType, startTime: r.startTime, responseEnd: r.responseEnd, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize, decodedBodySize: r.decodedBodySize })));
        const receipt = async request => {
          const response = await request.response();
          if (bytesOnly) await response?.finished();
          return { url: request.url(), type: request.resourceType(), status: response?.status(), sizes: await request.sizes() };
        };
        const network = await Promise.all(completedAtReady.map(receipt));
        const startedNetwork = bytesOnly ? await Promise.all(startedAtReady.map(receipt)) : undefined;
        const row = { side, level, tier, backend, diagnostic, temperature, measuredAt: new Date().toISOString(), errors: [...errors], ...result, resources, network, ...(bytesOnly ? { startedNetwork } : {}) };
        rows.push(row); writeFileSync(resolve(out, `${levels.join('-')}.json`), JSON.stringify(rows, null, 2));
        const assetBytes = requests => requests.filter(r => new URL(r.url).pathname.startsWith('/assets/')).reduce((n, r) => n + r.sizes.responseBodySize, 0);
        console.log(JSON.stringify({ side, level, temperature, ...(bytesOnly ? { assetBytes: assetBytes(network), startedAssetBytes: assetBytes(startedNetwork), warmUpProxy: result.loadMeasures } : { ms: result.ms }), backend: result.contexts.includes('webgpu') ? 'webgpu' : result.contexts, errors }));
      }
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
