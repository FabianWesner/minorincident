import { boot, expect, test } from './fixtures';
for (const device of ['keyboard', 'middle-click'] as const) {
  test(`T-E11-01-${device} @E11 @E11-AC01 real ${device} completes instantly and unload clears the prompt`, async ({ page }) => {
    await boot(page);
    await page.evaluate(async () => { const api = window.__SS__!; await api.loadScenario('interact-yard'); api.pause(); await api.screenshotReady(); });
    if (device === 'keyboard') await page.keyboard.press('e');
    else {
      const p = await page.evaluate(() => window.__SS__!.input.project({ x: 0, z: 0 }));
      await page.mouse.click(p.x, p.y, { button: 'middle' });
    }
    await page.evaluate(() => window.__SS__!.step(1));
    const completions = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'interact.completed'));
    expect(completions).toHaveLength(1); expect(completions[0]).toMatchObject({ kind: 'generator', tick: 1 });
    await page.evaluate(() => window.__SS__!.step(120));
    expect(await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'interact.completed').length)).toBe(1);
    await page.evaluate(() => window.__SS__!.unloadScenario());
    await expect(page.getByTestId('interaction-prompt')).toHaveCount(0);
    expect(await page.evaluate(() => window.__SS__!.getState().perf)).toMatchObject({ entities: 0, bodies: 0, colliders: 0, listeners: 0 });
  });
}
