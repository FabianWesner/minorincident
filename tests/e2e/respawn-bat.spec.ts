import { mkdirSync, readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import { menuStart } from './ui-helpers';

/** PO 2026-10-12: after taking the bat and dying, the courier comes back where the bat was taken, still holding it. Real mouse input. */
const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as { anchors: Record<string, { position: number[] }> };
const bat = { x: layout.anchors['garage-bat'].position[0], z: layout.anchors['garage-bat'].position[2] };
const shotDir = process.env.RESPAWN_SHOTS ? `docs/reports/fix-respawn-bat` : '';
test.use({ headless: true });

test('E19 @E19 respawn after the bat: real-click pickup, die, respawn within a few metres of the pickup with the bat equipped', async ({ page }) => {
  test.setTimeout(300_000); page.setDefaultTimeout(60_000);
  if (shotDir) mkdirSync(shotDir, { recursive: true });
  await menuStart(page);
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const player = () => page.evaluate(() => window.__SS__!.getState().player!.transform);
  const hasBat = () => page.evaluate(() => window.__SS__!.missions.state()!.items.includes('bat'));
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); await a.loadLevel('L1', { checkpoint: 'accident' }); a.pause(); });
  await step(60);
  // Start a short walk from the street in front of the garage (the long route from the lab is covered by the L1 playthrough).
  await page.evaluate(b => { const a = window.__SS__!; a.cheats.god(true); a.teleport('player', { x: b.x - 7, z: b.z + 6 }); }, bat);
  await step(30);
  for (let i = 0; i < 12 && !(await hasBat()); i++) {
    const from = await player();
    await page.evaluate(({ from, bat }) => {
      const a = window.__SS__!, x = (from.x + bat.x) / 2, z = (from.z + bat.z) / 2;
      a.camera.preset('D-GROVE/W0/l1-morning'); a.camera.cinematic({ position: [x + 22, 26, z + 22], target: [x, 0, z] }, true);
    }, { from, bat });
    await step(1);
    const pt = await page.evaluate(b => window.__SS__!.input.project(b, 'player'), bat);
    await page.mouse.click(pt.x, pt.y); await page.evaluate(() => window.__SS__!.camera.follow());
    await step(150);
  }
  expect(await hasBat(), 'bat picked up by walking into the interaction').toBe(true);
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('bat');
  const picked = await player();
  expect(Math.hypot(picked.x - bat.x, picked.z - bat.z)).toBeLessThan(3);
  // The courier walks on, away from the garage, then dies.
  await page.evaluate(b => window.__SS__!.teleport('player', { x: b.x - 30, z: b.z + 2 }), bat);
  await step(30);
  if (shotDir) { await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${shotDir}/before-death.png` }); }
  await page.evaluate(() => window.__SS__!.cheats.god(false));
  await step(180);
  await page.evaluate(() => window.__SS__!.survivor.damage(1000)); await step(5);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.health.current)).toBe(0);
  await step(300);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.health.current)).toBeGreaterThan(0);
  const back = await player();
  expect(Math.hypot(back.x - picked.x, back.z - picked.z), 'respawn near the bat pickup, not near the death spot').toBeLessThanOrEqual(14);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons!.LEFT.rack[0].id)).toBe('weapon.bat');
  if (shotDir) { await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${shotDir}/after-respawn.png` }); }
});
