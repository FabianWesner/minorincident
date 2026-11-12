import { mkdirSync } from 'node:fs';
import { test, expect, boot } from './fixtures';

const hangarWeapons = ['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg', 'weapon.shotgun', 'weapon.rocket-launcher', 'weapon.pipe-bomb', 'weapon.hunting-rifle', 'weapon.nail-gun', 'weapon.machete', 'weapon.molotov', 'weapon.assault-rifle', 'weapon.flashbang', 'weapon.flamethrower'];

test('L10 hangar rack exposes every issued weapon to click and keyboard', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    const api = window.__SS__!;
    await api.loadLevel('L10', { seed: 1 }); api.pause(); api.missions.begin(); api.cheats.god(true);
    for (const step of ['crash', 'farmstead', 'restricted-zone', 'research-hangar']) { api.cheats.completeObjective(step); await api.step(1); }
    await api.screenshotReady();
  });
  const ids = await page.evaluate(() => {
    const p = window.__SS__!.getState().player!;
    return [...new Set([...p.weapons!.LEFT.rack, ...p.weapons!.RIGHT.rack].map(slot => slot.id))];
  });
  expect(ids).toEqual(expect.arrayContaining(hangarWeapons));
  expect(await page.locator('.hud-weapon-rack .hud-weapon-choice').count()).toBeGreaterThanOrEqual(14);
  mkdirSync('test-results/l10-rack', { recursive: true });
  await page.screenshot({ path: 'test-results/l10-rack/rack-high-1280x720.png' });

  for (const id of hangarWeapons) {
    await page.locator(`.hud-weapon-choice[data-weapon="${id}"]`).click();
    await page.evaluate(async () => { await window.__SS__!.step(16); });
    const selected = await page.evaluate(() => { const p = window.__SS__!.getState().player!, side = p.weapons!.selectedSide, rack = p.weapons![side]; const id = rack.index < 0 ? 'weapon.fists' : rack.rack[rack.index].id; return id === 'weapon.kick' ? 'weapon.fists' : id; });
    expect(selected, `rack click for ${id}`).toBe(id);
  }
  // Q cycles the complete de-duplicated rack. Every click-selected weapon must also be reachable in keyboard order.
  const seen = new Set<string>();
  for (let i = 0; i < hangarWeapons.length * 2 && seen.size < hangarWeapons.length; i++) {
    await page.keyboard.press('q');
    await page.evaluate(async () => { await window.__SS__!.step(16); });
    const selected = await page.evaluate(() => { const p = window.__SS__!.getState().player!, side = p.weapons!.selectedSide, rack = p.weapons![side]; const id = rack.index < 0 ? 'weapon.fists' : rack.rack[rack.index].id; return id === 'weapon.kick' ? 'weapon.fists' : id; });
    if (hangarWeapons.includes(selected)) seen.add(selected);
  }
  expect([...seen].sort()).toEqual([...hangarWeapons].sort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => { await window.__SS__!.screenshotReady(); });
  const rack = await page.locator('.hud-weapon-rack').boundingBox();
  expect(rack).not.toBeNull();
  expect(rack!.x + rack!.width).toBeLessThanOrEqual(390);
  expect(rack!.y + rack!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: 'test-results/l10-rack/rack-high-phone-390x844.png' });
});

test('L10 throwable preview captures at HIGH zoom 1 and 1.5', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await boot(page);
  await page.evaluate(async () => {
    const api = window.__SS__!;
    await api.loadLevel('L10', { seed: 1 }); api.pause(); api.missions.begin();
    api.setLoadout(['weapon.molotov', 'weapon.fire-axe'], ['weapon.pipe-bomb']);
    api.cheats.infiniteCharges(true); api.camera.follow();
    const p = api.getState().player!.transform;
    api.input.set({ aim: { x: 1, z: 0 }, aimPoint: { x: p.x + 8, z: p.z }, aimSource: 'keyboard' });
    await api.step(1); await api.screenshotReady();
  });
  mkdirSync('test-results/l10-rack', { recursive: true });
  for (const zoom of [1, 1.5]) {
    await page.evaluate(async value => { const api = window.__SS__!; api.camera.zoom(value); await api.screenshotReady(); }, zoom);
    await page.screenshot({ path: `test-results/l10-rack/molotov-high-z${zoom}.png` });
  }
});
