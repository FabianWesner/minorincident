import { PNG } from 'pngjs';
import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';
// L1 v2 replaced the diner/hardware story these checks assume; the L1 v2 playthrough is tests/e2e/levels/L1.spec.ts.
test.beforeEach(() => { test.fixme(true, 'old L1 diner flow retired (L1 v2)'); });
const models = ['bld.maple-hardware', 'npc.civilian-adult-m', 'npc.civilian-adult-f', 'veh.pickup-white', 'veh.sedan-green', 'veh.suv-green', 'prop.shopping-cart', 'prop.sofa', 'prop.pallet', 'prop.plank-stack', 'bld.house-b', 'bld.house-c', 'bld.joes-diner', 'inf.crawler', 'prop.tree', 'prop.flower', 'veh.wreck', 'prop.bus-stop'];
for (const id of models) test(`L1 art ${id} loads every runtime LOD without placeholders`, async ({ page }) => {
  mkdirSync('test-results/l1-assets', { recursive: true });
  await page.goto(`/preview/?asset=${id}&test=1&renderer=webgl`);
  await page.waitForFunction(() => !!window.__ASSET__);
  await page.evaluate(() => window.__ASSET__!.ready);
  let previous = Infinity;
  for (const quality of ['high', 'lod1', 'lod2']) {
    if (quality !== 'high') {
      await page.selectOption('#quality', quality);
      await page.waitForFunction((last) => window.__ASSET__!.info().triangles < last, previous);
    }
    const info = await page.evaluate(() => window.__ASSET__!.info());
    expect(info.placeholder).toBe(false);
    expect(info.events).toEqual([]);
    expect(info.triangles).toBeGreaterThan(0);
    previous = info.triangles;
    if (id === 'bld.maple-hardware') for (const node of ['roof', 'interior', 'door_front']) expect(info.nodes).toContain(node);
    await page.locator('canvas').screenshot({ path: `test-results/l1-assets/${id}-${quality}.png` });
  }
  if (id === 'bld.maple-hardware') {
    await page.selectOption('#quality', 'high');
    await page.waitForFunction(() => window.__ASSET__!.info().triangles > 10_000);
    await page.evaluate(() => window.__ASSET__!.visibility('roof', false));
    await page.locator('canvas').screenshot({ path: 'test-results/l1-assets/maple-interior.png' });
  }
});

test('L1 portraits and melee icons appear in the game HUD', async ({ page }) => {
  const { hudStart } = await import('./ui-helpers');
  await hudStart(page);
  await expect(page.getByTestId('survivor-portrait')).toHaveCSS('background-image', /portrait-survivor-f\.png/);
  await expect(page.getByTestId('corgi-portrait')).toHaveCSS('background-image', /portrait-corgi\.png/);
  await expect(page.getByTestId('corgi-portrait')).toHaveCSS('background-size', 'cover');
  await page.evaluate(async () => { await Promise.all(['survivor-f', 'survivor-m', 'corgi'].map(async id => { const image = new Image(); image.src = `/assets/ui/portrait-${id}.png`; await image.decode(); })); });
  await page.screenshot({ path: 'test-results/l1-assets/hud-female.png' });
  await page.evaluate(async () => { window.__SS__!.survivor.select('male'); await window.__SS__!.step(1); await window.__SS__!.screenshotReady(); });
  await expect(page.getByTestId('survivor-portrait')).toHaveCSS('background-image', /portrait-survivor-m\.png/);
  await page.screenshot({ path: 'test-results/l1-assets/hud-male.png' });
  for (const weapon of ['weapon.bat', 'weapon.crowbar', 'weapon.machete', 'weapon.kick', 'weapon.fists']) {
    await page.evaluate(async (id) => { const api = window.__SS__!; api.setLoadout([id], [id]); await api.step(1); await api.screenshotReady(); }, weapon);
    await page.screenshot({ path: `test-results/l1-assets/hud-${weapon}.png` });
  }
});

for (const id of ['decal.blood-splats', 'decal.blood-pool', 'decal.blood-trail']) test(`L1 ${id} renders its registered transparent texture`, async ({ page }) => {
  mkdirSync('test-results/l1-assets', { recursive: true });
  await page.goto(`/preview/?asset=${id}&test=1&renderer=webgl`);
  await page.waitForFunction(() => !!window.__ASSET__);
  await page.evaluate(() => window.__ASSET__!.ready);
  const info = await page.evaluate(() => window.__ASSET__!.info());
  expect(info.placeholder).toBe(false); expect(info.events).toEqual([]);
  const image = PNG.sync.read(await page.locator('canvas').screenshot({ path: `test-results/l1-assets/${id}.png` }));
  let red = 0;
  for (let i = 0; i < image.data.length; i += 4) if (image.data[i] > 20 && image.data[i] > image.data[i + 1] * 1.5 && image.data[i] > image.data[i + 2] * 1.5) red++;
  expect(red).toBeGreaterThan(100);
});
