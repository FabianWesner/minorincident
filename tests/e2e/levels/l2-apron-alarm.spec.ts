import { mkdirSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';
import { stationPoint } from '../../../src/data/l2';

/** Game-camera look at the Fire Station 3 apron during the alarm: the axe marker is available during calm and beacons start at alarm. */
const output = 'test-results/epics/E20/apron';
test.use({ trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test('T-E20-apron-alarm @E20 axe ring is available during calm and beacons run during the alarm', async ({ page }) => {
  test.setTimeout(300_000); mkdirSync(output, { recursive: true });
  await boot(page, `${testUrl}&ui=1`);
  await page.evaluate(() => window.__SS__!.loadLevel('L2', { seed: 1, progression: 'L2-default' }));
  await page.evaluate(() => window.__SS__!.pause());
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  await step(60);
  expect((await mission()).steps.calm.status).toBe('active');
  expect((await mission()).steps.axe.status).toBe('active');
  // The required pickup is the first visible objective.
  expect((await page.evaluate(() => window.__SS__!.getState().render.missionMarker))?.visible).toBe(true);
  await page.evaluate(() => window.__SS__!.cheats.completeObjective('axe'));
  await step(1);
  expect((await mission()).l2!.phase).toBe('alarm');
  await step(40);
  expect((await page.evaluate(() => window.__SS__!.getState().render.missionMarker))?.visible).toBe(true);
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/alarm-apron.png` });
  // Station-local view of the front (Fire Station 3 moved to Main Row on 2026-10-08; the frame follows l2Station).
  const [px, pz] = stationPoint(13, 3.5), [tx, tz] = stationPoint(1.6, -.5);
  await page.evaluate(({ px, pz, tx, tz }) => window.__SS__!.camera.cinematic({ position: [px, 7, pz], target: [tx, 3, tz] }, true), { px, pz, tx, tz });
  await step(5); await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/alarm-front.png` });
});
