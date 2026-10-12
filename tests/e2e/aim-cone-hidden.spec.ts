import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';

/** PO 10-12: "This yellow triangle is not needed" (melee aim sector on the ground). Hidden unless ?debug or ?aimcone=1. */
for (const [query, drawn] of [['', false], ['&aimcone=1', true]] as const) {
  test(`melee aim sector is ${drawn ? 'drawn only with ?aimcone=1' : 'not drawn in normal play'}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/?test=1&scenelab=1&renderer=webgl&audio=muted&quality=high&dpr=1${query}`);
    await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); await window.__SCENE__!.load({ ground: 'grass', actors: [{ id: 'courier', kind: 'courier', at: [0, 0], loadout: ['weapon.bat', 'weapon.fists'] }], camera: { mode: 'game', target: [0, 0], zoom: 0.8 } }); });
    for (const side of ['LEFT', 'RIGHT'] as const) {
      const state = await page.evaluate(async (side) => {
        const a = window.__SS__!; a.setLoadout(['weapon.bat'], ['weapon.bat']); window.__SCENE__!.command('courier', { select: side });
        a.input.set({ aim: { x: 1, z: 0 }, aimPoint: { x: 4, z: 0 } }); await window.__SCENE__!.step(1); a.input.clear();
        return a.getState().render.actions!.indicator;
      }, side);
      if (side === 'LEFT') { await page.evaluate(() => window.__SS__!.screenshotReady()); mkdirSync('docs/reports/ui-home-button', { recursive: true }); await page.screenshot({ path: `docs/reports/ui-home-button/${drawn ? 'before' : 'after'}-sector.png` }); }
      expect(state.shape).toBe('cone');
      if (drawn) expect(state.vertices).toBeGreaterThan(0); else expect(state.vertices).toBe(0);
    }
  });
}
