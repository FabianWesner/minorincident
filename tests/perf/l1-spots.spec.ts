import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from '../e2e/fixtures';
import { menuStart } from '../e2e/ui-helpers';

// Match E18's native headless GPU measurement; run serially with transition budgets.
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
const output = 'test-results/epics/E19';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as { anchors: Record<string, { position: number[] }> };
for (const spot of ['l1-morning', 'l1-accident', 'l1-horde']) test(`T-E19-24 @E19 @E19-AC24 @perf high-tier budgets at ${spot}`, async ({ page, context }) => {
  test.setTimeout(180_000);
  await menuStart(page);
  const target = layout.anchors[`photo-${spot}`].position;
  await page.evaluate(async ({ spot, target }) => {
    const a = window.__SS__!; a.pause(); a.cheats.god(true);
    if (spot !== 'l1-morning') {
      // Setup the real accident, outside measurement; do not complete the level.
      a.cheats.completeObjective('pickup'); a.cheats.completeObjective('deliver');
      a.teleport('player', { x: target[0], z: target[2] });
      for (let i = 0; i < 60 && !a.events().some(e => e.type === 'l1.smoke'); i++) await a.step(30);
    }
    // Stress the specified populations, including actors outside the photo frustum.
    let civilians = a.getState().entities.filter(e => e.civilian).length;
    while (civilians++ < 60) a.npcs.civilian('cashier', { x: target[0] + civilians % 5, z: target[2] + 3 }, { waypoints: [{ x: target[0] + 5, z: target[2] + 5 }] });
    if (spot === 'l1-horde') {
      let infected = a.query({ kind: 'infected' }).filter(e => e.health.current > 0).length;
      while (infected < 30) {
        a.spawn('infected.runner', { x: target[0] + infected % 6 - 3, z: target[2] + Math.floor(infected / 6) }, { state: 'chase' }); infected++;
      }
    }
    a.camera.preset('D-GROVE/W0/' + spot); await a.step(0); await a.screenshotReady();
  }, { spot, target });
  const populations = await page.evaluate(() => ({ civilians: window.__SS__!.getState().entities.filter(e => e.civilian).length, infected: window.__SS__!.query({ kind: 'infected' }).filter(e => e.health.current > 0).length }));
  const proof = await page.evaluate(async () => {
    const a = window.__SS__!, frameMs: number[] = []; let previous = 0;
    a.resume(); const start = performance.now(), tick = a.tick();
    for (let i = 0; i < 720 || performance.now() - start < 12_000; i++) {
      const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
      if (i >= 120 && previous) frameMs.push(now - previous); previous = now;
    }
    a.pause(); const sorted = [...frameMs].sort((a, b) => a - b);
    return { frameMs, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], ticks: a.tick() - tick, perf: a.perf() };
  });
  const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage');
  const heap = await cdp.send('Runtime.getHeapUsage'); await cdp.detach();
  mkdirSync(output, { recursive: true });
  writeFileSync(`${output}/${spot}-budget.json`, JSON.stringify({ spot, populations, ...proof, collectedHeapBytes: heap.usedSize }, null, 2) + '\n');
  await page.screenshot({ path: `${output}/${spot}-budget.png` });
  expect(populations.civilians).toBeGreaterThanOrEqual(60);
  if (spot === 'l1-horde') expect(populations.infected).toBeGreaterThanOrEqual(30);
  expect(proof.perf.quality.tier).toBe('high'); expect(proof.ticks).toBeGreaterThanOrEqual(300);
  expect(Math.round(proof.p95Ms * 1e6) / 1e6).toBeLessThanOrEqual(16.7);
  expect(proof.perf.drawCalls).toBeLessThanOrEqual(600); expect(proof.perf.triangles).toBeLessThanOrEqual(1_500_000);
  expect(heap.usedSize).toBeLessThanOrEqual(400_000_000);
});
