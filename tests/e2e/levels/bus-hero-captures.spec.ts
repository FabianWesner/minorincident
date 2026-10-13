import { mkdirSync } from 'node:fs';
import { test, boot, testUrl } from '../fixtures';

/** bus-hero QA captures (not a gate, run with BUS_CAPTURE=1): the player's bus in the real L4 convoy ride at the game camera, zoom 1.0 and 0.6, high and
 * low quality. Output goes to test-results/epics/bus-hero/<tag>-ride-<quality>-z<zoom>.png. Browser runs only through tools/e2e-lock.sh. */
const output = 'test-results/epics/bus-hero', tag = process.env.BUS_TAG ?? 'after';
test.use({ trace: 'off' });
test.skip(!process.env.BUS_CAPTURE, 'QA captures only: BUS_CAPTURE=1 BUS_TAG=before|after');

for (const quality of ['high', 'low'] as const) {
  test(`@bus-hero L4 convoy ride captures (${quality})`, async ({ page }) => {
    test.setTimeout(240_000); mkdirSync(output, { recursive: true });
    await boot(page, `${testUrl.replace('quality=high', `quality=${quality}`)}&ui=1`);
    await page.evaluate(() => window.__SS__!.loadLevel('L4', { seed: 1, progression: 'L4-default' }));
    await page.evaluate(() => window.__SS__!.pause());
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => window.__SS__!.resume());
    await page.waitForTimeout(9000);
    await page.screenshot({ path: `${output}/${tag}-ride-${quality}-z1.0.png` });
    await page.mouse.move(640, 360);
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(150); }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${output}/${tag}-ride-${quality}-z0.6.png` });
  });
}
