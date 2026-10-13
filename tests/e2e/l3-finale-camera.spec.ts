import { devices } from '@playwright/test';
import { expect, test } from './fixtures';

/** PO 10-13: "End of L3, I can zoom out which I shouldn't" and "on regular zoom the player isn't visible anymore".
 * Through the L3 finale (scripted pull-back + army-line framing) the player's zoom cannot widen the shot, the player stays inside
 * the central safe area (|NDC| <= .6, clear of the HUD), and once the beat ends the player's own zoom is back. */
for (const profile of ['desktop', 'phone'] as const) test.describe(profile, () => {
  if (profile === 'phone') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  test(`@E21 L3 finale keeps zoom scripted and the player in the safe area (${profile})`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto(`/?test=1&renderer=webgl&quality=low&audio=muted&seed=1`);
    await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L3', { seed: 1, progression: 'L3-default', checkpoint: 'fallback' } as never); a.pause(); a.missions.begin(); a.cheats.god(true); await a.step(1); });
    const ndc = () => page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform, q = a.camera.project(p.x, p.y, p.z); return { x: q[0], y: q[1], radius: a.getState().render.camera.radius, zoom: a.getState().render.camera.zoom }; });
    const wheel = async (dy: number, times = 8) => { await page.mouse.move(200, 300); for (let i = 0; i < times; i++) { await page.mouse.wheel(0, dy); await page.waitForTimeout(40); } };
    // Enter the finale (x >= rescueX) on the army-line approach.
    await page.evaluate(async () => { const a = window.__SS__!; a.missions.teleport('player', { x: 225, z: -2.6 }); await a.step(120); });
    const l3 = await page.evaluate(() => { const m = window.__SS__!.missions.state()!.l3!; return { finaleAt: m.finaleAt, barrierClosedAt: m.barrierClosedAt }; });
    expect(l3.finaleAt, 'the finale beat is running').toBeGreaterThan(0); expect(l3.barrierClosedAt ?? 0).toBe(0);
    console.log('finale', JSON.stringify(l3), JSON.stringify(await ndc()));
    for (const dy of [120, -120]) {
      await wheel(dy); await page.evaluate(() => window.__SS__!.step(90));
      const before = await ndc();
      await wheel(dy); await page.evaluate(() => window.__SS__!.step(60));
      const after = await ndc();
      expect(after.radius, 'wheel cannot change the scripted framing').toBeCloseTo(before.radius, 1);
      for (const p of [before, after]) { expect(Math.abs(p.x), 'player inside the central safe area (x)').toBeLessThanOrEqual(.6); expect(Math.abs(p.y), 'player inside the central safe area (y)').toBeLessThanOrEqual(.6); }
    }
    // Scripted beat ends (the courier leaves the line): the player's zoom limits are intact and the pull-back eases back.
    await page.evaluate(async () => { const a = window.__SS__!; a.missions.teleport('player', { x: 100, z: 0 }); await a.step(240); });
    const limits = await page.evaluate(() => window.__SS__!.getState().render.camera.zoomLimits);
    await wheel(120, 30); await page.evaluate(() => window.__SS__!.step(90));
    const out = await ndc();
    expect(out.zoom).toBeLessThanOrEqual(limits[1] + 1e-6);
    expect(out.zoom).toBeGreaterThan(1);
    await wheel(-120, 60); await page.evaluate(() => window.__SS__!.step(90));
    expect((await ndc()).zoom).toBeGreaterThanOrEqual(limits[0] - 1e-6);
  });
});
