import { mkdirSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';

/**
 * E20 beats 4-5 at the game camera (PO 10-08: "the humans are just standing there. There is no emergency"): arrival, the
 * crew forcing the chained doors while the people behind the glass panic, and the doors opening. Real game camera (follow),
 * HUD on for the shout bubbles. Frames for the visual review: test-results/epics/E20/rescue/.
 */
const output = process.env.L2_RESCUE_OUT ?? 'test-results/epics/E20/rescue';
test.use({ trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test('T-E20-20 @E20 rescue set piece reads as an emergency at the game camera (arrival, forcing, doors open)', async ({ page }) => {
  test.setTimeout(600_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
  await boot(page, `${testUrl}&ui=1`);
  await page.evaluate(() => window.__SS__!.loadLevel('L2', { seed: 1, progression: 'L2-default' }));
  await page.evaluate(() => window.__SS__!.pause());
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const l2 = () => page.evaluate(() => window.__SS__!.missions.state()!.l2!);
  const shot = async (name: string) => {
    await page.evaluate(() => window.__SS__!.camera.follow()); await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/${name}.jpg`, type: 'jpeg', quality: 82 });
  };
  /** QA overview (not the game camera): a fixed isometric pose over a world point. */
  const overview = async (name: string, x: number, z: number, r: number) => {
    await page.evaluate(({ x, z, r }) => window.__SS__!.camera.cinematic({ position: [x + r, r * 1.2, z + r], target: [x, 0, z] }, true), { x, z, r });
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/${name}.jpg`, type: 'jpeg', quality: 82 });
    await page.evaluate(() => window.__SS__!.camera.follow());
  };
  await page.evaluate(() => window.__SS__!.cheats.completeObjective('calm'));
  await step(2);
  await page.evaluate(() => window.__SS__!.cheats.completeObjective('board'));
  for (let i = 0; i < 400 && !(await l2()).arrivedAt; i++) await step(15);
  const arrived = (await l2()).arrivedAt; expect(arrived).toBeGreaterThan(0);
  // Control is back: walk toward the forecourt like a player following the objective (real click-to-move input).
  await step(20);
  const forecourt = await page.evaluate(() => window.__SS__!.input.project({ x: -48.2, z: -40.0 }));
  await page.mouse.click(forecourt.x, forecourt.y);
  for (let i = 0; i < 120 && (await page.evaluate(() => window.__SS__!.tick())) < arrived + 110; i++) await step(1);
  await shot('1-arrival');
  for (let i = 0; i < 900 && !(await l2()).atDoorsAt; i++) await step(2);
  const atDoors = (await l2()).atDoorsAt;
  const until = async (tick: number) => { for (let i = 0; i < 2000; i++) { const now = await page.evaluate(() => window.__SS__!.tick()); if (now >= tick) break; await step(Math.min(20, tick - now)); } };
  await until(atDoors + 75); await shot('2-forcing');
  await overview('qa-glass-closeup', -52.5, -41, 9);
  await until(atDoors + 200); await shot('3-forcing-late');
  const s = await l2(); expect(s.doorsOpenAt).toBe(0);
  for (let i = 0; i < 120 && !(await l2()).doorsOpenAt; i++) await step(1);
  const open = (await l2()).doorsOpenAt;
  await until(open + 100); await shot('4-doors-open');
  await until(open + 270); await shot('5-doors-open-late');
  // PO 10-08: the rescued people never vanish. They flee for the bridge checkpoint along the streets and meet the outbreak
  // on the way (overview cameras; the courier stays at the doors, observer mode).
  await page.evaluate(() => window.__SS__!.cheats.god(true));
  await until(open + 60 * 22); await overview('6-flight-streets', -30.6, -12, 22);
  await until(open + 60 * 40); await overview('7-flight-elm', 20, 30, 24);
  await until(open + 60 * 75); await overview('8-checkpoint', 78, 30, 14);
  const fates = await page.evaluate(() => { const a = window.__SS__!, s = a.missions.state()!.l2!, all = a.getState().entities; return s.trappedIds.map(id => all.find(e => e.id === id)?.kind ?? 'missing'); });
  expect(fates.filter(k => k === 'missing')).toEqual([]);
});
