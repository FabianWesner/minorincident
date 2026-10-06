import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from './fixtures';

const output = 'test-results/m1-civlife';
const captures = `${output}/captures`;
test('M1-16 M1-30 @E19 civilian morning at diner, crescent and hardware over 60s', async ({ page }) => {
  test.setTimeout(240_000); mkdirSync(output, { recursive: true });
  if (process.env.CIVLIFE_CAPTURE) mkdirSync(captures, { recursive: true });
  await boot(page);
  const evidence = [];
  for (const spot of [
    { name: 'crescent', x: -10, z: -4, playerX: -14, playerZ: -7 },
    { name: 'diner', x: 42, z: -6, playerX: 47, playerZ: -3.6 },
    { name: 'hardware', x: 70, z: -6, playerX: 65, playerZ: -3.6 },
  ]) {
    await page.evaluate(async spot => {
      const a = window.__SS__!; await a.loadLevel('L1'); a.pause();
      a.missions.begin(); a.teleport('player', { x: spot.playerX, z: spot.playerZ });
      a.camera.preset('hud-golden'); // Snap the blend before selecting the review pose.
      a.camera.cinematic({ position: [spot.x + 13, 17, spot.z + 15], target: [spot.x, 0, spot.z] });
      await a.step(1); await a.screenshotReady();
    }, spot);
    await page.waitForTimeout(1200); // Let the presentation-only cinematic blend settle while sim is paused.
    const frames = [];
    let elapsed = 0;
    for (const seconds of [0, 1, 3, 6, 10, 12, 15, 20, 30, 45, 60]) {
      await page.evaluate(async ticks => { await window.__SS__!.step(ticks); await window.__SS__!.screenshotReady(); }, Math.max(1, (seconds - elapsed) * 60));
      elapsed = seconds;
      const crowd = await page.evaluate(() => window.__SS__!.query({ kind: 'civilian' }).filter(e => e.civilian?.schedule));
      expect(crowd.length).toBeGreaterThan(10);
      expect(crowd.every(e => e.civilian!.state === 'calm')).toBe(true);
      frames.push({ seconds, civilians: crowd.map(e => ({ id: e.id, model: e.civilian!.model, position: e.transform, activity: e.civilian!.schedule![e.civilian!.scheduleStep ?? 0], hidden: e.hidden, performing: !!e.civilian!.activityUntil, moving: e.motion?.moving })) });
      if (process.env.CIVLIFE_CAPTURE) await page.screenshot({ path: `${captures}/${spot.name}-${String(seconds).padStart(2, '0')}.png` });
    }
    if (process.env.CIVLIFE_CAPTURE && spot.name === 'crescent') {
      await page.evaluate(() => window.__SS__!.camera.cinematic({ position: [14, 17, 18], target: [1, 0, 3.6] }));
      await page.waitForTimeout(1200); await page.evaluate(() => window.__SS__!.screenshotReady());
      await page.screenshot({ path: `${captures}/crescent-social-60.png` });
    }
    evidence.push({ spot: spot.name, frames });
  }
  writeFileSync(`${output}/morning-60s.json`, JSON.stringify(evidence, null, 2));
});
