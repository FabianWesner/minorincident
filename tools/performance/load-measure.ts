// Real-flow load measurement (headless Chromium): first paint, title, Start -> first playable L1 frame,
// bytes/requests by type and phase, long tasks. Throttled through CDP; cold = fresh context,
// warm = second visit in the same context (HTTP cache kept, storage cleared).
// Usage: tsx tools/performance/load-measure.ts <baseUrl> [profiles=desktop,mobile] [out.json]
import { chromium, type Browser, type CDPSession, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';

export const profiles = {
  desktop: { label: 'desktop cable 50 Mbit / 20 ms', down: 50e6 / 8, up: 10e6 / 8, latency: 20 },
  mobile: { label: 'mobile 4G 10 Mbit / 150 ms', down: 10e6 / 8, up: 3e6 / 8, latency: 150 },
  // A phone on 4G: touch + coarse pointer selects the low quality tier (as on a real device).
  phone: { label: 'phone (Pixel 7 emulation, low tier) 4G 10 Mbit / 150 ms', down: 10e6 / 8, up: 3e6 / 8, latency: 150 },
  none: { label: 'unthrottled', down: -1, up: -1, latency: 0 },
} as const;
export type ProfileName = keyof typeof profiles;

const kind = (url: string, mime: string): string => {
  const path = new URL(url).pathname;
  if (path.endsWith('.wasm')) return 'wasm';
  if (/rapier-.*\.js$/.test(path)) return 'js-rapier';
  if (path.endsWith('.js')) return 'js';
  if (path.endsWith('.css') || path.endsWith('.html') || mime.includes('html')) return 'html/css';
  if (path.endsWith('.glb')) return path.includes('/layouts/') ? 'glb-layout' : 'glb-model';
  if (path.endsWith('.json')) return 'json-layout';
  if (/\.(ktx2|png|webp|jpg)$/.test(path)) return 'texture';
  if (/\.(webm|m4a|ogg|mp3)$/.test(path)) return 'audio';
  if (path.startsWith('/cdn-cgi')) return 'cdn';
  return 'other';
};

type Req = { url: string; kind: string; bytes: number; status: number; cached: boolean; phase: 'boot' | 'menu' | 'level' | 'background'; start: number; end: number; wall: number };
export type LoadRun = {
  profile: string; cache: 'cold' | 'warm'; firstPaintMs: number; titleMs: number; playableMs: number; startToPlayableMs: number; startToBeginMs: number; beginToPlayableMs: number; clickToPlayableExcludingReadingMs: number; firstFramesMaxMs: number; firstFramesOver50: number;
  requests: number; bytes: number; bootBytes: number; menuBytes: number; levelBytes: number; criticalBytes: number; uniqueCriticalBytes: number; criticalRequests: number; backgroundBytes: number; byKind: Record<string, { requests: number; bytes: number }>;
  levelByKind: Record<string, { requests: number; bytes: number }>;
  longTasks: { count: number; totalMs: number; maxMs: number; over50AfterStart: number; top: { start: number; ms: number }[] };
  measures: { name: string; ms: number; at: number }[]; backend: string; errors: string[]; loadAverage: number; playerMoved?: boolean;
  slowest: { url: string; kind: string; bytes: number; ms: number }[];
  files: { url: string; bytes: number; phase: string }[];
};

async function throttle(cdp: CDPSession, profile: ProfileName): Promise<void> {
  const p = profiles[profile];
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: p.latency, downloadThroughput: p.down, uploadThroughput: p.up });
}

// Plain JS source (not a serialized TS function: tsx/esbuild may inject helpers such as __name).
const init = `(() => {
  window.__lt = [];
  new PerformanceObserver(list => { for (const e of list.getEntries()) window.__lt.push({ start: e.startTime, ms: e.duration }); }).observe({ type: 'longtask', buffered: true });
  // In-page phase marks (Playwright polling lags a busy main thread): title shown, first playable frame.
  // The boot scenario also passes through the 'game' screen before the title: only after Start counts.
  const watch = () => {
    if (window.__title === undefined && document.querySelector('[data-menu-screen=title]:not([hidden])')) window.__title = performance.now();
    const begin = [...document.querySelectorAll('button')].find(b => b.textContent === 'Begin mission' && b.offsetParent !== null);
    if (window.__begin === undefined && window.__start !== undefined && begin) window.__begin = performance.now();
    const pause = document.querySelector('[data-testid=pause-button]');
    if (window.__playable === undefined && window.__beginClick !== undefined && pause && !pause.hidden && document.querySelector('canvas') && document.querySelector('canvas').style.visibility !== 'hidden') requestAnimationFrame(() => requestAnimationFrame(() => { if (window.__playable === undefined) { window.__playable = performance.now(); window.__frames = []; let last = performance.now(); const rec = () => { const now = performance.now(); window.__frames.push(now - last); last = now; if (window.__frames.length < 180) requestAnimationFrame(rec); }; requestAnimationFrame(rec); } }));
    if (window.__playable === undefined) requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
  addEventListener('click', event => {
    const target = event.target && event.target.closest ? event.target.closest('[data-testid]') : null;
    if (target && target.getAttribute('data-testid') === 'level-L1') window.__start = performance.now();
    if (event.target && event.target.textContent === 'Begin mission') window.__beginClick = performance.now();
  }, true);
})();`;

export async function measureOnce(page: Page, cdp: CDPSession, base: string, profile: ProfileName, cache: 'cold' | 'warm'): Promise<LoadRun> {
  const reqs = new Map<string, Req>(); let phase: Req['phase'] = 'boot'; const errors: string[] = [];
  page.on('pageerror', e => errors.push(`pageerror ${e.message}`)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()} ${m.text().slice(0, 200)}`); });
  cdp.on('Network.requestWillBeSent', e => { reqs.set(e.requestId, { url: e.request.url, kind: kind(e.request.url, ''), bytes: 0, status: 0, cached: false, phase, start: e.timestamp, end: e.timestamp, wall: e.wallTime * 1000 }); });
  cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.cached = e.response.fromDiskCache || e.response.fromServiceWorker || e.response.status === 304; r.kind = kind(e.response.url, e.response.mimeType); } });
  cdp.on('Network.requestServedFromCache', e => { const r = reqs.get(e.requestId); if (r) r.cached = true; });
  cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.end = e.timestamp; } });
  await page.goto(base, { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForSelector('[data-menu-screen=title]:not([hidden])', { timeout: 180_000 });
  await page.waitForFunction(() => (window as unknown as { __title?: number }).__title !== undefined);
  const titleMs = await page.evaluate(() => (window as unknown as { __title: number }).__title);
  phase = 'menu'; // requests from here to the L1 click: deferred boot audio and the level prefetch
  await page.click('[data-testid=start-game]');
  await page.click('[data-testid=character-female]');
  // Optional menu "reading time" between the title and choosing L1 (default 0: click immediately).
  const menuMs = Number(process.env.LOAD_MENU_MS ?? 0); if (menuMs) await page.waitForTimeout(menuMs);
  phase = 'level';
  await page.click('[data-testid=level-L1]');
  await page.waitForFunction(() => (window as unknown as { __begin?: number }).__begin !== undefined, undefined, { timeout: 300_000, polling: 16 });
  // Optional briefing reading time before pressing Begin (default 0: press immediately).
  const briefingMs = Number(process.env.LOAD_BRIEFING_MS ?? 0); if (briefingMs) await page.waitForTimeout(briefingMs);
  await page.getByRole('button', { name: 'Begin mission' }).click();
  phase = 'background';
  const result = await page.evaluate(async () => {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const w = window as unknown as { __lt: { start: number; ms: number }[]; __start: number; __title?: number; __playable?: number; __begin: number; __beginClick: number; __frames: number[] };
    while (w.__playable === undefined) await new Promise(r => requestAnimationFrame(r));
    while (w.__frames.length < 180) await new Promise(r => requestAnimationFrame(r));
    const paint = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint') ?? performance.getEntriesByType('paint')[0];
    return { begin: w.__begin, beginClick: w.__beginClick, frames: w.__frames, origin: performance.timeOrigin, title: w.__title ?? 0, playable: w.__playable, start: w.__start, firstPaint: paint?.startTime ?? -1, lt: w.__lt, measures: performance.getEntriesByType('measure').map(m => ({ name: m.name, ms: Math.round(m.duration), at: Math.round(m.startTime - w.__start) })) };
  });
  // Let background streaming settle before the next run reuses the context.
  await page.waitForTimeout(Number(process.env.LOAD_SETTLE_MS ?? 1500));
  const settled = [...reqs.values()];
  const wall = (ms: number) => result.origin + ms;
  for (const r of settled) r.phase = r.wall < wall(result.title) ? 'boot' : r.wall < wall(result.start) ? 'menu' : r.wall <= wall(result.playable) ? 'level' : 'background';
  const sum = (list: Req[]) => { const out: Record<string, { requests: number; bytes: number }> = {}; for (const r of list) { (out[r.kind] ??= { requests: 0, bytes: 0 }); out[r.kind].requests++; out[r.kind].bytes += r.bytes; } return out; };
  const lt = result.lt;
  return {
    profile, cache, firstPaintMs: Math.round(result.firstPaint), titleMs: Math.round(titleMs), playableMs: Math.round(result.playable), startToPlayableMs: Math.round(result.playable - result.start), startToBeginMs: Math.round(result.begin - result.start), beginToPlayableMs: Math.round(result.playable - result.beginClick), clickToPlayableExcludingReadingMs: Math.round(result.playable - result.start - (result.beginClick - result.begin)), firstFramesMaxMs: Math.round(Math.max(...result.frames)), firstFramesOver50: result.frames.filter(f => f > 50).length,
    requests: settled.length, bytes: settled.reduce((n, r) => n + r.bytes, 0), bootBytes: settled.filter(r => r.phase === 'boot').reduce((n, r) => n + r.bytes, 0), menuBytes: settled.filter(r => r.phase === 'menu').reduce((n, r) => n + r.bytes, 0), levelBytes: settled.filter(r => r.phase === 'level').reduce((n, r) => n + r.bytes, 0), criticalBytes: settled.filter(r => r.phase !== 'background').reduce((n, r) => n + r.bytes, 0), uniqueCriticalBytes: [...settled.filter(r => r.phase !== 'background').reduce((map, r) => map.set(r.url, Math.max(map.get(r.url) ?? 0, r.bytes)), new Map<string, number>()).values()].reduce((n, b) => n + b, 0), criticalRequests: settled.filter(r => r.phase !== 'background').length, backgroundBytes: settled.filter(r => r.phase === 'background').reduce((n, r) => n + r.bytes, 0),
    byKind: sum(settled), levelByKind: sum(settled.filter(r => r.phase === 'level')),
    longTasks: { count: lt.length, totalMs: Math.round(lt.reduce((n, t) => n + t.ms, 0)), maxMs: Math.round(Math.max(0, ...lt.map(t => t.ms))), over50AfterStart: lt.filter(t => t.start > result.playable).length, top: [...lt].sort((a, b) => b.ms - a.ms).slice(0, 8).map(t => ({ start: Math.round(t.start), ms: Math.round(t.ms) })) },
    measures: result.measures, backend: '', errors, loadAverage: loadavg()[0],
    files: settled.map(r => ({ url: new URL(r.url).pathname, bytes: r.bytes, phase: r.phase })),
    slowest: settled.filter(r => !r.cached).sort((a, b) => b.bytes - a.bytes).slice(0, 12).map(r => ({ url: new URL(r.url).pathname, kind: r.kind, bytes: r.bytes, ms: Math.round((r.end - r.start) * 1000) })),
  };
}

export async function measure(browser: Browser, base: string, profile: ProfileName, caches: ('cold' | 'warm')[] = ['cold', 'warm']): Promise<LoadRun[]> {
  const device = profile === 'phone' ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1600, height: 900 } };
  const context = await browser.newContext({ ...device, ignoreHTTPSErrors: !process.env.LOAD_SPKI });
  await context.addInitScript({ content: init });
  const runs: LoadRun[] = [];
  for (const cache of caches) {
    // Optional: drop the macOS Metal shader cache of headless Chromium so "cold" includes cold GPU compiles.
    if (cache === 'cold' && process.env.LOAD_COLD_GPU === '1') { const { execSync } = await import('node:child_process'); execSync('rm -rf "$(getconf DARWIN_USER_CACHE_DIR)/org.chromium.Chromium.helper/com.apple.metal/"*'); }
    const page = await context.newPage(); const cdp = await context.newCDPSession(page);
    await throttle(cdp, profile);
    if (cache === 'warm') await page.goto(base + (base.includes('?') ? '&' : '?') + 'blank=1', { waitUntil: 'commit' }).then(() => page.evaluate(() => localStorage.clear()));
    runs.push(await measureOnce(page, cdp, base, profile, cache));
    await page.close();
  }
  await context.close();
  return runs;
}

export const launchArgs = process.platform === 'darwin'
  ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

if (process.argv[1]?.endsWith('load-measure.ts')) {
  const [base = 'https://127.0.0.1:3362/', list = 'desktop,mobile', out] = process.argv.slice(2);
  // A trusted (SPKI-pinned) local cert keeps Chromium's HTTP cache enabled; ignoreHTTPSErrors disables caching.
  const spki = process.env.LOAD_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.LOAD_SPKI}`] : [];
  const browser = await chromium.launch({ headless: true, args: [...launchArgs, ...spki] });
  const all: LoadRun[] = [];
  for (const profile of list.split(',') as ProfileName[]) all.push(...await measure(browser, base, profile, (process.env.LOAD_CACHES ?? 'cold,warm').split(',') as ('cold' | 'warm')[]));
  await browser.close();
  const json = JSON.stringify({ base, at: new Date().toISOString(), runs: all }, null, 2);
  if (out) writeFileSync(out, json); else console.log(json);
  for (const r of all) console.log(`${r.profile.padEnd(8)} ${r.cache.padEnd(5)} FCP ${r.firstPaintMs} title ${r.titleMs} L1->Begin ${r.startToBeginMs} Begin->playable ${r.beginToPlayableMs} total ${r.startToPlayableMs} ms (excl. briefing reading ${r.clickToPlayableExcludingReadingMs}), first 3 s frames max ${r.firstFramesMaxMs} (>50: ${r.firstFramesOver50}) | ${r.requests} req ${(r.bytes / 1e6).toFixed(2)} MB (boot ${(r.bootBytes / 1e6).toFixed(2)}, menu ${(r.menuBytes / 1e6).toFixed(2)}, level ${(r.levelBytes / 1e6).toFixed(2)}, critical ${(r.criticalBytes / 1e6).toFixed(2)} in ${r.criticalRequests} req, background ${(r.backgroundBytes / 1e6).toFixed(2)}) | long tasks ${r.longTasks.count} / ${r.longTasks.totalMs} ms, max ${r.longTasks.maxMs} | load ${r.loadAverage.toFixed(1)}\n   ${r.measures.filter(m => m.at >= 0).map(m => `${m.name}=${m.ms}@${m.at}`).join(' ')}${r.errors.length ? `\n   errors: ${r.errors.slice(0, 5).join(' | ')}` : ''}`);
}
