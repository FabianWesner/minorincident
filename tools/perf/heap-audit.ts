/** Retainer/pixel evidence for heap-budgets. Run via quiet-run.sh -> e2e-lock.sh.
 * E2E_PORT=3931 HEAP_AUDIT_OUT=... HEAP_AUDIT_SNAPSHOT=1 npx tsx tools/perf/heap-audit.ts
 * Uses one headless browser, serial contexts, production build, fixed sim ticks.
 */
import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, writeFileSync, writeSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import type { Game } from '../../src/Game';
import { attachErrorGuard } from '../../tests/e2e/fixtures';

if (process.env.MI_PERF_LOCK_HELD !== '1') throw Error('Use tools/perf/quiet-run.sh');
const port = Number(process.env.E2E_PORT ?? 3931);
if (port === 3300) throw Error('Use a private preview port');
const out = process.env.HEAP_AUDIT_OUT ?? 'test-results/heap-audit';
mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner',
  ...(process.env.HEAP_AUDIT_DIST ? ['--outDir', process.env.HEAP_AUDIT_DIST] : [])], { stdio: 'ignore' });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const rows: unknown[] = [];
try {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 250));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  for (const backend of (process.env.HEAP_AUDIT_GL_ONLY === '1' ? ['webgl'] : ['webgl', 'webgpu'])) for (const quality of ['high', 'low'] as const) {
    const context = await browser.newContext({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), guard = attachErrorGuard(page), errors = guard.errors;
    await page.goto(`http://127.0.0.1:${port}/?test=1&scenelab&renderer=${backend}&quality=${quality}&audio=muted&dpr=1`);
    await page.waitForFunction(() => !!window.__SCENE__);
    await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    const cdp = await context.newCDPSession(page);
    const scenarios = ['light-lab', 'storm-street', 'L7', 'rocket', 'corgi-contact'];
    const selected = process.env.HEAP_AUDIT_SCENARIOS?.split(',') ?? scenarios;
    if (selected.some(s => !scenarios.includes(s))) throw Error('Unknown heap audit scenario');
    for (const scenario of (process.env.HEAP_AUDIT_LIFECYCLE === '1' ? [] : selected)) {
      console.log(`${backend} ${quality} ${scenario}`);
      await page.evaluate(async ({ scenario, quality }) => {
        const a = window.__SS__!;
        if (scenario === 'light-lab') {
          await window.__SCENE__!.load({ name: 'light-lab', ground: 'asphalt', time: 'night', size: 50, dof: false,
            props: [{ asset: 'prop.light-tower-trailer', at: [-10, 0] }, { asset: 'prop.privacy-fence', at: [8, 0], scale: [1, 1, 4] }],
            actors: [{ kind: 'courier', at: [2, 0] }, { kind: 'infected', count: quality === 'high' ? 40 : 30, spread: 6, at: [0, 0], state: 'idle' }],
            camera: { mode: 'game', target: [0, 0], zoom: 1.5 } });
          await window.__SCENE__!.step(180);
        } else if (scenario === 'corgi-contact') {
          await window.__SCENE__!.load({ name: 'corgi-contact', seed: 29, ground: 'asphalt', time: 'L1', size: 20, dof: false,
            actors: [{ kind: 'courier', at: [0, 0] }, { kind: 'corgi', at: [1.5, 0] }],
            camera: { mode: 'pose', position: [3, 2.3, 3.5], target: [.8, .4, 0] } });
          await window.__SCENE__!.step(420);
        } else if (scenario === 'L7') {
          await a.loadLevel('L7', { seed: 29 }); a.pause();
          a.teleport('player', { x: -48, z: 46 });
          a.camera.cinematic({ position: [-22, 24, 68], target: [-48, 0, 46] }, true);
          await a.step(2);
        } else if (scenario === 'rocket') {
          await a.loadScenario(quality === 'high' ? 'perf-horde-200' : 'perf-horde-100', { seed: 29 }); a.pause(); a.cheats.god(true); a.camera.preset('perf-horde');
          await a.step(180);
          for (let i = 0; i < 3; i++) { a.explosions.blast('explosion.rocket', { x: 10, z: 0 }); await a.step(75); }
        } else {
          await a.loadScenario(scenario, { seed: 28 }); a.pause(); a.cheats.god(true); await a.step(3600);
        }
        a.pause(); await a.screenshotReady();
      }, { scenario, quality });
      const raw = await cdp.send('Runtime.getHeapUsage');
      for (let i = 0; i < 3; i++) { await cdp.send('HeapProfiler.collectGarbage'); await page.evaluate(() => new Promise(requestAnimationFrame)); }
      const heap = await cdp.send('Runtime.getHeapUsage');
      const retained = await page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        const renderer = game.view.renderer as unknown as { _geometries: { _geometryDisposeListeners: Map<unknown, unknown> }; _nodes: { nodeBuilderCache: Map<unknown, unknown> } };
        const arrays = new Set<ArrayBufferLike>(), geometries = new Set<import('three').BufferGeometry>();
        game.view.scene.traverse(o => {
          const mesh = o as import('three').Mesh;
          if (!mesh.geometry || geometries.has(mesh.geometry)) return;
          geometries.add(mesh.geometry);
          for (const attr of [...Object.values(mesh.geometry.attributes), mesh.geometry.index].filter(Boolean)) {
            if (!attr) continue;
            arrays.add(('data' in attr ? attr.data.array : attr.array).buffer);
          }
        });
        return { perf: game.perf(), sceneGeometries: geometries.size, sceneBufferBytes: [...arrays].reduce((n, a) => n + a.byteLength, 0),
          geometryListeners: renderer._geometries._geometryDisposeListeners.size, nodeBuilders: renderer._nodes.nodeBuilderCache?.size };
      });
      if (retained.perf.backend !== backend || retained.perf.quality.tier !== quality) throw Error('Requested renderer/tier was not selected');
      const label = `${scenario}-${backend}-${quality}`;
      await page.locator('canvas').screenshot({ path: `${out}/${label}.png` });
      if (process.env.HEAP_AUDIT_SNAPSHOT === '1' && backend === 'webgl' && quality === 'high' && ['light-lab', 'L7', 'rocket'].includes(scenario)) {
        const fd = openSync(`${out}/${label}.heapsnapshot`, 'w');
        const chunk = ({ chunk }: { chunk: string }) => writeSync(fd, chunk);
        cdp.on('HeapProfiler.addHeapSnapshotChunk', chunk);
        try { await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false }); }
        finally { cdp.off('HeapProfiler.addHeapSnapshotChunk', chunk); closeSync(fd); }
      }
      rows.push({ label, raw, heap, ...retained, errors: [...errors] });
      writeFileSync(`${out}/readings.json`, JSON.stringify(rows, null, 2));
    }
    if (process.env.HEAP_AUDIT_LIFECYCLE === '1') {
      const loads = [];
      for (const level of ['L7', 'L1', 'L7', 'L1', 'L7']) {
        await page.evaluate(async ({ level, quality, first }) => {
          const a = window.__SS__!;
          await a.loadLevel(level, { seed: 29, ...(first ? { progression: 'L7-default' as const } : {}) });
          if (first) a.settings.set({ quality, flashReduction: true, cameraShake: false, gore: 'Off' });
          a.missions.begin(); a.pause();
          for (let frame = 0; frame < 6; frame++) await a.screenshotReady();
        }, { level, quality, first: loads.length === 0 });
        await cdp.send('HeapProfiler.collectGarbage');
        const heap = await cdp.send('Runtime.getHeapUsage');
        const state = await page.evaluate(() => {
          const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
          return { perf: a.perf(), settings: a.campaign.state()!.settings, renderer: game.view.renderer.diagnostics() };
        });
        loads.push({ level, heap, ...state });
        writeFileSync(`${out}/lifecycle-${backend}-${quality}.json`, JSON.stringify(loads, null, 2));
        console.log(`${backend} ${quality} lifecycle ${loads.length}: ${heap.usedSize / 1e6} MB, ${state.perf.geometries} geometries, ${state.perf.textures} textures`);
        if (!state.settings.flashReduction || state.settings.cameraShake || state.settings.gore !== 'Off') throw Error('Accessibility settings changed across reload');
      }
      const first = loads[0], last = loads.at(-1)!;
      if (last.heap.usedSize > first.heap.usedSize * 1.1 || last.perf.geometries > first.perf.geometries * 1.1 || last.perf.textures > first.perf.textures * 1.1) throw Error(`${backend} ${quality}: five-load retention exceeds 10%`);
    }
    guard.dispose();
    if (errors.length) throw Error(errors.join('\n'));
    await cdp.detach(); await context.close();
  }
} finally { await browser?.close(); server.kill(); }
