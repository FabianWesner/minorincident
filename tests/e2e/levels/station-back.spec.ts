import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';
import { l2Anchors, l2Station } from '../../../src/data/l2';

const output = 'test-results/station-back/captures';

test('restored station @E19 @E20 game camera: L1 approach and objective, L2 start, axe and departure, Main Row', async ({ page }) => {
  test.setTimeout(600_000);
  mkdirSync(output, { recursive: true });
  await boot(page, `${testUrl}&ui=1`);
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const shot = async (name: string) => {
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/${name}.png` });
  };
  await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L1', { seed: 1 }); a.missions.begin(); a.pause();
  });
  for (let i = 0; i < 12; i++) {
    if (await page.evaluate(() => window.__SS__!.missions.state()!.steps.firestation.status === 'active')) break;
    await page.evaluate(() => window.__SS__!.cheats.completeObjective());
    await step(600);
  }
  await page.evaluate(() => {
    const a = window.__SS__!; a.cheats.god(true);
    a.teleport('player', { x: -69, z: 41.27 }); a.camera.follow();
  });
  // Use the player's normal wheel zoom to frame the station on the approach.
  await page.mouse.wheel(0, 600);
  await step(60); await shot('l1-approach');
  const invitation = await page.evaluate(() => window.__SS__!.missions.state()!.l1!.say?.text);
  expect(invitation).toBe('Get in!');
  await page.evaluate(() => window.__SS__!.teleport('player', { x: -72.8, z: 41.27 }));
  await step(30); await shot('l1-final-objective');
  const marker = await page.evaluate(() => window.__SS__!.getState().render.missionMarker!);
  expect(marker.visible).toBe(true);
  expect(marker.position[0]).toBeCloseTo(-76.6, 2); expect(marker.position[2]).toBeCloseTo(41.27, 2);
  await page.evaluate(() => window.__SS__!.teleport('player', { x: 38.8, z: -31 }));
  await step(60); await shot('l1-main-row');

  await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L2', { seed: 1, progression: 'L2-default' }); a.missions.begin(); a.pause(); a.camera.follow();
  });
  await step(60); await shot('l2-start');
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.marker)).toBe('l2-axe-rack');
  await page.evaluate(() => window.__SS__!.teleport('player', { x: 38.8, z: -31 }));
  await step(60); await shot('l2-main-row');
  const [x, z] = l2Anchors['l2-axe-rack'];
  await page.evaluate(p => window.__SS__!.teleport('player', p), { x, z });
  await step(30); await shot('l2-highlighted-axe');
  await page.keyboard.down('e'); await step(60); await page.keyboard.up('e');
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.l2!.phase)).toBe('alarm');
  await shot('l2-alarm');
  await page.evaluate(() => window.__SS__!.bot.start('complete'));
  for (let i = 0; i < 120; i++) {
    await step(15);
    if (await page.evaluate(() => window.__SS__!.missions.state()!.l2!.rideS > 2)) break;
  }
  const departure = await page.evaluate(() => window.__SS__!.missions.state()!.l2!);
  expect(departure.phase).toBe('ride'); expect(departure.rideS).toBeGreaterThan(2);
  await shot('l2-truck-leaving');
  await page.evaluate(() => window.__SS__!.bot.stop());
  writeFileSync(`${output}/evidence.json`, JSON.stringify({ station: l2Station, invitation, marker, departure }, null, 2) + '\n');
});
