import { test, expect, boot } from '../fixtures';
test.use({ launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu'] } });

import { l5Survivors } from '../../../src/data/l5';

for (const renderer of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) {
  test(`PO #26 #28 @E23 survivor health and moving radar dots ${renderer} ${quality} zoom ${zoom}`, async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page, `/?test=1&renderer=${renderer}&quality=${quality}&audio=muted&dpr=1&ui=1`);
    await page.evaluate(async quality => { const a = window.__SS__!; a.settings.set({ quality }); await a.loadLevel('L5', { seed: 1, progression: 'L5-default', tier: 5 }); a.pause(); }, quality);
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.cheats.god(true); a.cheats.completeObjective('emerge'); await a.step(661); });
    for (const key of ['rosa', 'dale']) {
      const def = l5Survivors.find(s => s.key === key)!;
      await page.evaluate(async at => { const a = window.__SS__!; a.teleport(1, { x: at[0], z: at[1] }); await a.step(65); }, def.ringAt);
    }
    const ids = await page.evaluate(async () => {
      const a = window.__SS__!; a.cheats.killAll(); a.teleport(1, { x: 10, z: -39 });
      const ids = a.missions.state()!.l5!.survivors.filter(r => r.status === 'following').map(r => r.id);
      ids.forEach((id, i) => { a.teleport(id, { x: 9 + i * 2, z: -38 }); a.npcs.health(id, i ? 18 : 36); });
      a.camera.follow(); await a.step(90); await a.screenshotReady(); return ids;
    });
    for (let i = 0; i < 20 && Math.abs(await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom as number) - zoom) > .02; i++) { await page.mouse.move(800, 450); await page.mouse.wheel(0, -120); await page.evaluate(() => window.__SS__!.step(2)); }
    await page.evaluate(async () => { await window.__SS__!.step(60); await window.__SS__!.screenshotReady(); });
    expect(await page.evaluate(() => window.__SS__!.getState().render.camera.zoom as number)).toBeCloseTo(zoom, 2);
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(renderer);
    expect(await page.evaluate(() => window.__SS__!.perf().quality.tier)).toBe(quality);
    await expect(page.locator('.hud-pin-follower:visible')).toHaveCount(2);
    await expect(page.locator('.hud-survivor-card:visible')).toHaveCount(2);
    const fractions = await page.evaluate(ids => ids.map(id => window.__SS__!.getState().render.healthBars!.bars.find(b => b.id === id)?.fraction), ids);
    expect(fractions).toEqual([.6, .3]);
    await expect(page.getByTestId('survivor-dale').getByRole('meter')).toHaveAttribute('aria-valuenow', '60');
    await expect(page.getByTestId('survivor-rosa').getByRole('meter')).toHaveAttribute('aria-valuenow', '30');
    await page.screenshot({ path: `test-results/l5-po-2/health-radar-${renderer}-${quality}-z${zoom}.png` });
    const dot = page.locator(`.hud-pin-follower[data-entity-id="${ids[0]}"]`);
    const before = await dot.getAttribute('data-world-x');
    await page.evaluate(async id => { const a = window.__SS__!; a.teleport(id, { x: -28, z: -39 }); await a.step(1); await a.screenshotReady(); }, ids[0]);
    await expect(dot).toHaveAttribute('data-clamped', 'true');
    expect(await dot.getAttribute('data-world-x')).not.toBe(before);
    await page.evaluate(async id => { const a = window.__SS__!; a.npcs.health(id, 0); await a.step(2); await a.screenshotReady(); }, ids[0]);
    await expect(page.locator('.hud-pin-follower:visible')).toHaveCount(1);
    await expect(page.locator('.hud-survivor-card:visible')).toHaveCount(1);
  });
}
