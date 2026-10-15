import { test, expect, boot } from '../fixtures';
test.use({ launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu'] } });

import { l5Survivors } from '../../../src/data/l5';

for (const renderer of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) {
  test(`PO #26 @E23 survivor health and moving radar dots ${renderer} ${quality} zoom ${zoom}`, async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page, `/?test=1&renderer=${renderer}&quality=${quality}&audio=muted&dpr=1&ui=1`);
    await page.evaluate(async quality => { const a = window.__SS__!; await a.loadLevel('L5', { seed: 1, progression: 'L5-default', tier: 5 }); a.pause(); }, quality);
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.cheats.god(true); a.cheats.completeObjective('emerge'); await a.step(661); });
    for (const key of ['rosa', 'dale']) {
      const def = l5Survivors.find(s => s.key === key)!;
      await page.evaluate(async at => { const a = window.__SS__!; a.teleport(1, { x: at[0], z: at[1] }); await a.step(65); }, def.ringAt);
    }
    const ids = await page.evaluate(async () => {
      const a = window.__SS__!; a.cheats.killAll(); a.teleport(1, { x: 10, z: -39 });
      const ids = a.missions.state()!.l5!.survivors.filter(r => r.status === 'following').map(r => r.id);
      ids.forEach((id, i) => { a.teleport(id, { x: 7 - i * 2, z: -39 }); a.interact.hit(id, i ? 42 : 24, 'explosive'); });
      await a.step(2); a.camera.follow(); await a.screenshotReady(); return ids;
    });
    for (let i = 0; i < 20 && Math.abs(await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom as number) - zoom) > .02; i++) { await page.mouse.move(800, 450); await page.mouse.wheel(0, -120); await page.evaluate(() => window.__SS__!.step(2)); }
    await page.evaluate(() => window.__SS__!.screenshotReady());
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(renderer);
    await expect(page.locator('.hud-survivor-card:visible')).toHaveCount(2);
    expect(await page.evaluate(ids => window.__SS__!.getState().render.healthBars!.bars.filter(b => ids.includes(b.id)).length, ids)).toBe(2);
    await page.screenshot({ path: `test-results/l5-po-2/health-radar-${renderer}-${quality}-z${zoom}.png` });
  });
}
