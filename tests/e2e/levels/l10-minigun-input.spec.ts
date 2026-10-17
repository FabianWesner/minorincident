import type { Game } from '../../../src/Game';
import { mkdirSync } from 'node:fs';
import { test, expect, boot } from '../fixtures';

for (const touch of [false, true]) test.describe(touch ? 'phone minigun' : 'desktop minigun', () => {
  test.use({ hasTouch: touch, viewport: touch ? { width: 390, height: 844 } : { width: 1600, height: 900 } });
  test(`T-E32-29-minigun @E32-AC29 @E32-AC18 @E32-AC19 real mount, overheat, cooldown and rocket dismount ${touch ? 'touch' : 'keyboard/mouse'}`, async ({ page, context }) => {
    test.setTimeout(180_000);
    await boot(page, `/?test=1&scenelab=1&ui=1&renderer=webgl&quality=${touch ? 'low' : 'high'}&audio=muted&dpr=1`);
    await page.evaluate(async touch => {
      const a = window.__SS__!; await a.loadLevel('L10', { seed: 32, checkpoint: 'cure-disperse-ready', progression: 'L10-default' }); a.pause(); a.cheats.god(true); a.settings.set({ quality: touch ? 'low' : 'high' });
      const gun = (window.__SCENE__ as unknown as { game: Game }).game.world.mountedGun!;
      a.teleport('player', gun.placement); a.camera.follow(); await a.step(1); await a.screenshotReady();
    }, touch);
    const step = (ticks: number) => page.evaluate(ticks => window.__SS__!.step(ticks), ticks);
    if (touch) { await page.touchscreen.tap(200, 400); await step(1); }
    const cdp = await context.newCDPSession(page);
    const finger = async (down: boolean) => {
      const box = (await page.getByTestId('touch-right').boundingBox())!;
      await cdp.send('Input.dispatchTouchEvent', { type: down ? 'touchStart' : 'touchEnd', touchPoints: down ? [{ id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 }] : [] });
    };
    const interact = async () => {
      if (touch) { await expect(page.getByTestId('touch-interact')).toBeEnabled(); await page.getByTestId('touch-interact').tap(); }
      else await page.keyboard.press('e');
      await step(1);
    };
    const gun = () => page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game.world.mountedGun!;
      return { mounted: g.mounted, heat: g.heat, locked: g.locked };
    });
    await interact(); expect((await gun()).mounted).toBe(true);
    await expect(page.locator('.hud-heat-panel')).toHaveAttribute('data-mounted', 'true');
    if (touch) await finger(true); else { await page.mouse.move(1000, 450); await page.keyboard.down('k'); }
    await step(510);
    expect((await gun()).locked).toBe(true); expect((await gun()).heat).toBeCloseTo(1, 2);
    await expect(page.locator('.hud-heat-panel')).toHaveAttribute('data-state', 'locked');
    const out = 'test-results/epics/E32/real-input'; mkdirSync(out, { recursive: true });
    await page.screenshot({ path: `${out}/minigun-${touch ? 'phone' : 'desktop'}-locked.png` });
    const bounds = await page.locator('.hud-heat-panel').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    if (touch) await finger(false); else await page.keyboard.up('k');
    await step(240); expect((await gun()).locked).toBe(false); expect((await gun()).heat).toBeLessThan(.4);
    await interact(); expect((await gun()).mounted).toBe(false);
    const weapon = await page.evaluate(() => { const w = window.__SS__!.getEntity(1)!.weapons!; return w[w.selectedSide].rack[w[w.selectedSide].index].id; });
    expect(weapon).toBe('weapon.rocket-launcher');
    await cdp.detach();
  });
});
