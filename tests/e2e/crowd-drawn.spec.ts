import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { boot, expect, test, testUrl } from './fixtures';

// P0 guard (PROD "all other players are invisible"): on WebGPU the civilian crowd pipeline needed 9 vertex buffers
// (limit 8), so every pedestrian vanished while hand props and shadows still drew, and the CPU crowd probe still said
// "drawn". This checks real pixels on both backends: each on-screen pedestrian's head/torso must change when that
// pedestrian is moved off screen. Props are hand-height, so they cannot satisfy the check. The error guard fails the
// test on any WebGPU pipeline-validation error.
test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });

for (const renderer of ['webgl', 'webgpu'] as const) {
  test(`T-E07-crowd-drawn-${renderer} @smoke @E07 L1 start pedestrians are drawn on screen (${renderer}), not only their props`, async ({ page }) => {
    test.setTimeout(120_000);
    if (renderer === 'webgpu') {
      await page.goto('/');
      const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
      // Headless Chromium on macOS (Metal) exposes a real WebGPU adapter; elsewhere it may not.
      test.skip(!adapter && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
    }
    await boot(page, testUrl.replace('renderer=webgl', `renderer=${renderer}`));
    const before = await page.evaluate(async () => {
      const a = window.__SS__!;
      await a.loadLevel('L1', { seed: 1 }); a.missions.begin(); a.pause(); a.camera.follow();
      // Bring a handful of the routine pedestrians (props and all) onto the sidewalk around the start position.
      const player = a.query({ kind: 'player' })[0].transform;
      for (const [i, c] of a.query({ kind: 'civilian' }).filter(e => !e.hidden && !e.civilian?.pet && e.civilian?.adult !== false && e.civilian?.state === 'calm').slice(0, 6).entries())
        a.teleport(c.id, { x: player.x - 4 + (i % 3) * 3, z: player.z + 3 + Math.floor(i / 3) * 3 });
      await a.step(30); await a.screenshotReady();
      // Entity transforms sit .7 m above the feet (the crowd draws at y - .7): head ~ +.9, chest ~ +.5.
      const civilians = a.query({ kind: 'civilian' }).filter(e => !e.hidden && !e.civilian?.pet && e.civilian?.adult !== false && e.civilian?.state === 'calm' && e.health.current > 0).map(e => ({
        id: e.id, head: a.camera.project(e.transform.x, e.transform.y + .95, e.transform.z), chest: a.camera.project(e.transform.x, e.transform.y + .45, e.transform.z),
      })).filter(c => Math.abs(c.head[0]) < .85 && Math.abs(c.head[1]) < .85 && Math.abs(c.chest[1]) < .7 && c.head[2] < 1);
      return { civilians, backend: a.perf().backend, drawn: a.crowdFigures().filter(f => f.drawn).length };
    });
    const dir = `test-results/epics/E07/crowd-drawn`; mkdirSync(dir, { recursive: true });
    const shown = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${dir}/l1-${renderer}.png` }));
    await page.evaluate(async (ids) => {
      const a = window.__SS__!;
      ids.forEach((id, i) => a.teleport(id, { x: -400 - i * 3, z: -400 }));
      await a.step(2); await a.screenshotReady();
    }, before.civilians.map(c => c.id));
    const hidden = PNG.sync.read(await page.locator('canvas').screenshot());
    const results = before.civilians.map(c => {
      const cx = Math.round((c.head[0] + 1) / 2 * shown.width), top = Math.round((1 - c.head[1]) / 2 * shown.height);
      const bottom = Math.round((1 - c.chest[1]) / 2 * shown.height), half = Math.max(3, Math.round((bottom - top) / 4));
      let changed = 0;
      for (let y = Math.max(0, top); y < Math.min(shown.height, bottom); y++) for (let x = Math.max(0, cx - half); x < Math.min(shown.width, cx + half); x++) {
        const i = (y * shown.width + x) * 4;
        if (Math.abs(shown.data[i] - hidden.data[i]) + Math.abs(shown.data[i + 1] - hidden.data[i + 1]) + Math.abs(shown.data[i + 2] - hidden.data[i + 2]) > 24) changed++;
      }
      return { id: c.id, changed, area: (bottom - top) * half * 2 };
    });
    const drawnBodies = results.filter(r => r.changed >= r.area * .25).length;
    writeFileSync(`${dir}/l1-${renderer}.json`, JSON.stringify({ ...before, results, drawnBodies }, null, 2) + '\n');
    expect(before.backend).toBe(renderer);
    expect(before.civilians.length, 'pedestrians in the L1 start view').toBeGreaterThanOrEqual(3);
    expect(drawnBodies, 'pedestrian heads/torsos actually rendered').toBe(before.civilians.length);
  });
}
