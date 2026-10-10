import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test, testUrl } from './fixtures';

test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });
for (const renderer of ['webgl', 'webgpu'] as const) {
  test(`small-figure L2 seed 1 low ${renderer}`, async ({ page }) => {
    test.setTimeout(180_000);
    if (renderer === 'webgpu') {
      await page.goto('/');
      const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
      test.skip(!adapter && process.platform !== 'darwin', 'No headless WebGPU adapter');
    }
    await boot(page, testUrl.replace('renderer=webgl', `renderer=${renderer}`).replace('quality=high', 'quality=low'));
    const result = await page.evaluate(async () => {
      const a = window.__SS__!;
      await a.loadLevel('L2', { seed: 1, checkpoint: 'doors' });
      a.missions.begin();
      a.pause(); a.cheats.god(true); a.camera.follow(); a.debug.figureJoints(true);
      a.teleport('player', { x: -50.02, z: -32.70 });
      await a.step(Math.max(0, 5634 - a.tick())); await a.screenshotReady();
      return { tick: a.tick(), backend: a.perf().backend,
        nearby: a.query({ within: { x: -50, z: -33, r: 15 } }),
        children: a.query({ kind: 'civilian' }).filter(e => e.civilian?.adult === false),
        figures: a.crowdFigures() };
    });
    const dir = 'test-results/small-figure'; mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${renderer}.json`, JSON.stringify(result, null, 2) + '\n');
    await page.locator('canvas').screenshot({ path: `${dir}/${renderer}-game.png` });
    expect(result.backend).toBe(renderer);
    for (const child of result.children) expect(child.appearance?.asset).toBe('npc.civilian-kid');
  });
}
