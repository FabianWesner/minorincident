import { mkdirSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';
import { l2Anchors, l2Station } from '../../../src/data/l2';

/** The optional fire axe must be findable during the calm beat: captures at the game camera and a close look at the rack. */
const output = 'test-results/epics/E20/axe';
test.use({ trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test('T-E20-axe-findable @E20 the axe rack is visible and marked during calm', async ({ page }) => {
  test.setTimeout(300_000); mkdirSync(output, { recursive: true });
  await boot(page, `${testUrl}&ui=1`);
  await page.evaluate(() => window.__SS__!.loadLevel('L2', { seed: 1, progression: 'L2-default' }));
  await page.evaluate(() => window.__SS__!.pause());
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  await step(60);
  expect((await mission()).l2!.phase).toBe('calm');
  expect((await mission()).steps.axe.status).toBe('active');
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/calm-apron.png` });
  const [rx, rz] = l2Anchors['l2-axe-rack'];
  // The courier stands at the interact point: the rack hangs on the solid wall beside the bay, in the game camera.
  await page.evaluate(({ rx, rz }) => { window.__SS__!.teleport('player', { x: rx, z: rz }); window.__SS__!.camera.follow(); }, { rx, rz });
  await step(30); await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/calm-rack-close.png` });
  // Top-down over the station (it moved to Main Row on 2026-10-08; the frame follows l2Station).
  await page.evaluate(({ x, z }) => window.__SS__!.camera.cinematic({ position: [x, 38, z + .1], target: [x, 0, z] }, true), { x: l2Station.x, z: l2Station.z });
  await step(2); await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/top.png` });
  await page.evaluate(() => window.__SS__!.camera.follow());
});
