import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { hudStart, menuStart } from './ui-helpers';
const dir = 'test-results/epics/E14';
async function photo(page: import('@playwright/test').Page, name: string): Promise<void> {
  mkdirSync(dir, { recursive: true }); await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${dir}/${name}.png` });
}
test('T-E14-01 @E14 @E14-AC01 all HUD nodes have IDs; HP, ammo, charges and side reflect state in one frame', async ({ page }) => {
  await hudStart(page);
  expect(await page.getByTestId('hud').locator('*:not([data-testid])').count()).toBe(0);
  const result = await page.evaluate(async () => {
    const api = window.__SS__!; api.survivor.damage(40);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const health = document.querySelector<HTMLElement>('[data-testid=health-fill]')!, bar = health.parentElement!;
    return { hp: api.getState().player!.health, ratio: health.clientWidth / bar.clientWidth };
  });
  expect(result.ratio).toBeCloseTo(result.hp.current / result.hp.max, 2);
  await page.evaluate(async () => { window.__SS__!.input.set({ right: { down: true, held: false, up: true } }); await window.__SS__!.step(1); window.__SS__!.input.clear(); });
  const weapons = (await page.evaluate(() => window.__SS__!.getState())).player!.weapons!;
  await expect(page.getByTestId('stats-LEFT')).toHaveAttribute('data-ammo', String(weapons.LEFT.rack[0].magazine));
  await expect(page.getByTestId('stats-RIGHT')).toHaveAttribute('data-charges', String(weapons.RIGHT.rack[0].charges));
  await expect(page.getByTestId('slot-RIGHT')).toHaveClass(/is-selected/);
  await expect(page.getByTestId('slot-LEFT')).not.toHaveClass(/is-selected/);
});
test('T-E14-02 @E14 @E14-AC02 selected card switches with physical J/K and is visually highlighted', async ({ page }) => {
  await hudStart(page);
  for (const [key, side] of [['KeyJ', 'LEFT'], ['KeyK', 'RIGHT']] as const) {
    await page.keyboard.press(key); await page.evaluate(() => window.__SS__!.step(1));
    await expect(page.getByTestId(`slot-${side}`)).toHaveClass(/is-selected/);
    await expect(page.getByTestId(`slot-${side}`)).toHaveCSS('border-top-color', 'rgb(255, 205, 121)');
    await photo(page, `selected-${side.toLowerCase()}`);
  }
});
test('T-E14-06 @E14 @E14-AC06 hud-golden desktop/mobile evidence for checklist F', async ({ page }) => {
  await hudStart(page);
  await page.evaluate(() => { const api = window.__SS__!; const p = api.getState().player!.transform; api.spawn('infected.runner', { x: p.x + 7, z: p.z + 3 }); api.spawn('infected.runner', { x: p.x - 5, z: p.z + 4 }); });
  await photo(page, 'hud-golden');
  const perf = await page.evaluate(() => window.__SS__!.perf()); writeFileSync(`${dir}/perf.json`, JSON.stringify(perf, null, 2));
  await page.setViewportSize({ width: 390, height: 844 }); await photo(page, 'hud-mobile');
  await expect(page.getByTestId('vitals')).toBeVisible(); await expect(page.getByTestId('minimap')).toBeVisible();
  await expect(page.getByTestId('slot-LEFT')).toBeVisible();
});
test('T-E14-07 @E14 @E14-AC07 text scales 1/1.25/1.5 without DOM overflow at all reference viewports', async ({ page }) => {
  await hudStart(page);
  for (const viewport of [{ width: 1600, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.__SS__!.settings.set({ textSize: 1 }));
    const base = await page.getByTestId('objective-tracker').evaluate(e => parseFloat(getComputedStyle(e).fontSize));
    for (const textSize of [1, 1.25, 1.5] as const) {
      await page.evaluate(textSize => window.__SS__!.settings.set({ textSize }), textSize);
      const data = await page.getByTestId('hud').evaluate(root => ({
        font: parseFloat(getComputedStyle(root.querySelector('[data-testid=objective-tracker]')!).fontSize),
        overflow: Array.from(root.querySelectorAll<HTMLElement>('*')).filter(e => e.getClientRects().length && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1).map(e => ({ id: e.dataset.testid, scroll: e.scrollWidth, width: e.clientWidth })),
      }));
      expect(data.font / base).toBeCloseTo(textSize, 2);
      expect(data.overflow).toEqual([]);
    }
  }
});
test('T-E14-08 @E14 @E14-AC08 pause freezes tick while HUD/settings remain responsive', async ({ page }) => {
  await menuStart(page); await page.getByTestId('pause-button').click();
  const tick = await page.evaluate(() => window.__SS__!.tick()); await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__SS__!.tick())).toBe(tick);
  await expect(page.getByTestId('hud')).toBeVisible();
  await page.getByTestId('pause-settings').click(); await page.getByTestId('setting-textSize').selectOption('1.5');
  await expect(page.getByTestId('objective-tracker')).toHaveCSS('font-size', '21px');
  expect(await page.evaluate(() => window.__SS__!.tick())).toBe(tick);
  await page.getByTestId('settings-back').click(); await page.getByTestId('resume-game').click();
  await expect.poll(() => page.evaluate(() => window.__SS__!.tick())).toBeGreaterThan(tick);
});
test('T-E14-10 @E14 @E14-AC10 north-up player/objective/threat projections agree within one meter; threats limited to 30m', async ({ page }) => {
  await hudStart(page);
  const ids = await page.evaluate(() => {
    const api = window.__SS__!, p = api.getState().player!.transform;
    return [api.spawn('infected.runner', { x: p.x + 10, z: p.z - 12 }), api.spawn('infected.runner', { x: p.x + 29.9, z: p.z }), api.spawn('infected.runner', { x: p.x + 30.1, z: p.z })];
  });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  const data = await page.evaluate(() => {
    const api = window.__SS__!, state = api.getState(), p = state.player!.transform;
    const map = document.querySelector<HTMLElement>('[data-testid=minimap]')!;
    const pins = Array.from(map.querySelectorAll<HTMLElement>('.hud-pin:not([hidden])')).map(pin => ({ id: Number(pin.dataset.entityId), testid: pin.dataset.testid, x: p.x + (parseFloat(pin.style.left) - 50) / 44 * 30, z: p.z + (parseFloat(pin.style.top) - 50) / 44 * 30 }));
    return { state, pins };
  });
  expect(data.pins.find(pin => pin.testid === 'minimap-player')).toMatchObject({ x: data.state.player!.transform.x, z: data.state.player!.transform.z });
  for (const id of ids.slice(0, 2)) {
    const pin = data.pins.find(pin => pin.id === id)!, e = data.state.entities.find(e => e.id === id)!;
    expect(pin).toBeDefined(); expect(Math.hypot(pin.x - e.transform.x, pin.z - e.transform.z)).toBeLessThan(1);
  }
  expect(data.pins.some(pin => pin.id === ids[2])).toBe(false);
  const objective = data.pins.find(pin => pin.testid === 'minimap-objective')!;
  expect(Math.hypot(objective.x - 5, objective.z)).toBeLessThan(1);
});
