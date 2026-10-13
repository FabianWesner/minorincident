import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

// Native cadence on the Mac GPU, under quiet-run's exclusive browser reservation.
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const backend of ['webgl', 'webgpu'] as const) for (const tier of ['high', 'low'] as const) test(`T-E31-19-D2 @E31-AC19 @perf dressed regions ${backend} ${tier} E18 at every game zoom`, async ({ page, context }) => {
  test.setTimeout(300_000);
  if (tier === 'low') {
    await page.setViewportSize({ width: 390, height: 844 });
    const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await boot(page, `/?test=1&scenelab=1${backend === 'webgl' ? '&renderer=webgl' : ''}&quality=${tier}&audio=muted&dpr=1`);
  const rows = [];
  for (const region of ['fork', 'road', 'countryside', 'dry', 'approach']) for (const zoom of [.5, 1, 1.5]) {
    const scene = JSON.parse(readFileSync(`tests/scenes/catalog/l9-dress-${region}.json`, 'utf8')) as SceneSpec;
    if (scene.camera?.mode !== 'game' || !Array.isArray(scene.camera.target)) throw new Error('D2 scenes need an authored game camera target');
    scene.camera = { ...scene.camera, zoom };
    // Populate the current region to the E18 tier cap, using the existing crowd pipeline.
    const [x, z] = scene.camera.target as [number, number], count = tier === 'high' ? 200 : 100;
    // Scene Lab defines the high-tier cap; low quality applies its existing 50% limit.
    scene.infectedCap = 200;
    scene.actors = Array.from({ length: count }, (_, i) => ({ id: `infected-${i}`, kind: 'infected', at: [x - 20 + i % 20 * 2, z + 14 + Math.floor(i / 20) * 2], state: 'idle' }));
    const result = await page.evaluate(async scene => {
      const a = window.__SS__!, lab = window.__SCENE__!;
      await lab.load(scene); await lab.ready(); a.resume();
      const warm = performance.now(); while (performance.now() - warm < 3000) await new Promise(r => requestAnimationFrame(r));
      const frames: number[] = [], sims: number[] = []; let previous = 0, draws = 0, triangles = 0, infected = 0, resident = 0;
      const start = performance.now();
      while (performance.now() - start < 3000) {
        const now = await new Promise<number>(r => requestAnimationFrame(r)), p = a.perf();
        if (previous) frames.push(now - previous); previous = now;
        if (p.simTickMs > 0) sims.push(p.simTickMs);
        draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles);
        infected = Math.max(infected, p.infected?.count ?? 0); resident = Math.max(resident, p.terrain?.resident ?? 0);
      }
      a.pause(); const p95 = (v: number[]) => v.sort((a,b) => a-b)[Math.ceil(v.length * .95)-1];
      return { backend: a.perf().backend, frameP95: p95(frames), simP95: p95(sims), draws, triangles, infected, resident };
    }, scene);
    const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage'); const heap = await cdp.send('Runtime.getHeapUsage'); await cdp.detach();
    const row = { region, zoom, ...result, heapMB: heap.usedSize / 1e6 }; rows.push(row);
    const out = 'test-results/epics/E31/D2/perf'; mkdirSync(out, { recursive: true }); writeFileSync(`${out}/${backend}-${tier}.json`, JSON.stringify(rows, null, 2));
    expect.soft(row.backend, `${region} z${zoom} renderer`).toBe(backend);
    expect.soft(row.infected, `${region} z${zoom} populated`).toBe(count);
    expect.soft(row.draws, `${region} z${zoom} draws`).toBeLessThanOrEqual(tier === 'high' ? 600 : 300);
    expect.soft(row.triangles, `${region} z${zoom} triangles`).toBeLessThanOrEqual(tier === 'high' ? 1500000 : 500000);
    expect.soft(row.frameP95, `${region} z${zoom} frame`).toBeLessThanOrEqual(tier === 'high' ? 16.7 : 33.3);
    expect.soft(row.simP95, `${region} z${zoom} sim`).toBeLessThanOrEqual(tier === 'high' ? 4 : 6);
    expect.soft(row.heapMB, `${region} z${zoom} heap`).toBeLessThanOrEqual(tier === 'high' ? 400 : 250);
    expect.soft(row.resident, `${region} z${zoom} chunks`).toBeLessThanOrEqual(tier === 'high' ? 25 : 9);
  }
});
