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

// Diagnostic for the proposed meaning of "warmed": preserve the original
// first-five gates above, and separately measure five loads after both levels
// have been visited once. This is not an adopted AC rewrite.
for (const quality of ['high', 'low'] as const) test(`E24 warmed-cache diagnostic @perf ${quality} L6 seven-load cache audit`, async ({ page, context }) => {
  test.setTimeout(300_000);
  if (quality === 'low') await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, `/?test=1&renderer=${backend}&quality=${quality}&dpr=1&audio=muted`);
  await page.evaluate(async quality => {
    const a = window.__SS__!; await a.loadLevel('L6', { seed: 29, progression: 'L6-default' }); a.pause();
    a.settings.set({ quality });
  }, quality);
  const cdp = await context.newCDPSession(page), readings = [];
  for (const level of ['L6', 'L1', 'L6', 'L1', 'L6', 'L1', 'L6'] as const) {
    if (readings.length) await page.evaluate(async level => { const a = window.__SS__!; await a.loadLevel(level); a.pause(); }, level);
    await page.evaluate(async () => { const a = window.__SS__!; a.missions.begin(); a.pause(); for (let i = 0; i < 6; i++) await a.screenshotReady(); });
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const counters = await page.evaluate(() => { const p = window.__SS__!.perf(); return { backend: p.backend, tier: p.quality.tier, geometries: p.geometries, textures: p.textures }; });
    expect(counters.backend).toBe(backend); expect(counters.tier).toBe(quality);
    readings.push({ level, ...counters, heapBytes: heap.usedSize });
  }
  const ratios = (from: number, to: number) => Object.fromEntries((['geometries', 'textures', 'heapBytes'] as const).map(key => [key, readings[to][key] / readings[from][key]]));
  const proof = { readings, originalFirstFive: ratios(0, 4), proposedWarmedFive: ratios(2, 6), adoptedRewrite: false };
  mkdirSync('test-results/epics/E24', { recursive: true });
  writeFileSync(`test-results/epics/E24/lifecycle-L6-cache-audit-${quality}-${backend}.json`, JSON.stringify(proof, null, 2));
  for (const key of ['geometries', 'textures', 'heapBytes'] as const) expect(readings[6][key], `diagnostic warmed ${key}`).toBeLessThanOrEqual(readings[2][key] * 1.1);
  await cdp.detach();
});
