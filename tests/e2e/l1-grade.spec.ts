import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from './fixtures';
import { menuStart } from './ui-helpers';

test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const mobile of [false, true]) test.describe(mobile ? 'portrait low' : 'desktop high', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1600, height: 900 }, isMobile: mobile, hasTouch: mobile });
  test('@E19 grade uses one lit material model and HDR diner emitters in WebGL2', async ({ page }) => {
    test.setTimeout(120_000);
    await menuStart(page);
    await page.evaluate(async mobile => {
      const a = window.__SS__!; a.pause(); a.settings.set({ quality: mobile ? 'low' : 'high' }); a.cheats.god(true);
      a.teleport('player', { x: 42, z: -6.5 }); a.camera.follow(); await a.step(90); await a.screenshotReady();
    }, mobile);
    const render = await page.evaluate(() => window.__SS__!.getState().render);
    expect(render.backend).toBe('webgl');
    expect(render.lighting).toMatchObject({ shadowSize: mobile ? 1024 : 2048, shadowColor: '6b4fc2', normalBias: .08, shadowRadius: 2 });
    expect(render.postFx).toMatchObject({ dof: true, dofRepeats: mobile ? 6 : 18, dofResolution: mobile ? .5 : 1 });
    expect(render.materials.filter(m => m.plainLit)).toEqual([]);
    expect(render.materials.filter(m => m.emissive >= 1.5).length).toBeGreaterThanOrEqual(3);
    const on = await page.locator('canvas').screenshot();
    await page.evaluate(async () => { window.__SS__!.settings.set({ bloom: false }); await window.__SS__!.screenshotReady(); });
    const off = await page.locator('canvas').screenshot();
    expect(on.equals(off)).toBe(false);
  });
  test(`@E19 @perf grade holds frame/draw/triangle budgets with ${mobile ? 100 : 200} infected`, async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page); await page.evaluate(async mobile => {
      const a = window.__SS__!; await a.loadScenario('horde-arena'); a.settings.set({ quality: mobile ? 'low' : 'high' }); a.pause(); a.cheats.god(true);
      for (let i = 0; i < (mobile ? 100 : 200); i++) a.spawn('infected.runner', { x: i % 20 * .65 - 6.5, z: Math.floor(i / 20) * .65 - 3.25 }, { state: 'chase' });
      await a.step(0); await a.screenshotReady();
    }, mobile);
    const proof = await page.evaluate(async () => {
      const a = window.__SS__!, intervals: number[] = []; a.resume(); let previous = 0;
      const start = performance.now(), startTick = a.tick();
      for (let i = 0; i < 180 || performance.now() - start < 12_000; i++) { const now = await new Promise<number>(resolve => requestAnimationFrame(resolve)); if (i > 30) intervals.push(now - previous); previous = now; }
      a.pause(); intervals.sort((a, b) => a - b);
      return { infected: a.getState().ai!.count, renderTier: a.getState().render.quality, actorState: 'chase', ticks: a.tick() - startTick, durationMs: performance.now() - start, p95Ms: intervals[Math.floor(intervals.length * .95)], perf: a.perf() };
    });
    mkdirSync('test-results/r1-grade', { recursive: true }); writeFileSync(`test-results/r1-grade/horde-${mobile ? 'low' : 'high'}.json`, JSON.stringify(proof, null, 2));
    expect(proof.infected).toBe(mobile ? 100 : 200); expect(proof.ticks).toBeGreaterThanOrEqual(300); expect(proof.renderTier).toBe(mobile ? 'low' : 'high'); expect(proof.p95Ms).toBeLessThanOrEqual(mobile ? 1000 / 30 : 1000 / 60);
    expect(proof.perf.drawCalls).toBeLessThanOrEqual(mobile ? 300 : 600); expect(proof.perf.triangles).toBeLessThanOrEqual(mobile ? 500_000 : 1_500_000);
  });
});
