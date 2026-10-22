import { mkdirSync } from 'node:fs';
import { test, expect, boot } from './fixtures';
// This matrix requires the requested native backend, including headless WebGPU.
test.use({ headless: true, launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] } });
for (const backend of ['webgl', 'webgpu']) for (const tier of ['high', 'low']) test(`@E24 PO34 service gate explains the crate task with one bar ${backend} ${tier}`, async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, `/?test=1&renderer=${backend}&quality=${tier}&audio=muted&dpr=1`);
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L6', { seed: 1, progression: 'L6-default' }); a.pause(); a.missions.begin(); a.cheats.god(true);
    a.missions.completeObjective('shelter'); a.missions.completeObjective('stop');
    const survivors = a.missions.state()!.l6!.survivors;
    for (const [index, r] of survivors.entries()) a.teleport(r.id, { x: 105 + index * 1.1, z: 15 });
    const unstaged = survivors.filter(r => a.getEntity(r.id)!.transform.x < 100);
    if (unstaged.length) throw new Error(`Gate fixture left ${unstaged.length} survivors behind`);
    // Inside both the open gate's beside-the-track stand zone and its closed repair zone.
    a.teleport(1, { x: 91.2, z: 16.15 }); a.input.set({ interact: true }); await a.step(70); a.input.clear(); await a.step(60); await a.screenshotReady();
  });
  const prompt = page.getByTestId('interaction-prompt');
  await expect(prompt).toContainText('Block the tunnel');
  await expect(prompt).toContainText('Push glowing crates onto the line');
  await expect(prompt.locator('[role="progressbar"]:visible')).toHaveCount(1);
  await expect(prompt.locator('[role="meter"]:visible')).toHaveCount(0);
  await expect(prompt).not.toContainText('coverage');
  mkdirSync('test-results/l6-po/gates', { recursive: true });
  await page.screenshot({ path: `test-results/l6-po/gates/${backend}-${tier}.png` });
  expect((await page.evaluate(() => window.__SS__!.getState().render.backend))).toBe(backend);
});
