import { test, expect, boot } from './fixtures';
for (const backend of ['webgl', 'webgpu']) for (const tier of ['high', 'low']) test(`@E24 PO34 service gate explains the crate task with one bar ${backend} ${tier}`, async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, `/?test=1&renderer=${backend}&quality=${tier}&audio=muted&dpr=1`);
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L6', { seed: 1, progression: 'L6-default' }); a.pause(); a.missions.begin(); a.cheats.god(true);
    a.missions.completeObjective('shelter'); a.missions.completeObjective('stop');
    for (const r of a.missions.state()!.l6!.survivors) a.teleport(r.id, { x: 105, z: 15 });
    a.teleport(1, { x: 91.3, z: 15 }); a.input.set({ interact: true }); await a.step(70); a.input.clear(); await a.step(60); await a.screenshotReady();
  });
  const prompt = page.getByTestId('interaction-prompt');
  await expect(prompt).toContainText('Block the tunnel');
  await expect(prompt).toContainText('Push glowing crates onto the line');
  await expect(prompt.locator('[role="progressbar"]:visible')).toHaveCount(1);
  await expect(prompt.locator('[role="meter"]:visible')).toHaveCount(0);
  await expect(prompt).not.toContainText('coverage');
  expect((await page.evaluate(() => window.__SS__!.getState().render.backend))).toBe(backend);
});
