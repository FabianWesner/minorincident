import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { boot, expect, test } from '../e2e/fixtures';
const output = 'test-results/epics/E06';
for (const [category, id, shape] of [['ranged', 'weapon.pistol', 'line'], ['melee', 'weapon.bat', 'cone'], ['throwable', 'weapon.grenade', 'arc']] as const) test(`T-E06-09-${category} @E06 @E06-AC09 @visual selected-side ${category} indicator`, async ({ page }) => {
  mkdirSync(output, { recursive: true }); await boot(page);
  await page.evaluate(async (id) => {
    const api = window.__SS__!; await api.loadScenario('combat-arena', { seed: 1 }); api.pause(); api.setLoadout([id], [id]);
    api.camera.preset('aim'); api.spawn('infected.runner', { x: 5, z: 2 }); api.spawn('weapon.machete', { x: -2, z: -2 });
    api.input.set({ aim: { x: 1, z: 0 }, aimPoint: { x: 8, z: 0 } }); await api.step(1); api.input.clear(); await api.screenshotReady();
  }, id);
  const states = [];
  for (const side of ['LEFT', 'RIGHT'] as const) {
    if (side === 'RIGHT') await page.evaluate(async () => { const api = window.__SS__!; api.input.set({ right: { down: true, held: true, up: false }, aim: { x: 0.8, z: 0.6 }, aimPoint: { x: 8, z: 3 } }); await api.step(1); api.input.clear(); await api.screenshotReady(); });
    const state = await page.evaluate(() => window.__SS__!.getState().render.actions!); expect(state.indicator.selectedSide).toBe(side); expect(state.indicator.visibleSides).toEqual([side]); expect(state.indicator.shape).toBe(shape); expect(state.indicator.vertices).toBeGreaterThan(shape === 'arc' ? 400 : 0); states.push(state);
    const image = PNG.sync.read(await page.screenshot({ path: `${output}/aim-${category}-${side.toLowerCase()}.png` }));
    let colored = 0;
    for (let i = 0; i < image.data.length; i += 4) { const [r, g, b] = image.data.subarray(i, i + 3); if (side === 'LEFT' ? r > 220 && g > 150 && b < 140 : r < 130 && g > 220 && b > 160) colored++; }
    expect(colored, `${side} indicator pixels`).toBeGreaterThan(80);
  }
  writeFileSync(`${output}/aim-${category}.json`, JSON.stringify(states, null, 2));
});
