import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';

const webgpu = process.env.L6_EXIT_WEBGPU === '1';
if (webgpu) test.use({ launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] } });
for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) test(`T-E24-exit-input @E24-AC17 ${quality} zoom ${zoom}: last barricade to raised exit and L7`, async ({ page }) => {
  test.setTimeout(180_000);
  const out = `test-results/l6-exit-stall/${webgpu ? 'webgpu' : 'webgl2'}-${quality}-z${zoom}`;
  mkdirSync(out, { recursive: true });
  await boot(page, `/?test=1&ui=1&${webgpu ? '' : 'renderer=webgl&'}quality=${quality}&audio=muted&dpr=1`);
  await page.evaluate(async quality => {
    const a = window.__SS__!;
    await a.loadLevel('L6', { seed: 1, progression: 'L6-default' }); a.settings.set({ quality }); a.pause(); a.missions.begin();
    // Focused fixture starts just beyond the last barricade. Every subsequent move uses physical keys.
    a.cheats.completeObjective('shelter'); a.cheats.completeObjective('stop'); a.cheats.completeObjective('retreat');
    a.missions.state()!.l6!.survivors.forEach((r, i) => a.teleport(r.id, { x: 266 + Math.floor(i / 3) * .8, z: 15 + (i % 3 - 1) * .8 }));
    a.teleport(1, { x: 214, z: 15 }); a.camera.follow(); await a.step(1);
  }, quality);
  if (zoom === .5) { await page.mouse.move(800, 450); for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -120); await page.evaluate(() => window.__SS__!.step(1)); } await page.evaluate(() => window.__SS__!.step(30)); }
  expect(await page.evaluate(() => window.__SS__!.getState().render.camera.zoom)).toBeCloseTo(zoom, 2);
  const trace = [], shots = new Set<string>();
  await page.keyboard.down('s'); await page.keyboard.down('d');
  for (let i = 0; i < 180; i++) {
    await page.evaluate(() => window.__SS__!.step(12));
    const row = await page.evaluate(() => ({ tick: window.__SS__!.tick(), p: window.__SS__!.getEntity(1)!.transform, phase: window.__SS__!.missions.state()!.phase }));
    trace.push(row);
    for (const [name, x] of [['foot', 246], ['ascent', 252], ['landing', 259]] as const) if (row.p.x >= x && !shots.has(name)) {
      await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/${name}.png` }); shots.add(name);
    }
    if (row.phase === 'result') break;
  }
  await page.keyboard.up('s'); await page.keyboard.up('d');
  writeFileSync(`${out}/trace.json`, JSON.stringify(trace, null, 2));
  expect(shots.size).toBe(3);
  expect(trace.some(r => r.p.x > 259 && r.p.y > 4.5)).toBe(true);
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.phase)).toBe('result');
  expect(await page.evaluate(() => window.__SS__!.getState().render.backend)).toBe(webgpu ? 'webgpu' : 'webgl');
  expect(await page.evaluate(() => window.__SS__!.perf().quality.tier)).toBe(quality);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForFunction(() => window.__SS__!.getState().scenario === 'L7');
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('night-exit');
  await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/l7.png` });
});
