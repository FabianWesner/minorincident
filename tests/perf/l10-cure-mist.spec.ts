import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../e2e/fixtures';
import type { MissionState } from '../../src/sim/missions/types';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

// Native GPU measurements run only through quiet-run on the Mac, at most two workers.
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) for (const zoom of [1, .5]) test(`T-E32-31-S8 @E32-AC23 @E32-AC24 @E32-AC31 @perf cure mist ${tier} zoom ${zoom}`, async ({ page, context }) => {
  test.setTimeout(180_000);
  const spec = JSON.parse(readFileSync('tests/scenes/catalog/l10-cure-mist.json', 'utf8')) as SceneSpec;
  if (spec.camera?.mode === 'game') spec.camera.zoom = zoom;
  await boot(page, `/?test=1&scenelab&renderer=webgl&quality=${tier}&audio=muted&dpr=1&profile=1`);
  await page.waitForFunction(() => !!window.__SCENE__);
  const initial = await page.evaluate(async ({ spec, cap }) => {
    const a = window.__SS__!, lab = window.__SCENE__!; await lab.load(spec);
    // Fill the director to its cap: a crow flock weighs 0.25 per bird, so entity count != cap weight (L10-Q2 mist adds one).
    let full = false;
    for (let i = 0; i < cap && !full; i++) { const angle = i * 2.399963, radius = 16 + (i % 5) * 3; try { a.spawn('infected.runner', { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }, { state: 'chase' }); } catch (e) { if (String(e).includes('concurrency cap')) full = true; else throw e; } }
    await a.audio.unlock();
    await lab.step(300); await a.screenshotReady();
    const state = a.getState(), audio = a.audio.snapshot();
    return { full, state, audio, fan: a.audio.emitters().filter(v => v.cue === 'generator.idle'), perf: a.perf() };
  }, { spec, cap: tier === 'high' ? 200 : 100 });
  expect((initial.state.mission as MissionState).states['cure-released']).toBe(true);
  expect((initial.state.mission as MissionState).cureFront!.radius).toBeGreaterThan(40);
  expect(initial.fan).toHaveLength(1); expect(initial.fan[0].loop).toBe(true);
  expect(initial.full, 'mist runs at the full infected cap').toBe(true);
  expect(initial.state.entities.filter(e => e.infected).length).toBeGreaterThan(tier === 'high' ? 180 : 80);
  expect(initial.state.entities.filter(e => e.infected).every(e => e.health.current === 0)).toBe(true);
  expect(initial.state.player!.health.current).toBeGreaterThan(0);
  const timing = await page.evaluate(async () => {
    const a = window.__SS__!, frames: number[] = [], sim: number[] = [];
    let previous = 0, draws = 0, triangles = 0, voices = 0, puffs = 0;
    a.resume(); const start = performance.now();
    while (performance.now() - start < 12_000) {
      const now = await new Promise<number>(resolve => requestAnimationFrame(resolve)), p = a.perf();
      if (performance.now() - start > 2000) { if (previous) frames.push(now - previous); if (p.simTicks > 0) sim.push(p.simTickMs); }
      previous = now; draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles);
      voices = Math.max(voices, a.audio.snapshot().voices); puffs = Math.max(puffs, p.effects?.blasts.puffs ?? 0);
    }
    a.pause();
    const gl = document.querySelector('canvas')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
    const p95 = (values: number[]) => values.sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
    return { frameP95: p95(frames), simP95: p95(sim), simSamples: sim.length, draws, triangles, voices, puffs, fanCues: a.audio.snapshot().cues.filter(c => c.cue === 'generator.idle').length, fan: a.audio.emitters().filter(v => v.cue === 'generator.idle').length, gpu: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null };
  });
  const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage'); const heap = await cdp.send('Runtime.getHeapUsage');
  mkdirSync('test-results/l10-s8/perf', { recursive: true });
  writeFileSync(`test-results/l10-s8/perf/${tier}-z${zoom}.json`, JSON.stringify({ initial, timing, heap }, null, 2));
  await page.screenshot({ path: `test-results/l10-s8/perf/${tier}-z${zoom}.png` });
  expect(timing.gpu).not.toMatch(/swiftshader|software|llvmpipe/i);
  expect(timing.simSamples).toBeGreaterThan(100);
  expect(timing.frameP95).toBeLessThanOrEqual(tier === 'high' ? 16.7 : 33.3);
  expect(timing.simP95).toBeLessThanOrEqual(tier === 'high' ? 4 : 6);
  expect(timing.draws).toBeLessThanOrEqual(tier === 'high' ? 600 : 300);
  expect(timing.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
  expect(timing.voices).toBeLessThanOrEqual(tier === 'high' ? 32 : 16);
  expect(timing.puffs).toBeGreaterThan(0); expect(timing.puffs).toBeLessThanOrEqual(tier === 'high' ? 400 : 120);
  expect(timing.fanCues).toBe(1); expect(timing.fan).toBe(1);
  expect(heap.usedSize).toBeLessThanOrEqual((tier === 'high' ? 400 : 250) * 1_000_000);
});
