/** Paired natural L4 hold timing at the PO settings. Run through quiet-run.sh -> e2e-lock.sh. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { uncappedArgs } from './uncapped';
import { l4 } from '../../src/data/l4';

const out = resolve(process.env.L4_STORYLINE_PERF_OUT ?? 'test-results/l4-storyline/perf');
const diagnostic = process.env.L4_STORYLINE_PROFILE === '1';
const wholeHold = process.env.L4_STORYLINE_WHOLE_HOLD === '1';
const repeats = diagnostic ? 1 : wholeHold ? 2 : 3;
const checkpoints = diagnostic ? [150] : wholeHold ? [0] : [90, 150];
const port = Number(process.env.E2E_PORT ?? 4431);
if (port === 3300) throw new Error('Use the lane preview port');
mkdirSync(out, { recursive: true });
const server = await preview({ configFile: false, build: { outDir: resolve('dist') }, preview: { host: '127.0.0.1', port, strictPort: true } });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', ...uncappedArgs()] });
const sources = { baseline: 'https://minor-incident.com', candidate: `http://127.0.0.1:${port}` };
const rows: { side: string; repeat: number; afterTurnS: number; frameP95: number; [key: string]: unknown }[] = [];
try {
  // Alternate which build goes first, measuring one browser/context at a time.
  for (let repeat = 0; repeat < repeats; repeat++) for (const side of diagnostic ? ['candidate'] as const : repeat % 2 ? ['candidate', 'baseline'] as const : ['baseline', 'candidate'] as const) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); page.setDefaultTimeout(180_000);
    await page.addInitScript('window.__name = value => value');
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${sources[side]}/?test=1&renderer=webgpu&quality=low&dpr=1&audio=muted&seed=3&preload=0${diagnostic ? '&profile=1' : ''}`);
      await page.waitForFunction(() => !!window.__SS__);
      await page.evaluate(async () => {
        const a = window.__SS__!; await a.ready;
        await a.loadLevel('L4', { seed: 3, checkpoint: 'turn', progression: 'L4-default' });
        a.pause(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5);
        a.teleport('player', { x: -22.85, z: .7 });
      });
      const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src).filter(Boolean));
      if (diagnostic) await page.evaluate(() => window.__SS__!.debug.cpuProfile());
      for (const afterTurnS of checkpoints) {
        await page.evaluate(async seconds => {
          const a = window.__SS__!, turnAt = a.missions.state()!.l4!.turnAt;
          if (!turnAt) throw new Error('L4 turn checkpoint did not start the hold');
          const until = turnAt + seconds * 60;
          while (a.tick() < until) await a.step(Math.min(60, until - a.tick()));
          a.camera.follow(); a.camera.zoom(1.5); await a.screenshotReady();
        }, afterTurnS);
        if (repeat === 0) await page.screenshot({ path: `${out}/${side}-${afterTurnS}.png` });
        const result = await page.evaluate(async ({ perimeter, diagnostic, wholeHold }) => {
          const a = window.__SS__!, frames: number[] = [], sim: number[] = [], updates: number[] = [], renders: number[] = [];
          const cpu: Record<string, number[]> = {};
          const census = () => {
            const all = a.query({}), live = all.filter(e => e.infected && !e.hidden && e.health.current > 0);
            return { tick: a.tick(), phase: a.missions.state()!.l4!.phase, infected: live.length,
              inside: live.filter(e => e.transform.x > perimeter.x0 && e.transform.x < perimeter.x1 && e.transform.z > perimeter.z0 && e.transform.z < perimeter.z1).length,
              backend: a.perf().backend, quality: a.perf().quality.tier, player: a.getState().player!.transform };
          };
          const before = census(), start = performance.now(), holdCensuses: ReturnType<typeof census>[] = [];
          let previous = 0, stillWar = true, polledAt = start;
          a.resume();
          while (wholeHold ? stillWar && performance.now() - start < 230_000 : performance.now() - start < 13_000) {
            const now = await new Promise<number>(r => requestAnimationFrame(r)), p = a.perf();
            if (wholeHold && now - polledAt >= 1_000) {
              stillWar = a.missions.state()!.l4!.phase === 'war'; polledAt = now;
              if (!stillWar) break;
              if (holdCensuses.length < 2 && (a.tick() - before.tick) / 60 >= [90, 150][holdCensuses.length]) holdCensuses.push(census());
            }
            if (previous && now - start >= 3_000) {
              frames.push(now - previous); sim.push(p.simTickMs); updates.push(p.updateCpuMs); renders.push(p.renderCpuMs);
              if (diagnostic) for (const [key, value] of Object.entries(a.debug.cpuProfile())) (cpu[key] ??= []).push(value);
            }
            previous = now;
          }
          a.pause();
          const p95 = (values: number[]) => [...values].sort((x, y) => x - y)[Math.ceil(values.length * .95) - 1];
          return { before, after: census(), elapsedMs: performance.now() - start, holdCensuses, frameP95: Math.round(p95(frames) * 10) / 10, simP95: p95(sim), updateP95: p95(updates), renderP95: p95(renders), cpuP95: Object.fromEntries(Object.entries(cpu).map(([key, values]) => [key, p95(values)])), frames };
        }, { perimeter: l4.perimeter, diagnostic, wholeHold });
        if (result.before.backend !== 'webgpu' || result.before.quality !== 'low' || result.before.phase !== 'war' || result.frames.length < 60 || wholeHold && (result.after.phase === 'war' || result.elapsedMs < 100_000) || errors.length)
          throw new Error(`Invalid ${side} measurement: ${JSON.stringify({ ...result.before, samples: result.frames.length, errors })}`);
        rows.push({ side, repeat, afterTurnS, scripts, ...result });
        writeFileSync(`${out}/samples.json`, JSON.stringify(rows, null, 2));
        console.log(JSON.stringify({ side, repeat, afterTurnS, frameP95: result.frameP95, simP95: result.simP95, before: result.before, after: result.after }));
      }
    } finally { await context.close(); }
  }
  const median = (values: number[]) => [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)];
  const comparisons = (diagnostic ? [] : checkpoints).map(afterTurnS => {
    const value = (side: string) => median(rows.filter(r => r.side === side && r.afterTurnS === afterTurnS).map(r => r.frameP95));
    const baseline = value('baseline'), candidate = value('candidate');
    return { afterTurnS, baseline, candidate, delta: candidate - baseline, pass: candidate <= baseline };
  });
  const proof = { diagnostic, wholeHold, settings: { seed: 3, backend: 'webgpu', quality: 'low', viewport: [1280, 720], dpr: 1, zoom: 1.5, warmupS: 3, measuredS: wholeHold ? 'entire hold after warmup' : 10, repeats, uncapped: true, resolutionMs: .1 }, sources, comparisons, rows };
  writeFileSync(`${out}/summary.json`, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(comparisons));
  if (comparisons.some(row => !row.pass)) process.exitCode = 1;
} finally { await browser.close(); await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve())); }
