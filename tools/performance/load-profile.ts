// CPU profile of one L1 load (test API) aggregated by self time per function. Diagnostic tool.
// Usage: LOAD_SPKI=... tsx tools/performance/load-profile.ts https://127.0.0.1:3362/ [top=40]
import { chromium } from '@playwright/test';
import { launchArgs } from './load-measure';
const [base = 'https://127.0.0.1:3362/', top = '40'] = process.argv.slice(2);
const spki = process.env.LOAD_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.LOAD_SPKI}`] : [];
const browser = await chromium.launch({ headless: true, args: [...launchArgs, ...spki] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: !process.env.LOAD_SPKI });
await page.addInitScript(() => {
  const g = window as unknown as { __gpu: Record<string, number>; GPUDevice?: { prototype: Record<string, (...args: unknown[]) => unknown> } };
  g.__gpu = { pipelines: 0, asyncPipelines: 0, modules: 0, moduleChars: 0, syncMs: 0 };
  if (g.GPUDevice) {
    const proto = g.GPUDevice.prototype, rp = proto.createRenderPipeline, rpa = proto.createRenderPipelineAsync, sm = proto.createShaderModule;
    proto.createRenderPipeline = function (this: unknown, ...a: unknown[]) { g.__gpu.pipelines++; const t = performance.now(); const r = rp.apply(this, a); g.__gpu.syncMs += performance.now() - t; return r; };
    proto.createRenderPipelineAsync = function (this: unknown, ...a: unknown[]) { g.__gpu.asyncPipelines++; return rpa.apply(this, a); };
    proto.createShaderModule = function (this: unknown, ...a: unknown[]) { g.__gpu.modules++; g.__gpu.moduleChars += String((a[0] as { code: string }).code).length; return sm.apply(this, a); };
  }
  const w = window as unknown as { __gl: Record<string, number> }; w.__gl = { link: 0, statusMs: 0, linkStatusMs: 0, completionPolls: 0, compileShader: 0 };
  const proto = WebGL2RenderingContext.prototype, get = proto.getProgramParameter, link = proto.linkProgram, compile = proto.compileShader;
  proto.linkProgram = function (p) { w.__gl.link++; return link.call(this, p); };
  proto.compileShader = function (s) { w.__gl.compileShader++; return compile.call(this, s); };
  proto.getProgramParameter = function (p, name) { const t = performance.now(); const r = get.call(this, p, name); const d = performance.now() - t; if (name === 0x91B1) { w.__gl.completionPolls++; w.__gl.statusMs += d; } else w.__gl.linkStatusMs += d; return r; };
});
page.on('pageerror', e => console.error('pageerror', e.message)); page.on('console', m => { if (m.type() === 'error') console.error('console', m.text()); });
await page.goto(`${base}?test=1&audio=muted${process.env.LOAD_QUERY ?? '&renderer=webgl'}`);
await page.waitForFunction(() => Boolean((window as unknown as { __SS__?: unknown }).__SS__), undefined, { timeout: 120_000 });
await page.evaluate(() => (window as unknown as { __SS__: { ready: Promise<void> } }).__SS__.ready);
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
const ms = await page.evaluate(async () => { const a = (window as unknown as { __SS__: { loadLevel(id: string): Promise<void>; screenshotReady(): Promise<void> } }).__SS__; const t = performance.now(); await a.loadLevel('L1'); return performance.now() - t; });
const { profile } = await cdp.send('Profiler.stop');
const self = new Map<string, number>(); const dt = new Map<number, number>();
profile.samples!.forEach((id, i) => dt.set(id, (dt.get(id) ?? 0) + (profile.timeDeltas![i] ?? 0)));
for (const node of profile.nodes) { const f = node.callFrame; const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`; self.set(key, (self.get(key) ?? 0) + (dt.get(node.id) ?? 0) / 1000); }
console.log(`L1 load ${Math.round(ms)} ms`, JSON.stringify(await page.evaluate(() => (window as unknown as { __gl: unknown }).__gl)), JSON.stringify(await page.evaluate(() => (window as unknown as { __gpu: unknown }).__gpu)), JSON.stringify(await page.evaluate(() => performance.getEntriesByType('measure').map(m => `${m.name}=${Math.round(m.duration)}`))));
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, Number(top))) console.log(`${v.toFixed(0).padStart(7)} ms  ${k}`);
await browser.close();
