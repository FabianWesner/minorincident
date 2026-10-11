import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';

/** Production L4 set piece at its authored camera; fixed-clock evidence for checklist H. */
test('T-E27-15 @E27 @E27-AC15 L4 collapse fuel-truck sequence and persistent town aftermath', async ({ page }) => {
  test.setTimeout(180_000); await boot(page);
  const out = 'test-results/epics/E27/collapse'; mkdirSync(out, { recursive: true });
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L4', { seed: 2, progression: 'L4-default' });
    a.pause(); a.missions.begin(); a.cheats.god(true); a.settings.set({ cameraShake: false });
    a.cheats.completeObjective('ride'); await a.step(180); a.cheats.completeObjective('quartermaster');
    a.teleport('player', { x: -17, z: 3 }); a.camera.preset('D-FAIR/W0/l4-collapse'); await a.step(8);
    a.cheats.completeObjective('hold');
  });
  const frames = []; let at = 0;
  for (const tick of [0, 2, 6, 15, 40, 120, 150, 180, 182, 186, 195, 220, 300, 600, 900]) {
    const state = await page.evaluate(async n => {
      const a = window.__SS__!;
      for (let i = 0; i < n; i++) { await a.step(1); a.vfx.stepRender(1 / 60); }
      await a.screenshotReady();
      return { tick: a.tick(), phase: a.missions.state()!.l4!.phase, blasts: a.getState().render.vfx!.blasts,
        explosions: a.events(0).filter(e => e.type === 'explosion').map(e => ({ def: e.defId, tick: e.tick })) };
    }, tick - at);
    at = tick; frames.push({ elapsed: tick, ...state });
    await page.locator('canvas').screenshot({ path: `${out}/t${String(tick).padStart(3, '0')}.png` });
  }
  writeFileSync(`${out}/sequence.json`, JSON.stringify(frames, null, 2));
  expect(frames.at(-1)!.phase).toBe('collapse');
  expect(frames.at(-1)!.explosions.some(e => e.def === 'explosion.gas-tanks')).toBe(true);
  expect(frames.at(-1)!.blasts.columns).toBeGreaterThanOrEqual(4);
  expect(frames.at(-1)!.blasts.scorch).toBeGreaterThan(0);
});
