import { mkdirSync } from 'node:fs';
import { test, expect, boot } from '../fixtures';

test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });
for (const backend of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) {
  test(`T-E32-25/26-S9 @E32-AC25 @E32-AC29 @E32-AC26 release, input, pull-out, title, credits and resume ${backend} ${quality} z${zoom}`, async ({ page }) => {
    test.setTimeout(240_000);
    const out = `test-results/epics/E32/S9/input/${backend}-${quality}-z${zoom}`; mkdirSync(out, { recursive: true });
    await boot(page, `/?test=1${backend === 'webgl' ? '&renderer=webgl' : ''}&quality=${quality}&audio=muted&dpr=1&ui=1`);
    await page.evaluate(async () => {
      const a = window.__SS__!; await a.loadLevel('L10', { checkpoint: 'cure-disperse-ready', progression: 'L10-default', seed: 329 });
      a.pause(); a.cheats.god(true); a.teleport('player', { x: 4002, z: -27 }); a.camera.follow();
    });
    const press = async () => { await page.keyboard.down('e'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('e'); await page.evaluate(() => window.__SS__!.step(1)); };
    await press();
    // The fixture prepares the charged/dead-boss gate; release and every ending control use real UI input.
    await page.evaluate(async () => { const a = window.__SS__!; await a.step(6000); a.cheats.killAll(); await a.step(2); });
    await press();
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.states['cure-released'])).toBe(true);
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(backend);
    await page.evaluate(async () => { const a = window.__SS__!; a.cheats.god(false); a.teleport('player', { x: 4002, z: -9 }); await a.step(1200); await a.screenshotReady(); });
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.epilogue!.survivors.length)).toBeGreaterThan(0);
    await page.screenshot({ path: `${out}/reversal.png` });
    if (zoom === .5) { await page.mouse.move(800, 450); for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100); await page.evaluate(() => window.__SS__!.step(120)); }
    await page.evaluate(async () => { const a = window.__SS__!; const elapsed = a.missions.state()!.cureFront!.elapsed; await a.step(6840 - elapsed); await a.screenshotReady(); });
    const before = await page.evaluate(() => window.__SS__!.getState());
    await page.screenshot({ path: `${out}/pull-start.png` });
    await page.keyboard.down('c'); await page.keyboard.down('d'); await page.evaluate(() => window.__SS__!.step(60)); await page.keyboard.up('d'); await page.keyboard.up('c');
    const moved = await page.evaluate(() => window.__SS__!.getState().player!.transform);
    expect(Math.hypot(moved.x - before.player!.transform.x, moved.z - before.player!.transform.z)).toBeGreaterThan(.5);
    // The normal pointer movement path still works during the authored widening.
    const destination = await page.evaluate(() => window.__SS__!.input.project({ x: 4002, z: -9 }));
    await page.mouse.click(destination.x, destination.y); await page.evaluate(() => window.__SS__!.step(60));
    const pointerMoved = await page.evaluate(() => window.__SS__!.getState().player!.transform);
    expect(Math.hypot(pointerMoved.x - moved.x, pointerMoved.z - moved.z)).toBeGreaterThan(.5);
    await page.mouse.move(800, 450); await page.mouse.wheel(0, 100); await page.evaluate(() => window.__SS__!.step(60));
    expect(await page.evaluate(() => window.__SS__!.getState().render.camera.zoom)).toBeGreaterThan(zoom);
    await page.mouse.wheel(0, -100); await page.evaluate(() => window.__SS__!.step(60));
    expect(await page.evaluate(() => window.__SS__!.getState().render.camera.zoom)).toBeCloseTo(zoom, 2);
    await page.evaluate(async () => { const a = window.__SS__!; await a.step(840); await a.screenshotReady(); });
    const middle = await page.evaluate(() => window.__SS__!.getState());
    expect(middle.render.camera.radius).toBeGreaterThan(before.render.camera.radius);
    await page.screenshot({ path: `${out}/pull-middle.png` });
    expect(await page.evaluate(() => window.__SS__!.campaign.save())).toBe(true);
    const resume = await page.evaluate(() => window.__SS__!.campaign.state()!);
    // Reload the live mission from its ordinary saved current phase, including survivor/corpse IDs.
    await page.evaluate(async save => { const a = window.__SS__!; a.campaign.restore(save); await a.loadLevel('L10'); a.pause(); }, resume);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.epilogue!.phase)).toBe('playable');
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.counters['epilogue-ticks'])).toBe(resume.cureResume!.current.state.counters['epilogue-ticks']);
    expect(await page.evaluate(() => window.__SS__!.getState().render.camera.zoom)).toBeCloseTo(zoom, 2);
    await page.evaluate(async () => { const a = window.__SS__!; await a.step(9000 - a.missions.state()!.counters['epilogue-ticks']); await a.screenshotReady(); });
    await expect(page.getByTestId('epilogue-title')).toHaveText('Minor Incident');
    await page.screenshot({ path: `${out}/title.png` });
    expect(await page.evaluate(() => window.__SS__!.campaign.save())).toBe(true);
    const titleSave = await page.evaluate(() => window.__SS__!.campaign.state()!);
    await page.evaluate(async save => { const a = window.__SS__!; a.campaign.restore(save); await a.loadLevel('L10'); a.pause(); }, titleSave);
    await expect(page.getByTestId('epilogue-title')).toBeVisible();
    expect(await page.evaluate(() => window.__SS__!.events().some(e => e.type === 'mission.signal' && e.name === 'cure-released'))).toBe(false);
    await page.evaluate(() => window.__SS__!.step(300));
    await expect(page.getByRole('heading', { name: 'Credits', exact: true })).toBeVisible();
    await page.evaluate(() => window.__SS__!.step(120));
    await page.screenshot({ path: `${out}/credits.png` });
    expect(await page.evaluate(() => window.__SS__!.campaign.save())).toBe(true);
    const creditsSave = await page.evaluate(() => window.__SS__!.campaign.state()!);
    await page.evaluate(async save => { const a = window.__SS__!; a.campaign.restore(save); await a.loadLevel('L10'); a.pause(); }, creditsSave);
    await expect(page.getByRole('heading', { name: 'Credits', exact: true })).toBeVisible();
    await page.getByTestId('ending-credits-back').click(); await page.evaluate(async () => { window.__SS__!.pause(); await window.__SS__!.step(1); });
    await expect(page.getByTestId('start-game')).toBeVisible();
    expect(await page.evaluate(() => window.__SS__!.campaign.state()!.completedLevels)).toBe(10);
    expect(await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'level.completed'))).toHaveLength(1);
    await page.evaluate(() => window.__SS__!.step(60));
    expect(await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'level.completed'))).toHaveLength(1);
  });
}
