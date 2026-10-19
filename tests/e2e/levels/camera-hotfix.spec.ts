import { mkdirSync, writeFileSync } from 'node:fs';
import { cameraFraming } from '../../../src/data/cameraFraming';
import { boot, expect, test } from '../fixtures';

test.use({ viewport: { width: 1280, height: 720 }, launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu'] } });
for (const renderer of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) {
  test(`@E22 @camera-hotfix L4 refuge framing and debug HUD ${renderer} ${quality}`, async ({ page }) => {
    test.setTimeout(300_000);
    await boot(page, `/?test=1&ui=1&debug=true&renderer=${renderer}&quality=${quality}&audio=muted&dpr=1`);
    await page.evaluate(async quality => {
      const a = window.__SS__!; a.settings.set({ quality, cameraShake: false });
      await a.loadLevel('L4', { seed: 2, progression: 'L4-default' }); a.pause();
    }, quality);
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => {
      const a = window.__SS__!; a.pause(); a.cheats.god(true);
      a.cheats.completeObjective('ride'); a.cheats.completeObjective('quartermaster');
    });
    for (let i = 0; i < 60 && !await page.evaluate(() => window.__SS__!.missions.state()!.l4!.turnAt); i++) await page.evaluate(() => window.__SS__!.step(60));
    await page.evaluate(async () => {
      const a = window.__SS__!; a.cheats.completeObjective('hold');
      a.teleport('player', { x: -56.23, z: 32.11 }); await a.step(120);
    });
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('line-break');
    await expect(page.getByTestId('mission-tracker')).toHaveAttribute('data-objective', 'hide');
    const out = `test-results/camera-hotfix/game-${renderer}-${quality}`; mkdirSync(out, { recursive: true });
    const samples = [];
    for (const zoom of [1, .5, 1.5]) {
      await page.mouse.move(640, 360);
      for (let i = 0; i < 16; i++) {
        const current = await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom);
        if (Math.abs(current - zoom) < .001) break;
        await page.mouse.wheel(0, current > zoom ? -120 : 120);
        await page.evaluate(() => window.__SS__!.step(2));
      }
      await page.evaluate(() => window.__SS__!.step(120));
      const proof = await page.evaluate(() => {
        const a = window.__SS__!, state = a.getState(), c = state.render.camera;
        const offset = c.position.map((v, i) => v - c.target[i]);
        const radius = Math.hypot(...offset);
        return { backend: a.perf().backend, quality: a.perf().quality.tier, c, radius, polar: Math.acos(offset[1] / radius), player: state.player!.transform };
      });
      await page.evaluate(() => window.__SS__!.screenshotReady());
      await page.screenshot({ path: `${out}/z${zoom}.png` }); samples.push(proof);
      expect(proof.backend).toBe(renderer); expect(proof.quality).toBe(quality);
      expect(proof.c.zoom).toBeCloseTo(zoom, 2);
      expect(Math.abs(proof.polar - cameraFraming.polar)).toBeLessThanOrEqual(8 * Math.PI / 180);
      expect(proof.radius).toBeGreaterThanOrEqual(proof.c.radius * .85);
      // Stay beside the facade and zoom out again: no per-tick clearance snap.
      await page.evaluate(() => window.__SS__!.step(120));
      expect(await page.evaluate(() => window.__SS__!.getState().render.camera.zoom)).toBeCloseTo(zoom, 2);
    }
    for (const [width, height] of [[1280, 720], [1920, 1080], [2000, 990]]) {
      await page.setViewportSize({ width, height });
      const hint = page.locator('[data-input-hint]'); await expect(hint).toBeVisible();
      const hintBox = (await hint.boundingBox())!;
      for (const selector of ['.hud-vitals', '.hud-companion', '[data-audio-controls]', '[data-input-controls]']) {
        const other = page.locator(selector); if (!await other.isVisible()) continue;
        const box = (await other.boundingBox())!;
        expect(hintBox.x >= box.x + box.width || box.x >= hintBox.x + hintBox.width || hintBox.y >= box.y + box.height || box.y >= hintBox.y + hintBox.height, `${width}x${height}: hint overlaps ${selector}`).toBe(true);
      }
      expect(hintBox.x).toBeGreaterThanOrEqual(0); expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(width);
      expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(height);
      await page.screenshot({ path: `${out}/hud-${width}x${height}.png` });
    }
    writeFileSync(`${out}/framing.json`, JSON.stringify(samples, null, 2));
  });
}
