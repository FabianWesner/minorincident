/** Diagnose the original L6 -> L1 -> L6 -> L1 -> L6 retention window.
 * Snapshots perturb the run, so this is auxiliary evidence, never an acceptance substitute.
 * E2E_PORT=4121 L6_HEAP_BACKEND=webgpu L6_HEAP_TIER=low sh tools/perf/quiet-run.sh npx tsx tools/perf/l6-retention-profile.ts
 * Remote Linux WebGL diagnosis uses tools/e2e-lock.sh (SwiftShader, no native timing claim).
 */
import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, writeFileSync, writeSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { attachErrorGuard } from '../../tests/e2e/fixtures';

// e2e-lock.sh delegates directly on Linux (lockf is macOS-only); the remote
// runner owns admission there, and this tool launches exactly one browser.
const remote = process.platform !== 'darwin' && process.env.MI_REMOTE === '1' && process.env.E2E_UNITS === '1';
if (process.env.MI_PERF_LOCK_HELD !== '1' && !remote) throw Error('Use tools/perf/quiet-run.sh (remote Linux diagnostics: E2E_UNITS=1 tools/e2e-lock.sh)');
const port = Number(process.env.E2E_PORT ?? 4121);
if (port === 3300) throw Error('Use a private preview port');
const backend = process.env.L6_HEAP_BACKEND ?? 'webgpu', quality = process.env.L6_HEAP_TIER ?? 'low';
if (!['webgl', 'webgpu'].includes(backend) || !['high', 'low'].includes(quality)) throw Error('Invalid backend or tier');
const out = process.env.L6_HEAP_OUT ?? 'test-results/perf-l4-l6/heap';
mkdirSync(out, { recursive: true });
if (await fetch(`http://127.0.0.1:${port}`).then(() => true, () => false)) throw Error(`Preview port ${port} is already occupied`);
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner',
  ...(process.env.L6_HEAP_DIST ? ['--outDir', process.env.L6_HEAP_DIST] : [])], { stdio: 'ignore' });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let available = false;
  for (let i = 0; i < 120; i++) {
    try { available = (await fetch(`http://127.0.0.1:${port}`)).ok; } catch { /* starting */ }
    if (available) break;
    if (server.exitCode !== null) throw Error('Preview server exited');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!available) throw Error('Preview server did not start');
  browser = await chromium.launch({ headless: true, args: process.platform === 'darwin'
    ? ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: quality === 'low' ? { width: 390, height: 844 } : { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage(), guard = attachErrorGuard(page);
  await page.addInitScript('globalThis.__name = fn => fn');
  await page.goto(`http://127.0.0.1:${port}/?test=1&renderer=${backend}&quality=${quality}&dpr=1&audio=muted`);
  await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  const initialStarted = performance.now();
  await page.evaluate(async quality => {
    const a = window.__SS__!;
    await a.loadLevel('L6', { seed: 29, progression: 'L6-default' }); a.pause();
    a.settings.set({ quality: quality as 'high' | 'low', flashReduction: true, cameraShake: false, gore: 'Off' });
  }, quality);
  const cdp = await context.newCDPSession(page), readings = [];
  for (const level of ['L6', 'L1', 'L6', 'L1', 'L6']) {
    const started: number = readings.length ? performance.now() : initialStarted;
    if (readings.length) await page.evaluate(async level => { const a = window.__SS__!; await a.loadLevel(level); a.pause(); }, level);
    await page.evaluate(async () => { const a = window.__SS__!; a.missions.begin(); a.pause(); for (let i = 0; i < 6; i++) await a.screenshotReady(); });
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const reading = await page.evaluate(() => { const a = window.__SS__!, p = a.perf(); return { backend: p.backend, tier: p.quality.tier, geometries: p.geometries, textures: p.textures, settings: a.campaign.state()!.settings }; });
    if (reading.backend !== backend || reading.tier !== quality) throw Error('Requested backend/tier was not selected');
    readings.push({ level, ...reading, heap, loadAndSettleMs: performance.now() - started });
    writeFileSync(`${out}/${backend}-${quality}.json`, JSON.stringify({ diagnostic: true, readings }, null, 2));
    console.log(JSON.stringify(readings.at(-1)));
    if (readings.length === 1 || readings.length === 5) {
      const fd = openSync(`${out}/${backend}-${quality}-${readings.length}.heapsnapshot`, 'w');
      const chunk = ({ chunk }: { chunk: string }) => writeSync(fd, chunk);
      cdp.on('HeapProfiler.addHeapSnapshotChunk', chunk);
      try { await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false }); }
      finally { cdp.off('HeapProfiler.addHeapSnapshotChunk', chunk); closeSync(fd); }
    }
  }
  guard.dispose();
  if (guard.errors.length) throw Error(guard.errors.join('\n'));
  await cdp.detach(); await context.close();
} finally { await browser?.close(); server.kill(); }
