import { mkdirSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';
import { carryoverSites } from '../../../src/levels/continuity';

/** Campaign continuity (L1 aftermath in L2): every carried-over spot at the game camera, plus the burned annex per LOD. */
const output = 'test-results/epics/continuity';
test.use({ trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });
// Game camera (src/render/View.ts): radius 19, polar 0.30 pi, azimuth pi/4 -> offset (10.87, 11.17, 10.87).
const offset = (radius: number) => { const s = Math.sin(Math.PI * .3) * radius; return [s * Math.SQRT1_2, Math.cos(Math.PI * .3) * radius, s * Math.SQRT1_2]; };

test('T-CONT-01 @continuity L2 shows the L1 aftermath at every carried-over spot (game camera, near and far)', async ({ page }) => {
  test.setTimeout(600_000); page.setDefaultTimeout(180_000); mkdirSync(output, { recursive: true });
  await boot(page, testUrl);
  for (const level of ['L1', 'L2'] as const) {
  await page.evaluate(level => window.__SS__!.loadLevel(level, { seed: 1, progression: level === 'L2' ? 'L2-default' : undefined }), level);
  await page.evaluate(() => window.__SS__!.pause());
  const begin = page.getByRole('button', { name: 'Begin mission' });
  if (await begin.isVisible().catch(() => false)) { await begin.click(); await page.evaluate(() => window.__SS__!.pause()); }
  await page.evaluate(() => window.__SS__!.step(30));
  for (const site of carryoverSites) {
    // The courier stands at the spot: the real follow camera (and its see-through hole) frames it like in play.
    await page.evaluate(p => { window.__SS__!.teleport('player', p); window.__SS__!.camera.follow(); }, site.stand);
    for (let i = 0; i < 8; i++) await page.evaluate(() => window.__SS__!.step(30));
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/${level.toLowerCase()}-${site.id}-game.png` });
    for (const [label, radius] of [['close', 12], ['far', 46]] as const) {
      const [ox, oy, oz] = offset(radius);
      await page.evaluate(({ x, z, ox, oy, oz }) => window.__SS__!.camera.cinematic({ position: [x + ox, oy, z + oz], target: [x, 0, z] }, true), { x: site.at.x, z: site.at.z, ox, oy, oz });
      await page.evaluate(() => window.__SS__!.step(2));
      await page.evaluate(() => window.__SS__!.screenshotReady());
      await page.screenshot({ path: `${output}/${level.toLowerCase()}-${site.id}-${label}.png` });
    }
  }
  await page.evaluate(() => window.__SS__!.camera.follow());
  }
});

test('T-CONT-02 @continuity burned annex twin loads every runtime LOD without placeholders', async ({ page }) => {
  test.setTimeout(240_000); mkdirSync(output, { recursive: true });
  await page.goto('/preview/?asset=bld.clinic-annex&test=1&renderer=webgl');
  await page.waitForFunction(() => !!window.__ASSET__);
  await page.evaluate(() => window.__ASSET__!.ready);
  await page.selectOption('#decay', 'burned');
  for (const quality of ['high', 'lod1', 'lod2'] as const) {
    // Game-camera azimuth: the camera looks from +X +Z; the annex front (+X) and delivery side face it in the town.
    for (const azimuth of [20, 70]) {
      await page.evaluate(({ quality, azimuth }) => window.__ASSET__!.inspectionView!(quality, azimuth), { quality, azimuth });
      const info = await page.evaluate(() => window.__ASSET__!.info());
      expect(info.placeholder).toBe(false);
      await page.screenshot({ path: `${output}/annex-burned-${quality}-${azimuth}.png` });
    }
  }
});
