import { mkdirSync } from 'node:fs';
import { test, boot } from './fixtures';

/** Evidence capture for the clipping lane: `CLIPPING_SHOTS=before|after npx playwright test clipping-shots` (opt-in, not part of CI). */
const tag = process.env.CLIPPING_SHOTS;
test.skip(!tag, 'set CLIPPING_SHOTS=before|after to capture close-ups');
const out = 'test-results/clipping';
const spots = [
  { name: 'bed-a', x: -53.9, z: 5.0, side: -1 }, { name: 'bed-b', x: 2.4, z: 25.0, side: 1 }, { name: 'bed-c', x: 54.9, z: 35.2, side: -1 }, { name: 'bed-c2', x: 54.9, z: 35.2, side: 1 },
  { name: 'pool-house', x: 35.9, z: -21.7, side: -1 }, { name: 'pool-house2', x: 35.9, z: -21.7, side: 1 }, { name: 'bench-house', x: -0.6, z: 22.9, side: 1 },
];
test('clipping close-ups', async ({ page }) => {
  test.setTimeout(240_000); mkdirSync(out, { recursive: true });
  await page.setViewportSize({ width: 800, height: 500 });
  await boot(page);
  await page.addStyleTag({ content: 'body > :not(#game), #game > :not(canvas) { visibility: hidden !important; }' });
  for (const spot of spots) {
    await page.evaluate(async spot => {
      const a = window.__SS__!; await a.loadLevel('L1'); a.pause(); a.missions.begin(); a.teleport('player', { x: spot.x + 3, z: spot.z + 3 });
      a.camera.preset('hud-golden');
      a.camera.cinematic({ position: [spot.x + 2, 4.5, spot.z + spot.side * 5], target: [spot.x, .4, spot.z] });
      await a.step(2); await a.screenshotReady();
    }, spot);
    await page.waitForTimeout(1500); await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${out}/${spot.name}-${tag}.png` });
  }
  // Seated civilians: run the morning until a few are in the 'sit' activity, then frame them.
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L1'); a.pause(); a.missions.begin(); });
  let found: { x: number; z: number; yaw: number }[] = [];
  for (let i = 0; i < 40 && found.length < 2; i++) {
    found = await page.evaluate(async () => {
      const a = window.__SS__!; await a.step(120);
      return a.query({ kind: 'civilian' }).filter(e => { const c = e.civilian!; const act = c.schedule?.[c.scheduleStep ?? 0]; return act?.activity === 'sit' && !!c.activityUntil && (a.tick() - (c.activityStarted ?? 0)) > 60; })
        .map(e => ({ x: e.transform.x, z: e.transform.z, yaw: e.transform.yaw }));
    });
  }
  for (const [i, s] of found.slice(0, 3).entries()) {
    await page.evaluate(async s => {
      const a = window.__SS__!; a.teleport('player', { x: s.x + 6, z: s.z + 6 }); a.camera.preset('hud-golden');
      // side view: camera 90 degrees off the sitter's facing so seat, backrest and limbs separate
      const fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw), sx = -fz, sz = fx;
      a.camera.cinematic({ position: [s.x + sx * 3.2 + 1, 1.8, s.z + sz * 3.2 + 1], target: [s.x, .7, s.z] });
      await a.step(1); await a.screenshotReady();
    }, s);
    await page.waitForTimeout(1500); await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${out}/sitter-${i}-${tag}.png` });
  }
  console.log('sitters', JSON.stringify(found));
});
