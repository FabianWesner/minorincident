import { mkdirSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { test, expect } from '@playwright/test';

// Level handover timing: every campaign handover L1 -> L10 (and the menu Continue load into each level) on the
// production build. Records time-to-playable (loadLevel call -> first full-size frame), load phases, the first
// frames after the card hides, heap and renderer memory. Pixel mode captures a deterministic post-load frame
// (same seed, same tick) for a before/after compare.
// Env: HANDOVER_BACKEND webgl|webgpu, HANDOVER_TIER high|low, HANDOVER_THROTTLE 1|4, HANDOVER_REPEAT n,
//      HANDOVER_PHASE label, HANDOVER_PIXELS 1 (capture frames instead of timing), HANDOVER_LEVELS L1,L2,...
const backend = (process.env.HANDOVER_BACKEND ?? 'webgl') as 'webgl' | 'webgpu';
const tier = (process.env.HANDOVER_TIER ?? 'high') as 'high' | 'low';
const throttle = Number(process.env.HANDOVER_THROTTLE ?? 1);
const repeat = Number(process.env.HANDOVER_REPEAT ?? 1);
const phase = process.env.HANDOVER_PHASE ?? 'after';
const pixels = process.env.HANDOVER_PIXELS === '1';
const out = process.env.HANDOVER_OUT ?? 'test-results/level-handover';
const presets: Record<string, string | undefined> = { L2: 'L2-default', L3: 'L3-default', L4: 'L4-default', L5: 'L5-default', L6: 'L6-default', L7: 'L7-default', L8: 'L8-default', L10: 'L10-default' };
const levels = (process.env.HANDOVER_LEVELS ?? 'L1,L2,L3,L4,L5,L6,L7,L8,L9,L10').split(',');
const label = `${phase}-${backend}-${tier}-x${throttle}`;

const gpuArgs = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
test.use({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, headless: true, launchOptions: { args: [...gpuArgs, ...(backend === 'webgpu' ? ['--enable-unsafe-webgpu'] : [])] } });

test(`@perf level handovers ${label}`, async ({ page, context }) => {
  test.setTimeout(1_500_000); mkdirSync(out, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.goto(`/?testApi=1&loadProfile=${process.env.HANDOVER_LOAD_PROFILE ?? 1}&renderer=${backend}&quality=${tier}&dpr=1&audio=muted&seed=1&preload=0${throttle > 1 ? `&workerCpu=${throttle}` : ''}`);
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(() => window.__SS__!.ready);
  expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(backend);
  const rows: Record<string, unknown>[] = [];
  const profile = process.env.HANDOVER_PROFILE === '1';
  if (profile) await cdp.send('Profiler.enable');
  for (let run = 0; run < repeat; run++) for (const level of levels) {
    const from = await page.evaluate(() => window.__SS__!.getState().scenario);
    if (profile) await cdp.send('Profiler.start');
    const result = await page.evaluate(async ({ level, preset, pixels }) => {
      const a = window.__SS__!; a.pause(); performance.clearMeasures();
      const frames: number[] = []; let previous = 0, recording = false, stopped = false;
      const frame = (now: number) => { if (recording && previous) frames.push(now - previous); previous = now; if (!stopped) requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
      const start = performance.now();
      await a.loadLevel(level, { seed: 1, ...(preset ? { progression: preset as 'L2-default' } : {}) });
      const playable = performance.now() - start;
      const phases = performance.getEntriesByType('measure').map(entry => ({ name: entry.name, ms: Math.round(entry.duration) }));
      a.missions.begin();
      let maxFrame = 0, over50 = 0, first = 0;
      if (!pixels) {
        // The first frames after the card hides, with the sim running (the player sees these).
        recording = true; previous = 0; a.resume();
        await new Promise(resolve => setTimeout(resolve, 2500));
        a.pause(); recording = false;
        maxFrame = Math.max(...frames); over50 = frames.filter(ms => ms > 50).length; first = frames[0] ?? 0;
      } else { a.pause(); await a.step(120); await a.screenshotReady(); }
      stopped = true;
      const perf = a.perf();
      const before = (window as unknown as { __nodeBuildMaterials?: Record<string, number> }).__nodeBuildMaterials ?? {};
      const nodeBuildMaterials: Record<string, number> = {};
      for (const [key, count] of Object.entries(perf.nodeBuildMaterials)) if (count - (before[key] ?? 0) > 0) nodeBuildMaterials[key] = count - (before[key] ?? 0);
      (window as unknown as { __nodeBuildMaterials?: Record<string, number> }).__nodeBuildMaterials = { ...perf.nodeBuildMaterials };
      return { playable: Math.round(playable), phases, maxFrame: Math.round(maxFrame), over50, firstFrame: Math.round(first), frames: frames.slice(0, 30).map(Math.round), geometries: perf.geometries, textures: perf.textures, nodeBuilds: perf.nodeBuilds, nodeBuildMaterials, drawCalls: perf.drawCalls, tick: a.tick(), loadTiming: perf.loadTiming };
    }, { level, preset: presets[level], pixels });
    if (profile) { const { profile } = await cdp.send('Profiler.stop'); writeFileSync(`${out}/${label}-${level}.cpuprofile`, JSON.stringify(profile)); }
    if (pixels) await page.screenshot({ path: `${out}/${label}-${level}.png`, animations: 'disabled' });
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const row = { run, from, level, ...result, heapMB: Math.round(heap.usedSize / 1e5) / 10, load: loadavg()[0] };
    rows.push(row);
    const top = [...result.phases].filter(p => !p.name.startsWith('transition')).sort((a, b) => b.ms - a.ms).slice(0, 6).map(p => `${p.name}=${p.ms}`).join(' ');
    console.log(`${label} run${run} ${from}->${level}: playable ${result.playable} ms, first ${result.firstFrame} ms, max ${result.maxFrame} ms, over50 ${result.over50}, heap ${row.heapMB} MB, nodeBuilds ${result.nodeBuilds} | ${top}`);
    writeFileSync(`${out}/${label}.json`, JSON.stringify({ backend, tier, throttle, phase, errors, rows }, null, 2));
  }
  expect(errors).toEqual([]);
});
