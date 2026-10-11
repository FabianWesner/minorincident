import { mkdirSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';
import { preset } from '../../../src/sim/progression/Campaign';
import { l2Anchors, l2Station } from '../../../src/data/l2';

/** The required fire axe must be findable during the calm beat: captures at the game camera and a close look at the rack. */
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
  // Top-down over the station (restored south-west position; the frame follows l2Station).
  await page.evaluate(({ x, z }) => window.__SS__!.camera.cinematic({ position: [x, 38, z + .1], target: [x, 0, z] }, true), { x: l2Station.x, z: l2Station.z });
  await step(2); await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/top.png` });
  await page.evaluate(() => window.__SS__!.camera.follow());
});


test('T-E20-axe-replay @E20 menu replay still requires the axe even when it is already owned', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, `${testUrl}&ui=1`);
  const save = preset('L3-default');
  await page.evaluate(save => { const a = window.__SS__!; a.campaign.restore(save); a.campaign.save(); a.campaign.menu(); }, save);
  await page.getByRole('button', { name: 'Level select', exact: true }).click();
  await page.getByRole('button', { name: 'Level 2', exact: true }).click();
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
  const state = () => page.evaluate(() => window.__SS__!.missions.state()!);
  expect((await state()).l2).toMatchObject({ phase: 'calm', axe: false, alarmAt: 0 });
  expect((await state()).marker).toBe('l2-axe-rack');
  // Click the yellow floor ring in the actual follow camera, then interact.
  await page.evaluate(() => window.__SS__!.step(60));
  await page.evaluate(() => window.__SS__!.screenshotReady());
  const [x, z] = l2Anchors['l2-axe-rack'];
  const point = await page.evaluate(p => window.__SS__!.input.project(p), { x, y: .4, z });
  await page.mouse.click(point.x, point.y);
  await page.evaluate(() => window.__SS__!.step(1));
  for (let i = 0; i < 60; i++) {
    await page.evaluate(() => window.__SS__!.step(5));
    const p = await page.evaluate(() => window.__SS__!.getState().player!.transform);
    if (Math.hypot(p.x - x, p.z - z) <= 1.2) break;
  }
  await page.keyboard.down('e');
  for (let i = 0; i < 60 && !(await state()).l2!.axe; i++) await page.evaluate(() => window.__SS__!.step(5));
  await page.keyboard.up('e');
  expect((await state()).l2).toMatchObject({ phase: 'alarm', axe: true });
  expect((await state()).steps.board.status).toBe('active');
  const weapons = await page.evaluate(() => window.__SS__!.getState().player!.weapons!);
  expect(weapons.selectedSide).toBe('LEFT');
  expect(weapons.LEFT.rack.filter(s => s.id === 'weapon.fire-axe')).toHaveLength(1);
});
