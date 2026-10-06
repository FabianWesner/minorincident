import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import { worldLook } from '../../src/data/worldLook';
const paletteTokens = Object.keys(JSON.parse(readFileSync('src/assets/palette.json', 'utf8')));

test('@E19 lookdev panel binds, exports and resets on production without the test API', async ({ page }) => {
  await page.goto('/?lookdev&renderer=webgl&quality=high&audio=muted&seed=1');
  const panel = page.locator('[data-lookdev="panel"]');
  await expect(panel).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => window.__SS__)).toBeUndefined();
  expect(await panel.locator('.tp-lblv_l').allTextContents()).toEqual(expect.arrayContaining([...Object.keys(worldLook), ...paletteTokens]));
  await panel.getByRole('button', { name: 'Light & shadow', exact: true }).click();
  const input = panel.locator('.tp-lblv').filter({ hasText: /^sunIntensity/ }).locator('input').last();
  await input.fill('2'); await input.press('Tab');
  await expect(page.locator('[data-lookdev="status"]')).toHaveText('Live edit applied');
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export JSON patch' }).click();
  const file = await download;
  expect(JSON.parse(readFileSync((await file.path())!, 'utf8'))).toEqual({ version: 1, worldLook: { sunIntensity: 2 }, palette: {} });
  await panel.getByRole('button', { name: 'Reset look', exact: true }).click();
  await expect(input).toHaveValue(String(worldLook.sunIntensity));
});

test('@E19 look uniforms change pixels while paused and survive quality and level rebuilds', async ({ page }) => {
  await page.goto('/?test=1&lookdev&renderer=webgl&quality=high&audio=muted&seed=1&dpr=1');
  await expect(page.locator('[data-lookdev="panel"]')).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-lookdev="panel"]').evaluate(el => { (el as HTMLElement).style.display = 'none'; });
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.camera.preset('V1'); await a.screenshotReady(); });
  const before = await page.locator('canvas').first().screenshot();
  const patch = { version: 1 as const, worldLook: { sun: '#ff9966', sunIntensity: 2, shadow: '#552288', fogA: '#aabbdd', fogB: '#ddbbaa', fogCenterX: .4, fogCenterY: .3, blossomPink: '#eeaabb', worldSurvivorRed: '#aa6677', dofRepeatsLow: 4, coreLightEdge: .9, bloomStrength: .7, dofRepeats: Number(worldLook.dofRepeats) === 16 ? 25 : 16, vignette: .3, grassHeight: .3, grassDensity: 10, foliageDensity: .5, foliageHeight: 1.3, windStrength: 0 }, palette: { woodWarm: '#dd9955' } };
  const state = await page.evaluate(async patch => {
    const a = window.__SS__!, tick = a.tick(); a.look.set(patch); await a.screenshotReady();
    return { tick, afterTick: a.tick(), render: a.getState().render, exported: a.look.export() };
  }, patch);
  expect(state.afterTick).toBe(state.tick); expect(state.exported).toEqual(patch);
  expect(state.render.lighting!.sunColor).toBe('#ff9966'); expect(state.render.lighting!.intensity).toBe(2);
  expect(state.render.postFx!.dofRepeats).toBe(patch.worldLook.dofRepeats); expect(state.render.postFx!.bloomStrength).toBe(.7);
  const after = await page.locator('canvas').first().screenshot();
  const { PNG } = await import('pngjs'), { default: pixelmatch } = await import('pixelmatch');
  const a = PNG.sync.read(before), b = PNG.sync.read(after);
  expect(pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: .05 })).toBeGreaterThan(1000);
  const rebuilt = await page.evaluate(async () => {
    const a = window.__SS__!; a.settings.set({ quality: 'low' }); await a.loadLevel('L1', { seed: 1 }); a.pause(); a.camera.preset('V1'); await a.screenshotReady(); const low = a.getState().render.postFx; a.settings.set({ quality: 'high' }); await a.screenshotReady();
    return { patch: a.look.export(), render: a.getState().render, low };
  });
  expect(rebuilt.low).toMatchObject({ dof: true, dofRepeats: 4, dofResolution: .5 });
  expect(rebuilt.render.lighting!.coreShadowEdges).toEqual([.9, -.25]);
  expect(rebuilt.patch).toEqual(patch); expect(rebuilt.render.postFx!.dofRepeats).toBe(patch.worldLook.dofRepeats); expect(rebuilt.render.lighting!.intensity).toBe(2);
  await page.evaluate(() => window.__SS__!.look.reset());
  expect(await page.evaluate(() => window.__SS__!.look.export())).toEqual({ version: 1, worldLook: {}, palette: {} });
});

test('@E19 crown foliage responds to live palette, density, height and wind controls', async ({ page }) => {
  await page.goto('/?test=1&lookdev&renderer=webgl&quality=low&audio=muted&seed=1&dpr=1');
  await expect(page.locator('[data-lookdev="panel"]')).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-lookdev="panel"]').evaluate(el => { (el as HTMLElement).style.display = 'none'; });
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.camera.preset('V2'); a.look.set({ version: 1, worldLook: { windStrength: 0 }, palette: {} }); await a.screenshotReady(); });
  const baseline = await page.locator('canvas').first().screenshot();
  const initial = await page.evaluate(() => window.__SS__!.getState().render.districts!.foliage);
  expect(initial.visible).toBeGreaterThan(0);
  const hidden = await page.evaluate(async () => {
    const a = window.__SS__!, tick = a.tick(); a.look.set({ version: 1, worldLook: { foliageDensity: 0 }, palette: {} }); await a.screenshotReady();
    return { tick, afterTick: a.tick(), foliage: a.getState().render.districts!.foliage };
  });
  expect(hidden.afterTick).toBe(hidden.tick); expect(hidden.foliage.visible).toBe(0);
  await page.evaluate(async () => { const a = window.__SS__!; a.look.reset(); a.look.set({ version: 1, worldLook: { windStrength: 0 }, palette: {} }); await a.screenshotReady(); });
  expect(await page.evaluate(() => window.__SS__!.getState().render.districts!.foliage.visible)).toBe(initial.visible);
  const { PNG } = await import('pngjs'), { default: pixelmatch } = await import('pixelmatch');
  for (const section of ['worldLook', 'palette'] as const) {
    await page.evaluate(async section => {
      const a = window.__SS__!; a.look.reset(); a.look.set({ version: 1, worldLook: { windStrength: 0, ...(section === 'worldLook' ? { foliageDark: '#2255ee', foliageLight: '#55aaff' } : {}) }, palette: section === 'palette' ? { foliageDark: '#2255ee', foliageLight: '#55aaff' } : {} }); await a.screenshotReady();
    }, section);
    const before = PNG.sync.read(baseline), after = PNG.sync.read(await page.locator('canvas').first().screenshot());
    expect(pixelmatch(before.data, after.data, undefined, before.width, before.height, { threshold: .05 }), `${section} changes rendered crowns`).toBeGreaterThan(1000);
  }
  const scaled = await page.evaluate(async () => {
    const a = window.__SS__!; a.look.reset(); a.look.set({ version: 1, worldLook: { foliageHeight: 1.3, foliageDensity: .5, windStrength: 0 }, palette: {} }); await a.screenshotReady(); return a.getState().render.districts!.foliage;
  });
  expect(scaled.height).toBe(1.3); expect(scaled.windStrength).toBe(0); expect(scaled.visible).toBeLessThan(initial.visible);
  await page.evaluate(async () => { window.__SS__!.look.reset(); await window.__SS__!.screenshotReady(); });
  expect(await page.evaluate(() => window.__SS__!.getState().render.districts!.foliage)).toMatchObject({ height: 1, density: 1, windStrength: 1, visible: initial.visible });
});
