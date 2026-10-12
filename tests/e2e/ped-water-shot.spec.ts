import { mkdirSync } from 'node:fs';
import { test, boot } from './fixtures';

/** Evidence capture for fix-ped-routines: `PED_WATER_SHOT=1 npx playwright test ped-water-shot` (opt-in, not part of CI). */
test.skip(!process.env.PED_WATER_SHOT, 'set PED_WATER_SHOT=1 to capture the L4 plaza gardener');
test('L4 plaza gardener waters a flower box', async ({ page }) => {
  test.setTimeout(240_000); mkdirSync('test-results/ped-water', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await boot(page);
  await page.addStyleTag({ content: 'body > :not(#game), #game > :not(canvas) { visibility: hidden !important; }' });
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L4'); a.pause(); a.missions.begin(); });
  let found: { x: number; z: number; yaw: number } | undefined;
  for (let i = 0; i < 40 && !found; i++) {
    found = await page.evaluate(async () => {
      const a = window.__SS__!; await a.step(120);
      const e = a.query({ kind: 'civilian' }).find(e => { const c = e.civilian!; const act = c.schedule?.[c.scheduleStep ?? 0]; return act?.activity === 'water' && !!c.activityUntil && a.tick() - (c.activityStarted ?? 0) > 100; });
      return e && { x: e.transform.x, z: e.transform.z, yaw: e.transform.yaw };
    });
  }
  if (!found) throw new Error('no L4 gardener reached its watering stop');
  await page.evaluate(async s => {
    const a = window.__SS__!; a.teleport('player', { x: s.x + 8, z: s.z + 8 }); a.camera.preset('hud-golden');
    a.camera.cinematic({ position: [s.x + 3, 5, s.z + 4.5], target: [s.x, .6, s.z] });
    await a.step(30); await a.screenshotReady();
  }, found);
  await page.waitForTimeout(1500); await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: 'test-results/ped-water/l4-gardener.png' });
});
