import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test, testUrl } from './fixtures';

test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });
for (const renderer of ['webgl', 'webgpu'] as const) for (const quality of ['low', 'high'] as const) {
  const prefix = quality === 'low' ? renderer : `${renderer}-high`;
  test(`small-figure L2 seed 1 ${quality} ${renderer} @E08`, async ({ page }) => {
    test.setTimeout(180_000);
    if (renderer === 'webgpu') {
      await page.goto('/');
      const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
      test.skip(!adapter && process.platform !== 'darwin', 'No headless WebGPU adapter');
    }
    await boot(page, testUrl.replace('renderer=webgl', `renderer=${renderer}`).replace('quality=high', `quality=${quality}`));
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
    writeFileSync(`${dir}/${prefix}.json`, JSON.stringify(result, null, 2) + '\n');
    await page.locator('canvas').screenshot({ path: `${dir}/${prefix}-game.png` });
    // The PO supplied a still, not an input recording. Also stage the exact faulty spawn combination beside the
    // courier at that spot, so the child/adult read and submitted instance scale are reproducible.
    const comparison = await page.evaluate(async () => {
      const a = window.__SS__!;
      a.teleport('player', { x: -50.02, z: -32.70 });
      const id = a.npcs.civilian('cashier', { x: -53, z: -33 }, { child: true, model: 'npc.civilian-woman-b', waypoints: [{ x: -53, z: -33 }, { x: -52, z: -33 }] });
      await a.step(20); await a.screenshotReady();
      return { entity: a.getEntity(id), figures: a.crowdFigures().filter(f => f.id === id) };
    });
    writeFileSync(`${dir}/${prefix}-comparison.json`, JSON.stringify(comparison, null, 2) + '\n');
    await page.locator('canvas').screenshot({ path: `${dir}/${prefix}-comparison.png` });
    expect(result.backend).toBe(renderer);
    for (const child of result.children) expect(child.appearance?.asset).toBe('npc.civilian-kid');
    expect(comparison.entity?.civilian?.model).toBe('npc.civilian-kid');
    expect(comparison.figures.some(f => f.drawn)).toBe(true);
    for (const figure of comparison.figures) {
      expect(figure.scale).toHaveLength(3);
      for (const scale of figure.scale!) expect(scale).toBeCloseTo(1, 6);
    }
  });
}
