import { chromium, webkit } from '@playwright/test';
import { SceneSession, stopServer, readSpec, writeJson } from './session';
import { runSpec } from './run';

if (process.env.MI_PERF_LOCK_HELD !== '1') throw new Error('Use tools/perf/quiet-run.sh');
const out = process.env.BACKEND_OUT ?? 'test-results/render-parallel/backends';
const results = [];
try {
  for (const kind of ['shell', 'chromium', 'webkit'] as const) {
    const browser = await (kind === 'webkit' ? webkit : chromium).launch({ headless: true, ...(kind === 'webkit' ? {} : { args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'], ...(kind === 'chromium' ? { channel: 'chromium' } : {}) }) });
    const session = new SceneSession({ backend: 'webgpu' });
    try {
      const began = Date.now();
      await session.open(browser);
      const capabilities = await session.page.evaluate(async () => {
        const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2'), debug = gl?.getExtension('WEBGL_debug_renderer_info');
        const adapter = await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ info: { vendor: string; architecture: string; device: string; description: string; isFallbackAdapter?: boolean } } | null> } }).gpu?.requestAdapter();
        const info = adapter?.info;
        return { webgl: gl && debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string : null, webgpu: !!adapter, adapter: info && { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description, isFallbackAdapter: info.isFallbackAdapter }, secure: isSecureContext };
      });
      const result = await runSpec(session, readSpec('specs/scenes/courier-turns.json'), { out: `${out}/${kind}`, openMs: Date.now() - began });
      results.push({ kind, capabilities, ...result });
    } catch (error) { results.push({ kind, error: String(error), consoleErrors: session.errors }); }
    finally { await session.close(); await browser.close(); }
    console.log(JSON.stringify(results.at(-1)));
    writeJson(`${out}/summary.json`, results);
  }
} finally { stopServer(); }
