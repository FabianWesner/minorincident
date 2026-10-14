import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '../e2e/fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });

for (const tier of ['high', 'low'] as const) test(`T-E32-07-render-${tier} @E32 @E32-AC07 @E32-AC09 @E18-AC01 @perf seeded dog coats and pounce telegraphs retain mixed-horde budgets`, async ({ page, context }) => {
  test.setTimeout(180_000);
  const cap = tier === 'high' ? 200 : 100, alphas = tier === 'high' ? 3 : 2;
  const spec: SceneSpec = {
    name: `l10-alpha-dog-budget-${tier}`, seed: 10, ground: 'asphalt', size: 64, time: 'L4', dof: false, infectedCap: 200,
    actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }],
    camera: { mode: 'game', target: [0, 0], zoom: 1 },
  };
  await page.goto(`/?test=1&scenelab&renderer=webgl&quality=${tier}&audio=muted&profile=1&dpr=1`);
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  const proof = await page.evaluate(async ({ spec, cap, alphas }) => {
    const api = window.__SS__!, lab = window.__SCENE__!; await api.ready; await lab.load(spec);
    // Production spawns avoid Scene Lab's per-actor pose/clipping probes in native timing and heap measurements.
    for (let i = 0; i < cap - alphas - 12; i++) { const angle = i * 2.399963; api.spawn('infected.runner', { x: Math.cos(angle) * 20, z: Math.sin(angle) * 20 }, { state: 'chase' }); }
    for (let i = 0; i < 12; i++) { const angle = i * Math.PI / 6; api.spawn('infected.dog', { x: Math.cos(angle) * 3, z: Math.sin(angle) * 3 }, { state: 'chase' }); }
    for (let i = 0; i < alphas; i++) api.spawn('infected.alpha', { x: 6, z: (i - 1) * 3 }, { state: 'chase' });
    await lab.step(12); await lab.ready();
    return { perf: api.perf(), state: api.getState() };
  }, { spec, cap, alphas });
  expect(proof.state.ai!.count).toBe(cap);
  const dogs = proof.state.entities.filter(e => e.archetype === 'infected.dog');
  expect(new Set(dogs.map(e => e.infected!.variant))).toEqual(new Set(['inf.dog', 'inf.dog.black', 'inf.dog.cream']));
  const crowd = proof.state.render.crowd!;
  for (const model of ['inf.dog', 'inf.dog.black', 'inf.dog.cream']) {
    expect(crowd.batches.some(b => b.id === model && b.instances > 0 && b.source === 'glb')).toBe(true);
  }
  expect(crowd.telegraphs[1]).toBeGreaterThan(0);
  expect(crowd.meshDrawCalls).toBeLessThanOrEqual(30);
  expect(crowd.nonInstancedMeshes).toBe(0);
  expect(proof.perf.drawCalls).toBeLessThanOrEqual(tier === 'high' ? 600 : 300);
  expect(proof.perf.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
  const timing = await page.evaluate(async () => {
    const api = window.__SS__!, frames: number[] = [], sims: number[] = []; api.resume();
    let previous = 0, draws = 0, triangles = 0; const start = performance.now();
    while (performance.now() - start < 10_000) {
      const now = await new Promise<number>(resolve => requestAnimationFrame(resolve)), perf = api.perf();
      if (performance.now() - start > 2000) { if (previous) frames.push(now - previous); if (perf.simTicks > 0) sims.push(perf.simTickMs); }
      previous = now; draws = Math.max(draws, perf.drawCalls); triangles = Math.max(triangles, perf.triangles);
    }
    api.pause(); const p95 = (values: number[]) => values.sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
    const gl = document.querySelector('canvas')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { frameP95: p95(frames), simP95: p95(sims), simSamples: sims.length, draws, triangles, gpu: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null };
  });
  const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage'); const heap = await cdp.send('Runtime.getHeapUsage');
  expect(timing.gpu).not.toMatch(/swiftshader|software|llvmpipe/i);
  expect(timing.simSamples).toBeGreaterThan(100);
  expect(timing.frameP95).toBeLessThanOrEqual(tier === 'high' ? 16.7 : 33.3);
  expect(timing.simP95).toBeLessThanOrEqual(tier === 'high' ? 4 : 6);
  expect(timing.draws).toBeLessThanOrEqual(tier === 'high' ? 600 : 300);
  expect(timing.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
  expect(heap.usedSize).toBeLessThanOrEqual((tier === 'high' ? 400 : 250) * 1_000_000);
  mkdirSync('test-results/epics/E32/l10-alpha-contracts', { recursive: true });
  writeFileSync(`test-results/epics/E32/l10-alpha-contracts/render-${tier}.json`, JSON.stringify({ ...proof, timing, retainedHeapBytes: heap.usedSize }, null, 2));
});
