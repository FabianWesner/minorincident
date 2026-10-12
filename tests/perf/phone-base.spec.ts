import { mkdirSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { spawnSync } from 'node:child_process';
import { devices } from '@playwright/test';
import { test, expect } from '../e2e/fixtures';

const dir = 'test-results/perf/phone-base';
const phase = process.env.PHONE_PERF_PHASE ?? 'after';
const localVitest = () => (spawnSync('pgrep', ['-f', '^([^ ]*/)?[n]ode [^ ]*/node_modules/[.]bin/vitest( |$)'], { encoding: 'utf8' }).stdout ?? '').trim().split('\n').filter(Boolean);
const otherHeadlessChrome = () => (spawnSync('ps', ['-axo', 'pid,ppid,command'], { encoding: 'utf8' }).stdout ?? '').split('\n').flatMap(line => {
  const row = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
  if (!row) return [];
  const [, pid, parent, command] = row;
  return Number(parent) !== process.pid && /^\/(?:Applications\/Google Chrome\.app\/Contents\/MacOS\/Google Chrome|[^ ]+\/(?:chrome|chrome-headless-shell|Chromium|Google Chrome)) --/.test(command) && command.includes('--headless') && !command.includes('--type=') ? [pid] : [];
});
test.use({ channel: 'chrome', headless: true, viewport: { width: 390, height: 844 },
  deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true,
  launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--autoplay-policy=no-user-gesture-required'] } });

for (const level of ['L1', 'L3', 'L4', 'L5'] as const) test(`phone base ${level} @E18 @perf @phone-base`, async ({ page, context }) => {
  test.setTimeout(600_000); mkdirSync(dir, { recursive: true });
  const hostLoadStart = loadavg();
  const localVitestStart = localVitest();
  const otherHeadlessChromeStart = otherHeadlessChrome();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('/?test=1&ui=1&renderer=webgl&quality=low&dpr=1.5&profile&telemetry=record');
  await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async level => {
    const a = window.__SS__!; await a.ready;
    await a.loadLevel(level, { seed: 2 }); a.pause(); a.missions.begin(); a.cheats.god(true);
    if (level === 'L3') {
      a.teleport('player', { x: 124, z: 0 });
      for (let i = 0; i < 12; i++) a.spawn('infected.runner', { x: 118 + i % 4, z: -.6 + Math.floor(i / 4) * .6 }, { state: 'chase' });
      await a.step(2);
    }
    if (level === 'L4') { a.cheats.completeObjective('ride'); await a.step(60); }
    if (level === 'L5') { a.cheats.completeObjective('emerge'); await a.step(11 * 60); a.teleport('player', { x: -14, z: 8 }); await a.step(2); }
    await a.screenshotReady(); await a.audio.unlock(); a.debug.cpuProfile();
  }, level);
  // Let shader/asset residency and camera easing settle before sampling the live clock.
  await page.evaluate(async () => {
    const a = window.__SS__!; a.resume();
    for (let i = 0; i < 120; i++) await new Promise(resolve => requestAnimationFrame(resolve));
    a.pause();
  });
  await page.locator('canvas').screenshot({ path: `${dir}/${phase}-${level}.png`, scale: 'css' });
  const samples = await page.evaluate(async () => {
    const a = window.__SS__!, out: { frame: number; sim: number; simWorldAverage: number; ticks: number; update: number; render: number; actors: number; costs: Record<string, number> }[] = [];
    let previous = 0; a.resume();
    for (let i = 0; i < 600; i++) {
      const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
      const p = a.perf(), costs = a.debug.cpuProfile();
      if (previous && i > 30) out.push({ frame: now - previous, sim: costs.simTickMax, simWorldAverage: p.simTicks ? p.simWorldMs / p.simTicks : 0, ticks: p.simTicks,
        update: p.updateCpuMs, render: p.renderCpuMs, actors: p.infected?.count ?? 0, costs });
      previous = now;
    }
    a.pause(); return out;
  });
  const hostLoadEnd = loadavg();
  const localVitestEnd = localVitest();
  const otherHeadlessChromeEnd = otherHeadlessChrome();
  if (process.env.PHONE_CPU_TRACE === '1') {
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
    await page.evaluate(async () => { const a = window.__SS__!; a.resume(); for (let i = 0; i < 120; i++) await new Promise(resolve => requestAnimationFrame(resolve)); a.pause(); });
    writeFileSync(`${dir}/${phase}-${level}.cpuprofile`, JSON.stringify((await cdp.send('Profiler.stop')).profile));
    const complete = new Promise<{ stream?: string }>(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.start', { categories: 'devtools.timeline', transferMode: 'ReturnAsStream' });
    await page.evaluate(async () => { const a = window.__SS__!; a.resume(); for (let i = 0; i < 120; i++) await new Promise(resolve => requestAnimationFrame(resolve)); a.pause(); });
    await cdp.send('Tracing.end');
    const { stream } = await complete; let trace = '';
    if (!stream) throw new Error('DOM trace did not return its requested stream');
    for (;;) { const chunk = await cdp.send('IO.read', { handle: stream }); trace += chunk.data; if (chunk.eof) break; }
    await cdp.send('IO.close', { handle: stream });
    const events = (JSON.parse(trace) as { traceEvents: { name: string; ph: string; dur?: number }[] }).traceEvents;
    const names = ['UpdateLayoutTree', 'Layout', 'Paint', 'PrePaint', 'CompositeLayers'];
    const dom = Object.fromEntries(names.map(name => {
      const durations = events.filter(event => event.name === name && event.ph === 'X').map(event => (event.dur ?? 0) / 1000);
      return [name, { count: durations.length, totalMs: durations.reduce((sum, value) => sum + value, 0), sampledFrames: 120 }];
    }));
    writeFileSync(`${dir}/${phase}-${level}.dom.json`, JSON.stringify(dom, null, 2));
  }
  const q = (values: number[]) => values.sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
  const costNames = Object.keys(samples[0].costs);
  const costs = Object.fromEntries(costNames.map(name => [name, q(samples.map(s => s.costs[name]))]));
  const environment = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!, gl = canvas.getContext('webgl2'), extension = gl?.getExtension('WEBGL_debug_renderer_info');
    const p = window.__SS__!.perf();
    return { recordedAt: new Date().toISOString(), quality: p.quality.tier, backend: p.backend, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      gpu: extension ? gl!.getParameter(extension.UNMASKED_RENDERER_WEBGL) as string : null, drawCalls: p.drawCalls, triangles: p.triangles };
  });
  const proof = { level, phase, throttle: 4, frameP95: q(samples.map(s => s.frame)), simP95: q(samples.filter(s => s.ticks > 0).map(s => s.sim)),
    updateP95: q(samples.map(s => s.update)), renderP95: q(samples.map(s => s.render)), peakActors: Math.max(...samples.map(s => s.actors)), costs,
    environment, hostLoadStart, hostLoadEnd, localVitestStart, localVitestEnd, otherHeadlessChromeStart, otherHeadlessChromeEnd,
    endLevel: await page.evaluate(() => window.__SS__!.getState().scenario),
    audio: await page.evaluate(() => window.__SS__!.audio.snapshot()), samples };
  writeFileSync(`${dir}/${phase}-${level}.json`, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ ...proof, samples: undefined, audio: undefined }));
  expect(proof.endLevel).toBe(level);
  expect(localVitestStart, 'Timing must start without local Vitest').toEqual([]);
  expect(localVitestEnd, 'Local Vitest started during timing; repeat in a quiet window').toEqual([]);
  expect(otherHeadlessChromeStart, 'Timing must start without another headless browser').toEqual([]);
  expect(otherHeadlessChromeEnd, 'Another headless browser started during timing; repeat in a quiet window').toEqual([]);
  expect(environment.quality).toBe('low'); expect(environment.backend).toBe('webgl');
  expect(environment.gpu).toBeTruthy(); expect(environment.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
  expect(samples.filter(s => s.ticks > 0).length).toBeGreaterThan(100);
  expect(proof.simP95).toBeGreaterThan(0);
  if (phase !== 'before') { expect(proof.frameP95).toBeLessThanOrEqual(33); expect(proof.simP95).toBeLessThanOrEqual(6); }
});
