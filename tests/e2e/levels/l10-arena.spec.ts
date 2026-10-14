import { mkdirSync, writeFileSync } from 'node:fs';
import { cure } from '../../../src/levels/L10/district';
import { test, expect, boot } from '../fixtures';

test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });
for (const backend of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) {
  test(`T-E32-17-D4-browser @E32-AC17 @E32-AC18 R7 route, stairs and real E mount ${backend} ${quality} zoom ${zoom}`, async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page, `/?test=1${backend === 'webgl' ? '&renderer=webgl' : ''}&quality=${quality}&audio=muted&dpr=1&ui=1`);
    await page.evaluate(async () => { await window.__SS__!.loadLevel('L10', { seed: 32, checkpoint: 'cure-complex' }); window.__SS__!.teleport('player', { x: 3697, z: -25 }); window.__SS__!.pause(); window.__SS__!.cheats.god(true); window.__SS__!.camera.follow(); });
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(backend);
    expect(await page.evaluate(() => window.__SS__!.getState().player!.transform.x)).toBeCloseTo(cure.anchors['cure-complex'][0], 0);
    await page.mouse.move(800, 450);
    if (zoom === .5) for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100);
    await page.evaluate(() => window.__SS__!.step(60));
    expect(await page.evaluate(() => window.__SS__!.getState().render.camera.zoom)).toBeCloseTo(zoom, 2);
    const positions: unknown[] = [];
    const walk = async (target: number[]) => {
      const result = await page.evaluate(async ([x, z]) => {
        const api = window.__SS__!; api.input.set({ moveTarget: { x, z }, navigation: true, pointerGround: true });
        let ticks = 0, at = api.getState().player!.transform;
        while (Math.hypot(at.x - x, at.z - z) > .45 && ticks < 2400) { await api.step(15); ticks += 15; at = api.getState().player!.transform; }
        return { at, ticks, distance: Math.hypot(at.x - x, at.z - z) };
      }, target);
      positions.push({ target, ...result }); expect(result.distance, JSON.stringify(result)).toBeLessThanOrEqual(.45);
    };
    for (const point of cure.regions[6].route.slice(1)) await walk(point);
    await page.evaluate(async () => { window.__SS__!.input.clear(); await window.__SS__!.screenshotReady(); });
    const out = `test-results/epics/E32/D4/play/${backend}-${quality}-z${zoom}`; mkdirSync(out, { recursive: true });
    await page.screenshot({ path: `${out}/console.png` });
    for (const point of [[4004.5, -30], [4004.5, -33], cure.anchors['dispersal-stair-foot']]) await walk(point);
    const deck = await page.evaluate(async () => {
      const api = window.__SS__!; api.input.clear(); api.input.set({ move: { x: -1, z: 0 } });
      for (let i = 0; i < 300 && api.getState().player!.transform.x > 3990.8; i++) await api.step(1);
      api.input.clear(); await api.step(2); return api.getState().player!.transform;
    });
    expect(deck.y).toBeGreaterThan(3.6);
    await page.keyboard.down('e'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('e'); await page.evaluate(() => window.__SS__!.step(2));
    await expect(page.locator('.hud-heat-panel')).toHaveAttribute('data-mounted', 'true');
    await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/mounted.png` });
    const perf = await page.evaluate(() => window.__SS__!.perf());
    expect(perf.drawCalls).toBeLessThanOrEqual(quality === 'low' ? 300 : 600);
    expect(perf.triangles).toBeLessThanOrEqual(quality === 'low' ? 500_000 : 1_500_000);
    writeFileSync(`${out}/proof.json`, JSON.stringify({ positions, deck, mounted: true, perf }, null, 2));
  });
}
