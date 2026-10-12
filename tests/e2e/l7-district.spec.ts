import { boot, expect, test } from './fixtures';
test('T-E29-10-district-browser @E29-AC10 persistent W6 fires and late civilian models survive staged loading', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page, '/?test=1&renderer=webgl&quality=high&audio=muted');
  const result = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L7', { seed: 29 }); a.pause();
    const count = () => a.query({ kind: 'hazard' }).filter(e => e.hazard?.kind === 'fire' && e.hazard.activeUntil > a.tick()).length;
    const before = count(); a.cheats.god(true); await a.step(240);
    const after = count(), id = a.npcs.civilian('cashier', { x: 273, z: 18 }, { waypoints: [{ x: 273, z: 18 }] });
    a.teleport(id, { x: 273, z: 18 });
    a.camera.cinematic({ position: [288, 22, 33], target: [273, 3.9, 18] }, true); await a.step(2); await a.screenshotReady(); await a.step(2);
    await new Promise(r => requestAnimationFrame(r));
    return { before, after, id };
  });
  console.log(JSON.stringify(result));
  expect(result.before).toBe(22); expect(result.after).toBe(22); await expect.poll(async () => {
    await page.evaluate(() => window.__SS__!.step(0));
    await page.waitForTimeout(100);
    return page.evaluate(id => window.__SS__!.getState().render.npcs!.civilians.figures.some(f => f.id === id && f.drawn), result.id);
  }, { timeout: 30_000 }).toBe(true);
});
