import { mkdirSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';
import { l2Anchors } from '../../../src/data/l2';

/** The optional fire axe must be findable at the alarm: captures at the game camera and a close look at the rack. */
const output = 'test-results/epics/E20/axe';
test.use({ trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test('T-E20-axe-findable @E20 the axe rack is visible, marked and announced at the alarm', async ({ page }) => {
  test.setTimeout(300_000); mkdirSync(output, { recursive: true });
  await boot(page, `${testUrl}&ui=1`);
  await page.evaluate(() => window.__SS__!.loadLevel('L2', { seed: 1, progression: 'L2-default' }));
  await page.evaluate(() => window.__SS__!.pause());
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  for (let i = 0; i < 80 && (await mission()).l2!.phase === 'calm'; i++) await step(30);
  await step(45);
  expect((await mission()).steps.axe.status).toBe('active');
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/alarm-apron.png` });
  const [rx, rz] = l2Anchors['l2-axe-rack'];
  await page.evaluate(({ rx, rz }) => window.__SS__!.camera.cinematic({ position: [rx + 9, 7, rz + 9], target: [rx, 1.5, rz] }, true), { rx, rz });
  await step(2); await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/alarm-rack-close.png` });
  await page.evaluate(() => window.__SS__!.camera.cinematic({ position: [-72, 38, 46], target: [-72, 0, 45.9] }, true));
  await step(2); await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/top.png` });
  await page.evaluate(() => window.__SS__!.camera.follow());
});
