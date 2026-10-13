import { mkdirSync } from 'node:fs';
import { test, expect } from './fixtures';
import { menuUrl } from './ui-helpers';
import type { Game } from '../../src/Game';

const dir = 'test-results/epics/E31';

async function seat(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`${menuUrl}&scenelab=1`); await page.waitForFunction(() => Boolean(window.__SS__ && window.__SCENE__));
  await page.evaluate(async () => {
    const api = window.__SS__!; await api.ready;
    await api.loadScenario('mission-sandbox'); api.pause(); api.missions.begin(); await api.step(1);
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world, p = w.entities.get(1)!.transform;
    const id = w.vehicles!.spawn('vehicle.military-apc', { x: p.x + 30, z: p.z }), car = w.vehicles!.cars.get(id)!;
    w.vehicles!.setFloorPolicy(id, true);
    Object.assign(w.entities.get(1)!.transform, { x: p.x + 30 + car.physics.def.doorX, z: p.z + car.physics.def.width / 2 + .55 });
    const t = w.entities.get(1)!.transform; w.physics.playerBody!.setTranslation(t, true); w.physics.playerBody!.setNextKinematicTranslation(t);
    await api.step(1);
  });
  await page.keyboard.down('KeyE'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('KeyE');
  await page.evaluate(() => window.__SS__!.step(75));
  expect(await page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.world.vehicles!.active)).not.toBeNull();
}

test('T-E31-08 @E31-AC08 durability HUD follows current/max within a frame, says Barely functional at zero, and no exit', async ({ page }) => {
  mkdirSync(dir, { recursive: true });
  await seat(page);
  const panel = page.getByTestId('vehicle-durability'), label = page.getByTestId('durability-label');
  await expect(panel).toBeVisible();
  await expect(label).toHaveText('Armor 1000 / 1000');
  await page.evaluate(() => { const w = (window.__SCENE__ as unknown as { game: Game }).game.world; w.vehicles!.damage(w.vehicles!.active!, 640); });
  const touch = test.info().project.name !== 'chromium';
  for (const viewport of touch ? [page.viewportSize()!] : [{ width: 1600, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.__SS__!.step(1));
    await expect(label).toHaveText('Armor 360 / 1000');
    const fill = await page.getByTestId('durability-fill').evaluate(e => e.clientWidth / e.parentElement!.clientWidth);
    expect(fill).toBeCloseTo(.36, 1);
    // Contrast of the label against the bar, and no overlap with other HUD panels or the touch zone.
    const boxes = await page.evaluate(() => {
      const rect = (id: string) => { const e = document.querySelector<HTMLElement>(`[data-testid=${id}]`); const r = e && e.getClientRects().length ? e.getBoundingClientRect() : null; return r && { x: r.x, y: r.y, w: r.width, h: r.height }; };
      const touch = Array.from(document.querySelectorAll<HTMLElement>('[data-touch-action],[data-touch-stick]')).filter(e => e.getClientRects().length).map(e => [`touch:${e.dataset.touchAction ?? 'stick'}`, (() => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()] as const);
      return { panel: rect('vehicle-durability'), others: [...touch, ...['vitals', 'corgi-companion', 'objective-tracker', 'minimap', 'pause-button', 'stick-zone', 'hud-stick-zone', 'weapon-active', 'story-bubble', 'onboarding-prompt', 'weather-icon', 'home-button', 'pause'].map(id => [id, rect(id)] as const)] };
    });
    const p = boxes.panel!; expect(p).not.toBeNull();
    for (const [id, r] of boxes.others) if (r) expect(p.x + p.w <= r.x || r.x + r.w <= p.x || p.y + p.h <= r.y || r.y + r.h <= p.y, `durability overlaps ${id} at ${viewport.width}x${viewport.height}`).toBe(true);
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${dir}/l9-floor-hud-${test.info().project.name}-${viewport.width}.png` });
  }
  await page.evaluate(() => { const w = (window.__SCENE__ as unknown as { game: Game }).game.world; w.vehicles!.damage(w.vehicles!.active!, 5000); });
  await page.evaluate(() => window.__SS__!.step(2));
  await expect(label).toHaveText('Barely functional');
  await expect(panel).toHaveAttribute('data-floor', 'true');
  await page.screenshot({ path: `${dir}/l9-floor-zero-${test.info().project.name}.png` });
  // The exit input does nothing, driving continues at the capped speed.
  await page.keyboard.down('KeyE'); await page.evaluate(() => window.__SS__!.step(2)); await page.keyboard.up('KeyE');
  await page.keyboard.down('KeyW'); await page.evaluate(() => window.__SS__!.step(600));
  const driven = await page.evaluate(() => { const w = (window.__SCENE__ as unknown as { game: Game }).game.world, car = w.vehicles!.cars.get(w.vehicles!.active!)!; return { active: w.vehicles!.active === car.entity.id, x: car.entity.transform.x, speed: car.physics.speed, types: w.events.events().map(e => e.type) }; });
  await page.keyboard.up('KeyW');
  expect(driven.active).toBe(true); expect(driven.x).toBeGreaterThan(20);
  expect(driven.speed).toBeLessThan(10.8 * 1.03);
  for (const forbidden of ['vehicle.exited', 'vehicle.exploded', 'vehicle.burning']) expect(driven.types).not.toContain(forbidden);
});
