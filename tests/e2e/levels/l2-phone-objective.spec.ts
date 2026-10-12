import { devices } from '@playwright/test';
import { PNG } from 'pngjs';
import { mkdirSync } from 'node:fs';
import { test, expect, boot } from '../fixtures';

test.use({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, trace: 'off' });

for (const quality of ['low', 'high'] as const) {
  test(`T-E20-phone-objective @E20 ${quality}: courier and axe objective have no dark pane cube`, async ({ page }) => {
    test.setTimeout(300_000);
    await boot(page, `/?test=1&renderer=webgl&dpr=1&quality=${quality}&audio=muted&seed=1&ui=1`);
    await page.evaluate(() => window.__SS__!.loadLevel('L2', { seed: 1, progression: 'L2-default' }));
    await page.evaluate(() => window.__SS__!.pause());
    // The progression preset applies phone auto quality: exercise each requested tier explicitly.
    await page.evaluate(quality => window.__SS__!.settings.set({ quality }), quality);
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(async () => {
      const api = window.__SS__!; api.pause(); api.camera.follow();
      await api.step(60); await api.screenshotReady();
    });
    const state = await page.evaluate(() => window.__SS__!.getState());
    expect(state.render.quality).toBe(quality);
    expect(state.render.camera.spot).toBeNull();
    expect(state.player!.hidden).toBeFalsy();
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.marker)).toBe('l2-axe-rack');
    await expect(page.getByTestId('objective-text')).toContainText('Take the fire axe');
    // QA F10's occluder fills this spawn/apron area in the portrait game camera.
    // The paving, courier and firefighters occupy it normally. Measure coverage,
    // rather than a whole-screen golden that would mask a local player defect.
    const capture = await page.screenshot();
    const png = PNG.sync.read(capture), area = { x: 150, y: 380, width: 110, height: 95 };
    let dark = 0;
    for (let y = area.y; y < area.y + area.height; y++) for (let x = area.x; x < area.x + area.width; x++) {
      const i = (y * png.width + x) * 4;
      if (png.data[i] < 55 && png.data[i + 1] < 55 && png.data[i + 2] < 65) dark++;
    }
    if (process.env.PHONE_CUBE_CAPTURE) {
      mkdirSync('test-results/fix-phone-cube', { recursive: true });
      await page.screenshot({ path: `test-results/fix-phone-cube/${quality}-after.jpg`, quality: 85 });
    }
    expect(dark / (area.width * area.height), 'Dark occluder coverage at the courier/axe objective').toBeLessThan(.35);
  });
}
