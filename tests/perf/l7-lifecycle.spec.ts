import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';

test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });
for (const quality of ['high', 'low'] as const) test(`T-E29-20-lifecycle @E29-AC20 @perf ${quality} L7 disposal retains accessibility and releases resources`, async ({ page, context }) => {
  test.setTimeout(300_000);
  if (quality === 'low') await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, `/?test=1&renderer=webgl&quality=${quality}&dpr=1&audio=muted`);
  await page.evaluate(async quality => {
    const a = window.__SS__!; await a.loadLevel('L7', { seed: 29, progression: 'L7-default' }); a.pause();
    a.settings.set({ quality, flashReduction: true, cameraShake: false, gore: 'Off' });
  }, quality);
  const cdp = await context.newCDPSession(page), readings = [];
  for (const level of ['L7', 'L1', 'L7'] as const) {
    if (readings.length) await page.evaluate(async level => { const a = window.__SS__!; await a.loadLevel(level); a.pause(); }, level);
    await page.evaluate(async () => { for (let i = 0; i < 6; i++) await window.__SS__!.screenshotReady(); });
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const reading = await page.evaluate(() => { const a = window.__SS__!, p = a.perf(); return { geometries: p.geometries, textures: p.textures, settings: a.campaign.state()!.settings }; });
    expect(reading.settings).toMatchObject({ flashReduction: true, cameraShake: false, gore: 'Off' });
    readings.push({ level, ...reading, heapBytes: heap.usedSize });
  }
  for (const key of ['geometries', 'textures', 'heapBytes'] as const) expect(readings[2][key], key).toBeLessThanOrEqual(readings[0][key] * 1.1);
  mkdirSync('test-results/epics/E29', { recursive: true }); writeFileSync(`test-results/epics/E29/lifecycle-${quality}.json`, JSON.stringify(readings, null, 2));
  await cdp.detach();
});
