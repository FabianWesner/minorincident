import { mkdirSync } from 'node:fs';
import { cure } from '../../../src/levels/L10/district';
import { test, expect, boot } from '../fixtures';

test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });
for (const backend of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) {
  test(`T-E32-20/22-S7 @E32-AC20 @E32-AC22 install and defend real E ${backend} ${quality} z${zoom}`, async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page, `/?test=1${backend === 'webgl' ? '&renderer=webgl' : ''}&quality=${quality}&audio=muted&dpr=1&ui=1`);
    await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L10', { seed: 327, checkpoint: 'cure-complex', progression: 'L10-default' }); a.pause(); a.cheats.god(true); a.camera.follow(); });
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(backend);
    if (zoom === .5) { await page.mouse.move(800, 450); for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100); }
    const go = async (at: readonly number[]) => page.evaluate(async ([x, z]) => { const a = window.__SS__!; a.teleport('player', { x, z }); a.camera.follow(); await a.screenshotReady(); }, [...at]);
    const press = async () => { await page.keyboard.down('e'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('e'); await page.evaluate(() => window.__SS__!.step(1)); };
    await go(cure.anchors['cure-install']); await press();
    const installed = await page.evaluate(() => window.__SS__!.missions.state()!);
    expect(installed.checkpoint).toBe('cure-disperse-ready'); expect(installed.states['cure-installed']).toBe(true);
    expect(installed.states['cure-carried']).toBe(false); expect(installed.counters['charge-ticks']).toBe(0);
    const out = `test-results/epics/E32/S7/input/${backend}-${quality}-z${zoom}`; mkdirSync(out, { recursive: true });
    await page.screenshot({ path: `${out}/installed.png` });
    await go(cure.anchors['cure-console']); await page.getByTestId('dispersal-action').click(); await page.evaluate(() => window.__SS__!.step(121));
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.counters['charge-ticks'])).toBe(120);
    const [cx, cz] = cure.anchors['cure-console']; await go([cx + 26, cz + 6]);
    await page.evaluate(() => window.__SS__!.step(60));
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.counters['charge-ticks'])).toBe(120);
    await expect(page.getByTestId('objective-text')).toContainText('Back to the dispersal console');
    await page.screenshot({ path: `${out}/paused.png` });
    await go(cure.anchors['cure-console']); await page.evaluate(() => window.__SS__!.step(3480));
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.counters['charge-ticks'])).toBe(3600);
    await press(); expect(await page.evaluate(() => window.__SS__!.missions.state()!.states['cure-released'])).toBe(false);
    await expect(page.getByTestId('objective-text')).toContainText('Kill the Mega Alpha');
    await page.screenshot({ path: `${out}/boss-gate.png` });
  });
}
