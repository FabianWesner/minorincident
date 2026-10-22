import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';
import { collectedHeap } from './collected-heap';

test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });
for (const backend of ['webgl', 'webgpu']) for (const quality of ['high', 'low'] as const) {
  test(`T-E31-19-retention @E31-AC19 @perf five warmed L9/L10 round trips ${backend} ${quality}`, async ({ page, context }) => {
    test.setTimeout(300_000);
    if (quality === 'low') await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, `/?test=1&renderer=${backend}&quality=${quality}&audio=muted&dpr=1`);
    const trip = () => page.evaluate(async quality => {
      const a = window.__SS__!;
      for (const level of ['L9', 'L10', 'L9'] as const) {
        await a.loadLevel(level, { seed: 31, ...(level === 'L10' ? { progression: 'L10-default' as const } : {}) }); a.pause(); a.settings.set({ quality });
        // The exact same camera/start and completed redraws establish residency
        // before every reading; no render or asset cache is manually cleared.
        a.camera.follow(); for (let i = 0; i < 6; i++) await a.screenshotReady();
      }
    }, quality);
    await trip(); // Both levels warm before the baseline.
    const readings = [];
    const out = 'test-results/epics/E31/retention'; mkdirSync(out, { recursive: true });
    for (let cycle = 0; cycle <= 5; cycle++) {
      if (cycle) await trip();
      const heap = await collectedHeap(page, context);
      const state = await page.evaluate(() => { const a = window.__SS__!, p = a.perf(); return { scenario: a.getState().scenario, backend: p.backend, quality: p.quality.tier, geometries: p.geometries, textures: p.textures }; });
      readings.push({ cycle, ...state, ...heap });
      writeFileSync(`${out}/${backend}-${quality}.json`, JSON.stringify({ warmup: 'one L9/L10/L9 trip before baseline', readings }, null, 2));
      expect(state.scenario).toBe('L9'); expect(state.backend).toBe(backend); expect(state.quality).toBe(quality);
      expect.soft(heap.heapMB).toBeLessThanOrEqual(quality === 'high' ? 400 : 250);
      for (const key of ['heapMB', 'geometries', 'textures'] as const)
        expect.soft(Math.abs(readings[cycle][key] - readings[0][key]) / Math.max(1, readings[0][key]), `cycle ${cycle} ${key}`).toBeLessThanOrEqual(.10);
      // Retention includes the other reported memory domains; none is hidden
      // by passing only Runtime.usedSize. Soft gates retain all five readings.
      for (const key of ['backingStorageSize', 'embedderHeapUsedSize'] as const) {
        const initial = readings[0].heapAudit[key], current = heap.heapAudit[key];
        expect.soft(typeof current, key).toBe('number');
        if (typeof initial === 'number' && typeof current === 'number')
          expect.soft(Math.abs(current - initial) / Math.max(1, initial), `cycle ${cycle} ${key}`).toBeLessThanOrEqual(.10);
      }
      if (heap.legacyHeapAfterCollection !== null && readings[0].legacyHeapAfterCollection !== null)
        expect.soft(Math.abs(heap.legacyHeapAfterCollection - readings[0].legacyHeapAfterCollection) / Math.max(1, readings[0].legacyHeapAfterCollection), `cycle ${cycle} legacy heap`).toBeLessThanOrEqual(.10);
    }
    await page.screenshot({ path: `${out}/${backend}-${quality}.png` });
  });
}
