import { writeFileSync } from 'node:fs';
import { test } from '../e2e/fixtures';
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
for (const level of ['L1', 'L2']) test(`tmp profile ${level}`, async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(`/?test=1&renderer=webgl&quality=low&audio=muted&dpr=1.5&profile`);
  await page.waitForFunction(() => Boolean(window.__SS__));
  const out = await page.evaluate(async level => {
    const a = window.__SS__!; await a.ready; await a.loadLevel(level, { seed: 2 }); a.pause(); a.missions.begin();
    a.teleport('player', { x: -46.5, z: -38 }); await a.step(2); a.camera.preset('D-GROVE/' + (level === 'L1' ? 'W0/l1-pickup' : 'W1/l2-collapse')); await a.screenshotReady();
    const p = a.perf(); return { draws: p.drawCalls, tris: p.triangles, profile: p.profile, other: Object.entries(p.profileAssets ?? {}).filter(([k]) => k.includes('other/')).sort((x, y) => y[1].drawCalls - x[1].drawCalls).slice(0, 12) };
  }, level);
  writeFileSync(`test-results/tmp-profile-${level}.json`, JSON.stringify(out, null, 1));
});
