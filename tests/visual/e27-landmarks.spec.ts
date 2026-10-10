import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';

test('T-E27-13 @E27 @E27-AC13 L5 pair-plaza draws persistent smoke columns and directional ground strips', async ({ page }) => {
  test.setTimeout(120_000); await boot(page);
  const proof = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L5', { seed: 2, progression: 'L5-default' }); a.pause(); a.missions.begin(); a.cheats.god(true);
    a.cheats.completeObjective('emerge'); await a.step(600);
    a.teleport('player', { x: -17, z: 3 }); a.camera.preset('D-FAIR/W5/pair-plaza'); await a.step(8);
    // Allow the render emitters to mature at fixed increments, independent of browser speed.
    for (let i = 0; i < 150; i++) a.vfx.stepRender(.1);
    await a.screenshotReady();
    const columns = a.query({ archetype: 'hazard.fire' }).filter(e => a.tick() < e.hazard!.activeUntil).map(e => ({ at: e.transform, radius: e.hazard!.radius, top: a.camera.project(e.transform.x, e.hazard!.radius >= 1.6 ? 18 : 10, e.transform.z) }));
    return { columns, visible: columns.filter(c => Math.abs(c.top[0]) < 1 && Math.abs(c.top[1]) < 1).length, blasts: a.getState().render.vfx!.blasts, lighting: a.getState().render.lighting };
  });
  const out = 'test-results/epics/E27'; mkdirSync(out, { recursive: true });
  await page.locator('canvas').screenshot({ path: `${out}/ac13-pair-plaza.png` });
  writeFileSync(`${out}/ac13-landmarks.json`, JSON.stringify(proof, null, 2));
  expect(proof.visible).toBeGreaterThanOrEqual(4);
  expect(proof.blasts.columns).toBeGreaterThanOrEqual(4); expect(proof.blasts.columnShadows).toBeGreaterThanOrEqual(4);
  expect(proof.blasts.puffs).toBeGreaterThan(40);
});
