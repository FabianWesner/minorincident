import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../e2e/fixtures';
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const backend of ['webgl', 'webgpu'] as const) for (const quality of ['high','low'] as const) for (const zoom of [1, .5]) test(`@perf @E32-AC31 D3 R5/R6 and seams ${backend} ${quality} zoom ${zoom} E18 budgets`, async ({ page, context }) => {
  test.setTimeout(180_000);
  await boot(page, `/?test=1${backend === 'webgl' ? '&renderer=webgl' : ''}&quality=${quality}&audio=muted&dpr=1`);
  await page.evaluate(async () => { await window.__SS__!.loadLevel('L10', { seed: 32 }); });
  if (zoom === .5) {
    const viewport = page.viewportSize()!; await page.mouse.move(viewport.width / 2, viewport.height / 2);
    for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100);
  }
  const result = await page.evaluate(async quality => {
    const a = window.__SS__!;
    const rows: { x: number; z: number; cameraZoom: number; frameP95: number; simP95: number }[] = [];
    const p95 = (v: number[]) => v.sort((a,b) => a-b)[Math.ceil(v.length * .95)-1];
    let draws = 0, triangles = 0, peak = 0, resident = 0;
    const spots = [{x:2467,z:-5},{x:2707,z:45},{x:2807,z:45},{x:2917,z:-5},{x:2937,z:-5},{x:3317,z:95},{x:3697,z:-25}];
    for (const spot of spots) {
      a.teleport('player', spot); a.camera.follow(); a.resume();
      await a.screenshotReady();
      const warm = performance.now(); while (performance.now() - warm < 2000) await new Promise(r => requestAnimationFrame(r));
      const frames: number[] = [], sims: number[] = [];
      let previous = 0; const start = performance.now();
      while (performance.now() - start < 3000) {
        const now = await new Promise<number>(r => requestAnimationFrame(r)), p = a.perf();
        if (previous) frames.push(Math.round((now - previous) * 1e9) / 1e9); previous = now;
        if (p.simTickMs > 0) sims.push(p.simTickMs);
        draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles); peak = Math.max(peak, p.infected?.count ?? 0);
        resident = Math.max(resident, p.terrain?.resident ?? 0);
      }
      a.pause();
      rows.push({ ...spot, cameraZoom: a.getState().render.camera.zoom, frameP95: p95(frames), simP95: p95(sims) });
    }
    a.pause();
    return { quality, cameraZoom: a.getState().render.camera.zoom, backend: a.perf().backend, frameP95: Math.max(...rows.map(r => r.frameP95)), simP95: Math.max(...rows.map(r => r.simP95)), rows, draws, triangles, peak, resident };
  }, quality);
  const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage'); const heap = await cdp.send('Runtime.getHeapUsage');
  const heapMB = heap.usedSize / 1e6;
  mkdirSync('test-results/epics/E32/D3/perf', { recursive: true }); writeFileSync(`test-results/epics/E32/D3/perf/${backend}-${quality}-z${zoom}.json`, JSON.stringify({ ...result, zoom, heapMB }, null, 2));
  expect(result.backend).toBe(backend);
  for (const row of result.rows) expect(row.cameraZoom, `${row.x},${row.z} actual zoom`).toBeCloseTo(zoom, 2);
  expect(result.frameP95).toBeLessThanOrEqual(quality === 'low' ? 33.3 : 16.7); expect(result.simP95).toBeLessThanOrEqual(quality === 'low' ? 6 : 4);
  expect(result.draws).toBeLessThanOrEqual(quality === 'low' ? 300 : 600); expect(result.triangles).toBeLessThanOrEqual(quality === 'low' ? 500000 : 1500000);
  expect(result.resident).toBeLessThanOrEqual(quality === 'low' ? 9 : 25);
  expect(result.peak).toBeLessThanOrEqual(quality === 'low' ? 100 : 200); expect(heapMB).toBeLessThanOrEqual(quality === 'low' ? 250 : 400);
});
