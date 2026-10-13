import { mkdirSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';
import type { Game } from '../../../src/Game';
for (const renderer of ['webgl', 'webgpu']) for (const quality of ['high', 'low']) for (const hp of [1000, 0]) {
  test(`T-E31-15-browser-crash @E31-AC10 @E31-AC14 @E31-AC15 keyboard approach ${renderer}/${quality}/${hp}`, async ({ page }) => {
    test.setTimeout(180_000); mkdirSync('test-results/epics/E31/S6/browser', { recursive: true });
    await boot(page, `${testUrl.replace('renderer=webgl', `renderer=${renderer}`).replace('quality=high', `quality=${quality}`)}&scenelab=1&ui=1`);
    if (quality === 'low') await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(async hp => {
      const api = window.__SS__!; await api.loadLevel('L9', { seed: 31 }); api.pause();
      const game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world;
      const car = w.vehicles!.cars.get(w.missions!.l9!.state.carId)!;
      car.physics.body.setTranslation({ x: 455, y: 1, z: 0 }, true);
      w.vehicles!.damage(car.entity.id, 1000 - hp); w.entities.get(1)!.health.current = w.entities.get(1)!.health.max = 1;
      await api.step(1);
    }, hp);
    await page.keyboard.down('KeyW');
    for (let i = 0; i < 12 && await page.evaluate(() => window.__SS__!.getState().l9!.phase === 'driving'); i++) await page.evaluate(() => window.__SS__!.step(60));
    await page.keyboard.up('KeyW');
    expect(await page.evaluate(() => window.__SS__!.getState().l9!.phase)).toBe('approach');
    await page.keyboard.down('KeyE'); await page.keyboard.down('KeyA');
    await page.evaluate(() => window.__SS__!.step(301));
    await page.keyboard.up('KeyE'); await page.keyboard.up('KeyA');
    const impact = await page.evaluate(() => { const api = window.__SS__!, s = api.getState(); return { phase: s.l9!.phase, car: api.getEntity(s.l9!.carId)!, hp: s.player!.health.current, events: api.events().map(e => e.type) }; });
    expect(impact.phase).toBe('impact'); expect(impact.car.vehicle!.damage).toBe('exploded'); expect(impact.car.vehicle!.driver).toBeNull(); expect(impact.hp).toBe(1);
    expect(impact.events.filter(t => t === 'vehicle.exploded')).toHaveLength(1); expect(impact.events).not.toContain('level.completed');
    await expect(page.getByTestId('mission-subtitle')).toBeVisible();
    await expect(page.getByTestId('mission-subtitle')).toContainText('bridge gave way');
    const name = `${renderer}-${quality}-${hp}`;
    await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `test-results/epics/E31/S6/browser/${name}-impact.png` });
    await page.evaluate(() => window.__SS__!.step(250));
    expect(await page.evaluate(() => window.__SS__!.getState().player!.survivor!.scriptedClip)).toBe('crawl');
    await page.screenshot({ path: `test-results/epics/E31/S6/browser/${name}-crawl.png` });
    await page.evaluate(() => window.__SS__!.step(400));
    const finish = await page.evaluate(() => ({ s: window.__SS__!.getState(), events: window.__SS__!.events().map(e => e.type) }));
    expect(finish.s.l9!.finished).toBe(true); expect(finish.s.player!.health.current).toBeGreaterThanOrEqual(1);
    expect(finish.events.filter(t => t === 'level.completed')).toHaveLength(1); expect(finish.events.filter(t => t === 'vehicle.exploded')).toHaveLength(1);
  });
}
