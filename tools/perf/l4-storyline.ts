/** Paired natural L4 hold timing at the PO settings. Run through quiet-run.sh -> e2e-lock.sh. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, devices } from '@playwright/test';
import { preview } from 'vite';
import { uncappedArgs } from './uncapped';
import { l4 } from '../../src/data/l4';

const out = resolve(process.env.L4_STORYLINE_PERF_OUT ?? 'test-results/l4-storyline/perf');
const diagnostic = process.env.L4_STORYLINE_PROFILE === '1';
const sampledCpu = process.env.L4_STORYLINE_CDP_PROFILE === '1';
const wholeHold = process.env.L4_STORYLINE_WHOLE_HOLD === '1';
const phone = process.env.L4_STORYLINE_PHONE === '1';
const candidateOnly = phone || process.env.L4_STORYLINE_CANDIDATE_ONLY === '1';
// Orchestrator 2026-10-24: the visible horde has its own headroom budget.
const budgetMs = phone ? 33.3 : 11, dpr = phone ? 1.5 : 1;
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
  for (let repeat = 0; repeat < repeats; repeat++) for (const side of diagnostic || candidateOnly ? ['candidate'] as const : repeat % 2 ? ['candidate', 'baseline'] as const : ['baseline', 'candidate'] as const) {
    const context = await browser.newContext(phone ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); page.setDefaultTimeout(180_000);
    if (phone) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    await page.addInitScript('window.__name = value => value');
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${sources[side]}/?test=1&crowdProbe=drawn&renderer=webgpu&quality=low&dpr=${dpr}&audio=muted&seed=3&preload=0${diagnostic && !sampledCpu ? '&profile=1' : ''}`);
      await page.waitForFunction(() => !!window.__SS__);
      await page.evaluate(async () => {
        const a = window.__SS__!; await a.ready;
        await a.loadLevel('L4', { seed: 3, checkpoint: 'turn', progression: 'L4-default' });
        a.pause(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5);
        a.teleport('player', { x: -22.85, z: .7 });
      });
      const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src).filter(Boolean));
      if (diagnostic && !sampledCpu) await page.evaluate(() => window.__SS__!.debug.cpuProfile());
      for (const afterTurnS of checkpoints) {
        await page.evaluate(async seconds => {
          const a = window.__SS__!, turnAt = a.missions.state()!.l4!.turnAt;
          if (!turnAt) throw new Error('L4 turn checkpoint did not start the hold');
          const until = turnAt + seconds * 60;
          while (a.tick() < until) await a.step(Math.min(60, until - a.tick()));
          a.camera.follow(); a.camera.zoom(1.5); await a.screenshotReady();
        }, afterTurnS);
        if (repeat === 0 && (afterTurnS === 150 || checkpoints.length === 1)) {
          for (const zoom of [1, 1.5]) {
            await page.evaluate(async z => { const a = window.__SS__!; a.camera.follow(); a.camera.zoom(z); await a.screenshotReady(); }, zoom);
            await page.screenshot({ path: `${out}/${side}-${afterTurnS}-z${String(zoom).replace('.', '')}.png` });
          }
          await page.evaluate(async () => { const a = window.__SS__!; a.camera.zoom(1.5); await a.screenshotReady(); });
        }
        const cpuSampler = sampledCpu ? await context.newCDPSession(page) : null;
        if (cpuSampler) { await cpuSampler.send('Profiler.enable'); await cpuSampler.send('Profiler.start'); }
        const result = await page.evaluate(async ({ perimeter, diagnostic, wholeHold }) => {
          const a = window.__SS__!, frames: number[] = [], sim: number[] = [], updates: number[] = [], renders: number[] = [];
          const cpu: Record<string, number[]> = {};
          const census = () => {
            const all = a.query({}), player = all.find(e => e.id === 1)!.transform, live = all.filter(e => e.infected && !e.hidden && e.health.current > 0);
            const drawn = new Set(a.crowdFigures().filter(f => f.drawn).map(f => f.id));
            const visibleNative = live.filter(e => {
              if (e.appearance || e.pendingAdmission || e.infected?.hidden) return false;
              const p = a.camera.project(e.transform.x, e.transform.y + .6, e.transform.z);
              return Math.abs(p[0]) < .8 && Math.abs(p[1]) < .8 && p[2] > -1 && p[2] < 1;
            });
            return { tick: a.tick(), phase: a.missions.state()!.l4!.phase, infected: live.length,
              corpses14: all.filter(e => e.faction === 'infected' && e.health.current <= 0 && !e.hidden && Math.hypot(e.transform.x - player.x, e.transform.z - player.z) <= 14).length,
              drawnInfected: live.filter(e => drawn.has(e.id)).length, missingNative: visibleNative.filter(e => !drawn.has(e.id)).map(e => e.id),
              inside: live.filter(e => e.transform.x > perimeter.x0 && e.transform.x < perimeter.x1 && e.transform.z > perimeter.z0 && e.transform.z < perimeter.z1).length,
              backend: a.perf().backend, quality: a.perf().quality.tier, player };
          };
          const before = census(), start = performance.now(), holdCensuses: ReturnType<typeof census>[] = [];
          let previous = 0, stillWar = true, polledAt = start, telemetryAt = start;
          a.resume();
          while (wholeHold ? stillWar && performance.now() - start < 230_000 : performance.now() - start < 13_000) {
            const now = await new Promise<number>(r => requestAnimationFrame(r));
            if (wholeHold && now - polledAt >= 1_000) {
              stillWar = a.missions.state()!.l4!.phase === 'war'; polledAt = now;
              if (!stillWar) break;
              if (holdCensuses.length < 2 && (a.tick() - before.tick) / 60 >= [90, 150][holdCensuses.length]) holdCensuses.push(census());
            }
            if (previous && now - start >= 3_000) {
              frames.push(now - previous);
              // Native timing records every RAF; optional CPU/scene telemetry
              // need not allocate a full diagnostic snapshot on every frame.
              if (diagnostic || now - telemetryAt >= 250) {
                const p = a.perf(); telemetryAt = now;
                sim.push(p.simTickMs); updates.push(p.updateCpuMs); renders.push(p.renderCpuMs);
              }
              if (diagnostic) for (const [key, value] of Object.entries(a.debug.cpuProfile())) (cpu[key] ??= []).push(value);
            }
            previous = now;
          }
          a.pause();
          const p95 = (values: number[]) => [...values].sort((x, y) => x - y)[Math.ceil(values.length * .95) - 1];
          return { before, after: census(), elapsedMs: performance.now() - start, holdCensuses, frameP95: Math.round(p95(frames) * 10) / 10, simP95: p95(sim), updateP95: p95(updates), renderP95: p95(renders), cpuP95: Object.fromEntries(Object.entries(cpu).map(([key, values]) => [key, p95(values)])), frames };
        }, { perimeter: l4.perimeter, diagnostic: diagnostic && !sampledCpu, wholeHold });
        if (cpuSampler) {
          writeFileSync(`${out}/${side}-${repeat}-${afterTurnS}.cpuprofile`, JSON.stringify((await cpuSampler.send('Profiler.stop')).profile));
          const telemetryMs = await page.evaluate(() => { const a = window.__SS__!, start = performance.now(); for (let i = 0; i < 1000; i++) a.perf(); return (performance.now() - start) / 1000; });
          console.log(JSON.stringify({ telemetryMs, render: await page.evaluate(() => window.__SS__!.perf()) }));
        }
        if (result.before.backend !== 'webgpu' || result.before.quality !== 'low' || result.before.phase !== 'war' || result.frames.length < 60 || wholeHold && (result.after.phase === 'war' || result.elapsedMs < 100_000) || [result.before, result.after, ...result.holdCensuses].some(c => c.missingNative.length) || errors.length)
          throw new Error(`Invalid ${side} measurement: ${JSON.stringify({ ...result.before, samples: result.frames.length, errors })}`);
        rows.push({ side, repeat, afterTurnS, scripts, ...result });
        if (side === 'candidate' && afterTurnS === 150 && result.before.corpses14 > 150)
          throw new Error(`Q-166 corpse field exceeds 150 within 14 m at 150 s: ${result.before.corpses14}`);
        writeFileSync(`${out}/samples.json`, JSON.stringify(rows, null, 2));
        console.log(JSON.stringify({ side, repeat, afterTurnS, frameP95: result.frameP95, simP95: result.simP95, before: result.before, after: result.after }));
      }
    } finally { await context.close(); }
  }
  const median = (values: number[]) => [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)];
  const comparisons = (diagnostic ? [] : checkpoints).map(afterTurnS => {
    const value = (side: string) => median(rows.filter(r => r.side === side && r.afterTurnS === afterTurnS).map(r => r.frameP95));
    const baseline = candidateOnly ? undefined : value('baseline'), candidate = value('candidate');
    const withinBudget = candidate <= budgetMs;
    // Orchestrator 2026-10-24: accept the 33–34 ms phone emulation
    // proxy and report its measured value; the nominal line stays 33.3 ms.
    const acceptedPhoneProxy = phone && !withinBudget && candidate <= 33.9;
    return { afterTurnS, baseline, candidate, delta: baseline === undefined ? undefined : candidate - baseline, budgetMs, withinBudget, acceptedPhoneProxy, pass: withinBudget || acceptedPhoneProxy };
  });
  const proof = { diagnostic, wholeHold, settings: { seed: 3, backend: 'webgpu', quality: 'low', viewport: phone ? [390, 844] : [1280, 720], dpr, cpuThrottle: phone ? 4 : 1, zoom: 1.5, warmupS: 3, measuredS: wholeHold ? 'entire hold after warmup' : 10, repeats, uncapped: true, resolutionMs: .1, frameSampling: 'every RAF', cpuTelemetryEveryMs: diagnostic ? 0 : 250, figureProbe: 'drawn' }, sources, comparisons, rows };
  writeFileSync(`${out}/summary.json`, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(comparisons));
  if (comparisons.some(row => !row.pass)) process.exitCode = 1;
} finally { await browser.close(); await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve())); }
