import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from '../browser-pool/client';
import type { LightingSpikeResult } from '../../src/debug/lightingSpike';
const port = Number(process.env.E25_SPIKE_PORT ?? 4336), out = process.env.E25_SPIKE_OUT ?? 'test-results/epics/E25/rest/spike';
if (port === 3300) throw Error('Do not use the shared developer port');
mkdirSync(out, { recursive: true });
const server: ChildProcess = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'inherit' });
let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;
try {
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(Error('Vite startup timeout')), 30_000); const poll = async () => { try { const r = await fetch(`http://127.0.0.1:${port}/tools/qa/e25-lighting-spike.html`); if (r.ok) { clearTimeout(timer); resolve(); return; } } catch {} setTimeout(poll, 250); }; void poll(); });
  browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const results: (LightingSpikeResult & { errors: string[] })[] = [];
  for (const lights of [16, 256]) for (const mode of ['field', 'dynamic', 'clustered']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${port}/tools/qa/e25-lighting-spike.html?mode=${mode}&lights=${lights}`);
    await page.waitForFunction(() => !!window.__LIGHT_SPIKE__);
    const result = await page.evaluate(async () => window.__LIGHT_SPIKE__!.measure());
    if (result.backend !== 'WebGPUBackend' || !result.timestampQuery || errors.length) throw Error(JSON.stringify({ backend: result.backend, errors }));
    await page.screenshot({ path: `${out}/${mode}-${lights}.png` });
    results.push({ ...result, errors }); await page.close();
  }
  writeFileSync(`${out}/measurements.json`, JSON.stringify({ at: new Date().toISOString(), viewport: [1280, 720], backendExpected: 'WebGPUBackend', results }, null, 2) + '\n');
  console.log(`${out}/measurements.json`);
} finally { await browser?.close(); server.kill(); }
