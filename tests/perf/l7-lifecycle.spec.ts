import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';

const backend = process.env.LIFECYCLE_BACKEND === 'webgpu' ? 'webgpu' : 'webgl';
test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] } });
for (const target of ['L5', 'L6', 'L7'] as const) for (const quality of ['high', 'low'] as const) test(`T-${target === 'L7' ? 'E29-20' : target === 'L6' ? 'E24-19' : 'E23-19'}-lifecycle @${target === 'L7' ? 'E29-AC20' : target === 'L6' ? 'E24-AC19' : 'E23-AC19'} @perf ${quality} ${target} five warmed loads retain accessibility and release resources`, async ({ page, context }) => {
  test.setTimeout(300_000);
  if (quality === 'low') await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, `/?test=1&renderer=${backend}&quality=${quality}&dpr=1&audio=muted`);
  await page.evaluate(async ({ quality, target }) => {
    const a = window.__SS__!; await a.loadLevel(target, { seed: 29, progression: target === 'L7' ? 'L7-default' : target === 'L6' ? 'L6-default' : 'L5-default' }); a.pause();
    a.settings.set({ quality, flashReduction: true, cameraShake: false, gore: 'Off' });
  }, { quality, target });
  const cdp = await context.newCDPSession(page), readings = [];
  for (const level of [target, 'L1', target, 'L1', target] as const) {
    if (readings.length) await page.evaluate(async level => { const a = window.__SS__!; await a.loadLevel(level); a.pause(); }, level);
    // Match E18's settled-residency contract: Begin admits deferred tiers before
    // the first reading, and six completed captures retire old render lists.
    await page.evaluate(async () => { const a = window.__SS__!; a.missions.begin(); a.pause(); for (let i = 0; i < 6; i++) await a.screenshotReady(); });
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const reading = await page.evaluate(() => { const a = window.__SS__!, p = a.perf(); return { backend: p.backend, tier: p.quality.tier, geometries: p.geometries, textures: p.textures, settings: a.campaign.state()!.settings }; });
    expect(reading.backend).toBe(backend); expect(reading.tier).toBe(quality);
    expect(reading.settings).toMatchObject({ flashReduction: true, cameraShake: false, gore: 'Off' });
    readings.push({ level, ...reading, heapBytes: heap.usedSize });
  }
  const epic = target === 'L7' ? 'E29' : target === 'L6' ? 'E24' : 'E23';
  mkdirSync(`test-results/epics/${epic}`, { recursive: true }); writeFileSync(`test-results/epics/${epic}/lifecycle-${target}-${quality}-${backend}.json`, JSON.stringify(readings, null, 2));
  for (const key of ['geometries', 'textures', 'heapBytes'] as const) expect(readings[4][key], key).toBeLessThanOrEqual(readings[0][key] * 1.1);
  await cdp.detach();
});
