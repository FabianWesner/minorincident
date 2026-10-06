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

type Req = { url: string; kind: string; bytes: number; status: number; cached: boolean; phase: 'boot' | 'level'; start: number; end: number };
export type LoadRun = {
  profile: string; cache: 'cold' | 'warm'; firstPaintMs: number; titleMs: number; playableMs: number; startToPlayableMs: number;
  requests: number; bytes: number; bootBytes: number; levelBytes: number; byKind: Record<string, { requests: number; bytes: number }>;
  levelByKind: Record<string, { requests: number; bytes: number }>;
  longTasks: { count: number; totalMs: number; maxMs: number; over50AfterStart: number; top: { start: number; ms: number }[] };
  measures: { name: string; ms: number }[]; backend: string; errors: string[]; loadAverage: number; playerMoved?: boolean;
  slowest: { url: string; kind: string; bytes: number; ms: number }[];
};

async function throttle(cdp: CDPSession, profile: ProfileName): Promise<void> {
  const p = profiles[profile];
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: p.latency, downloadThroughput: p.down, uploadThroughput: p.up });
}

const init = () => {
  const w = window as unknown as { __lt: { start: number; ms: number }[] };
  w.__lt = [];
  new PerformanceObserver(list => { for (const e of list.getEntries()) w.__lt.push({ start: e.startTime, ms: e.duration }); }).observe({ type: 'longtask', buffered: true });
  addEventListener('click', event => {
    const id = (event.target as HTMLElement | null)?.closest?.('[data-testid]')?.getAttribute('data-testid');
    if (id === 'level-L1') (window as unknown as { __start: number }).__start = performance.now();
  }, true);
};

export async function measureOnce(page: Page, cdp: CDPSession, base: string, profile: ProfileName, cache: 'cold' | 'warm'): Promise<LoadRun> {
  const reqs = new Map<string, Req>(); let phase: Req['phase'] = 'boot'; const errors: string[] = [];
  page.on('pageerror', e => errors.push(`pageerror ${e.message}`)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()} ${m.text().slice(0, 200)}`); });
  cdp.on('Network.requestWillBeSent', e => { reqs.set(e.requestId, { url: e.request.url, kind: kind(e.request.url, ''), bytes: 0, status: 0, cached: false, phase, start: e.timestamp, end: e.timestamp }); });
  cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.cached = e.response.fromDiskCache || e.response.fromServiceWorker || e.response.status === 304; r.kind = kind(e.response.url, e.response.mimeType); } });
  cdp.on('Network.requestServedFromCache', e => { const r = reqs.get(e.requestId); if (r) r.cached = true; });
  cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.end = e.timestamp; } });
  await page.goto(base, { waitUntil: 'commit', timeout: 120_000 });
  await page.waitForSelector('[data-menu-screen=title]:not([hidden])', { timeout: 180_000 });
  const titleMs = await page.evaluate(() => performance.now());
  await page.click('[data-testid=start-game]');
  await page.click('[data-testid=character-female]');
  phase = 'level';
  await page.click('[data-testid=level-L1]');
  await page.waitForFunction(() => document.body.dataset.uiScreen === 'game', undefined, { timeout: 300_000, polling: 16 });
  const result = await page.evaluate(async () => {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const w = window as unknown as { __lt: { start: number; ms: number }[]; __start: number };
    const paint = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint') ?? performance.getEntriesByType('paint')[0];
    return { playable: performance.now(), start: w.__start, firstPaint: paint?.startTime ?? -1, lt: w.__lt, measures: performance.getEntriesByType('measure').map(m => ({ name: m.name, ms: Math.round(m.duration) })) };
  });
  // Let background streaming settle before the next run reuses the context.
  await page.waitForTimeout(1500);
  const settled = [...reqs.values()];
  const sum = (list: Req[]) => { const out: Record<string, { requests: number; bytes: number }> = {}; for (const r of list) { (out[r.kind] ??= { requests: 0, bytes: 0 }); out[r.kind].requests++; out[r.kind].bytes += r.bytes; } return out; };
  const lt = result.lt;
  return {
    profile, cache, firstPaintMs: Math.round(result.firstPaint), titleMs: Math.round(titleMs), playableMs: Math.round(result.playable), startToPlayableMs: Math.round(result.playable - result.start),
    requests: settled.length, bytes: settled.reduce((n, r) => n + r.bytes, 0), bootBytes: settled.filter(r => r.phase === 'boot').reduce((n, r) => n + r.bytes, 0), levelBytes: settled.filter(r => r.phase === 'level').reduce((n, r) => n + r.bytes, 0),
    byKind: sum(settled), levelByKind: sum(settled.filter(r => r.phase === 'level')),
    longTasks: { count: lt.length, totalMs: Math.round(lt.reduce((n, t) => n + t.ms, 0)), maxMs: Math.round(Math.max(0, ...lt.map(t => t.ms))), over50AfterStart: lt.filter(t => t.start > result.playable).length, top: [...lt].sort((a, b) => b.ms - a.ms).slice(0, 8).map(t => ({ start: Math.round(t.start), ms: Math.round(t.ms) })) },
    measures: result.measures, backend: '', errors, loadAverage: loadavg()[0],
    slowest: settled.filter(r => !r.cached).sort((a, b) => b.bytes - a.bytes).slice(0, 12).map(r => ({ url: new URL(r.url).pathname, kind: r.kind, bytes: r.bytes, ms: Math.round((r.end - r.start) * 1000) })),
  };
}

export async function measure(browser: Browser, base: string, profile: ProfileName): Promise<LoadRun[]> {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: !process.env.LOAD_SPKI });
  await context.addInitScript(init);
  const runs: LoadRun[] = [];
  for (const cache of ['cold', 'warm'] as const) {
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
  for (const profile of list.split(',') as ProfileName[]) all.push(...await measure(browser, base, profile));
  await browser.close();
  const json = JSON.stringify({ base, at: new Date().toISOString(), runs: all }, null, 2);
  if (out) writeFileSync(out, json); else console.log(json);
  for (const r of all) console.log(`${r.profile.padEnd(8)} ${r.cache.padEnd(5)} FCP ${r.firstPaintMs} title ${r.titleMs} start->playable ${r.startToPlayableMs} ms | ${r.requests} req ${(r.bytes / 1e6).toFixed(2)} MB (boot ${(r.bootBytes / 1e6).toFixed(2)}, level ${(r.levelBytes / 1e6).toFixed(2)}) | long tasks ${r.longTasks.count} / ${r.longTasks.totalMs} ms, max ${r.longTasks.maxMs} | load ${r.loadAverage.toFixed(1)}\n   ${r.measures.map(m => `${m.name}=${m.ms}`).join(' ')}${r.errors.length ? `\n   errors: ${r.errors.slice(0, 5).join(' | ')}` : ''}`);
}
