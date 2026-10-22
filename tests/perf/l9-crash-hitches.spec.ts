import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';

test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const backend of ['webgl', 'webgpu'] as const) for (const tier of ['high', 'low'] as const) for (const hp of [1000, 0]) {
  test(`T-E31-19-crash-hitch @E31-AC19 @perf actual crash and L10 handover ${backend} ${tier} HP${hp}`, async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page, `/?test=1&scenelab&renderer=${backend}&quality=${tier}&audio=muted&dpr=1`);
    await page.mouse.click(200, 250);
    await page.evaluate(async ({ tier, hp }) => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
      await a.loadLevel('L9', { seed: 31 }); a.pause(); a.settings.set({ quality: tier, muted: false, captions: true }); await a.audio.unlock();
      const w = game.world, car = w.missions!.l9!.state.carId, anchor = w.missions!.def.anchors['crash-approach'];
      // Initial placement only: the normal driving trigger owns every subsequent
      // crash phase and the production campaign callback owns the L10 handover.
      a.teleport(car, { x: anchor.x - 12, z: anchor.z }); w.vehicles!.damage(car, 1000 - hp); w.vehicles!.rebuild();
      await a.step(1); a.camera.follow(); await a.screenshotReady();
    }, { tier, hp });
    await page.keyboard.down('KeyW');
    const result = await page.evaluate(async () => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
      const events: { name: string; at: number; tick: number }[] = [];
      const stop = game.world.events.on('mission.signal', e => {
        if (e.type === 'mission.signal' && e.name.startsWith('l9.')) events.push({ name: e.name, at: performance.now(), tick: e.tick });
      });
      const frames: { at: number; ms: number; scenario: string | null; phase: string | null; ready: boolean }[] = [];
      await new Promise(r => requestAnimationFrame(r)); let previous = performance.now(), afterHandover = 0;
      a.resume(); const start = performance.now();
      while (performance.now() - start < 35_000) {
        const at = await new Promise<number>(r => requestAnimationFrame(r));
        const scenario = game.world.scenario, phase = game.world.missions?.l9?.state.phase ?? null;
        const ready = game.canRestartLevel && !game.view.warming;
        frames.push({ at, ms: at - previous, scenario, phase, ready }); previous = at;
        if (scenario === 'L10' && ready && ++afterHandover >= 30) break;
      }
      a.pause(); stop();
      const sorted = frames.map(f => f.ms).sort((x, y) => x - y);
      return { backend: a.perf().backend, quality: a.getState().render.quality, scenario: game.world.scenario, afterHandover,
        frameP95: sorted[Math.ceil(sorted.length * .95) - 1], hitchMaxMs: Math.max(...sorted), events, frames,
        eventHitches: events.map(e => ({ ...e, maxMs: Math.max(...frames.filter(f => Math.abs(f.at - e.at) <= 250).map(f => f.ms)) })) };
    });
    await page.keyboard.up('KeyW');
    const out = 'test-results/epics/E31/crash-hitches'; mkdirSync(out, { recursive: true });
    writeFileSync(`${out}/${backend}-${tier}-hp${hp}.json`, JSON.stringify(result, null, 2));
    expect.soft(result.backend).toBe(backend); expect.soft(result.quality).toBe(tier);
    expect.soft(result.scenario, 'the production callback must reach L10').toBe('L10');
    expect.soft(result.afterHandover, 'L10 must finish loading/warming and present30 frames').toBeGreaterThanOrEqual(30);
    for (const name of ['l9.crash-approach', 'l9.bridge-collapse', 'l9.crash-impact', 'l9.crawl-finished']) expect.soft(result.events.filter(e => e.name === name), name).toHaveLength(1);
    expect.soft(result.frameP95).toBeLessThanOrEqual(tier === 'low' ? 33.3 : 16.7);
    expect.soft(result.hitchMaxMs, 'actual approach/crash/crawl/handover RAF gaps').toBeLessThanOrEqual(50);
  });
}
