/** Quiet, matched-build physical traversal and fresh-browser cold menu loads.
 * BROWSER_POOL_JOB_ID=r10-l10 sh tools/perf/quiet-run.sh node --import tsx tools/qa/r10-l10-perf.ts
 * Uses one headless native Metal WebGL2 context at a time. */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadavg } from 'node:os';
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { launchBrowser } from '../browser-pool/client';
import { uncappedArgs } from '../perf/uncapped';

assert.equal(process.env.MI_PERF_LOCK_HELD, '1', 'Use quiet-run');
const selectedSide = process.env.R10_PERF_SIDE;
assert.ok(!selectedSide || selectedSide === 'before' || selectedSide === 'after', 'R10_PERF_SIDE must be before or after');
const out = `test-results/r10-l10/perf${selectedSide ? `-${selectedSide}` : ''}`; mkdirSync(out, { recursive: true });
const sides = (['before', 'after'] as const).filter(side => !selectedSide || side === selectedSide);
const servers = await Promise.all(sides.map((side, i) => preview({ configFile: false, build: { outDir: resolve(`test-results/r10-l10/${side === 'after' ? 'final' : 'before'}-dist`) }, preview: { host: '127.0.0.1', port: 3901 + i, strictPort: true } })));
const rows: unknown[] = [];
type TraversalSample = { frames: number[]; end: { x: number; z: number }; perf: unknown };
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', ...uncappedArgs()] });
try {
  for (const tier of ['low', 'high'] as const) for (const [i, side] of sides.entries()) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); page.setDefaultTimeout(180_000);
    const errors: string[] = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript('globalThis.__name = fn => fn');
    await page.goto(`http://127.0.0.1:${3901 + i}/?test=1&scenelab=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1&preload=0`);
    await page.waitForFunction(() => !!window.__SS__);
    await page.evaluate(async tier => { const a = window.__SS__!; await a.ready; a.pause(); a.settings.set({ quality: tier, cameraShake: false }); await a.loadLevel('L10', { seed: 32, progression: 'L10-default' } as never); a.missions.begin(); a.cheats.god(true); }, tier);
    for (const zoom of [1, 1.5]) for (const [name, x, z] of [['r4', 2235, -64], ['r6', 3390, -94], ['approach', 3900, -30], ['console', 3940, -30]] as const) {
      const start = await page.evaluate(async ({ x, z, zoom }) => {
        const a = window.__SS__!; a.pause(); a.cheats.killAll(); a.teleport(1, { x, z }); a.camera.follow(); a.camera.zoom(zoom); await a.step(120); await a.screenshotReady();
        const p = a.getEntity(1)!.transform, startPosition = { x: p.x, z: p.z };
        // Arm before resume and physical key-down; retain the first movement
        // interval so a cold material stall cannot disappear from this sample.
        (window as unknown as { __r10sample: Promise<TraversalSample> }).__r10sample = new Promise(done => {
          const frames: number[] = []; let last = performance.now(); const start = last;
          const frame = (now: number) => { frames.push(now - last); last = now; if (now - start < 6500) requestAnimationFrame(frame); else { const p = a.getEntity(1)!.transform; a.pause(); done({ frames, end: { x: p.x, z: p.z }, perf: a.perf() }); } };
          requestAnimationFrame(frame);
        });
        a.resume(); return startPosition;
      }, { x, z, zoom });
      await page.keyboard.down('KeyD'); await page.keyboard.down('KeyS');
      const sample = await page.evaluate(() => (window as unknown as { __r10sample: Promise<TraversalSample> }).__r10sample);
      await page.keyboard.up('KeyD'); await page.keyboard.up('KeyS');
      const times = sample.frames.filter(t => t >= 0).sort((a, b) => a - b), distance = Math.hypot(sample.end.x - start.x, sample.end.z - start.z);
      rows.push({ side, tier, zoom, name, start, ...sample, distance, load: loadavg(), max: times.at(-1), p95: times[Math.floor(times.length * .95)], over66: times.filter(t => t > 66).length });
      writeFileSync(`${out}/frames.json`, JSON.stringify(rows, null, 1));
      assert.ok(distance > 5, `Physical movement required: ${side}/${tier}/${name}/${zoom}`);
    }
    rows.push({ side, tier, errors }); await context.close();
  }
  await browser.close();
  // The menu-load tool starts a new native Chrome/profile for every sample.
  for (const [i, side] of sides.entries()) for (const tier of ['low', 'high']) {
    const code = await new Promise<number>(done => {
      const child = spawn(process.execPath, ['--import', 'tsx', 'tools/perf/cold-load-time.ts', `http://127.0.0.1:${3901 + i}`, 'webgl2', tier, side === 'after' ? '3' : '1', 'L10', '0'],
        { stdio: 'inherit', env: { ...process.env, LOAD_FRESH_BROWSER: '1', LOAD_OUT: `${out}/cold-${side}` } });
      child.on('exit', code => done(code ?? 1)); child.on('error', () => done(1));
    });
    assert.equal(code, 0, 'Cold-load probe must execute');
    const summary = JSON.parse(readFileSync(`${out}/cold-${side}/L10-webgl2-${tier}-summary.json`, 'utf8'));
    rows.push({ side, tier, kind: 'cold-load', summary });
    writeFileSync(`${out}/frames.json`, JSON.stringify(rows, null, 1));
  }
} finally { await browser.close().catch(() => {}); await Promise.all(servers.map(s => s.close())); writeFileSync(`${out}/frames.json`, JSON.stringify(rows, null, 1)); }
