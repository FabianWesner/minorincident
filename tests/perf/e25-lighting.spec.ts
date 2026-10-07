import { devices, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '../e2e/fixtures';
import { qualityBudgets } from '../../src/core/Quality';

// Native-GPU headless Chrome (shared Mac policy); vsync off so frame intervals measure headroom.
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
const out = 'test-results/epics/E25';

/** L1's town with 60 runners at its lamp-densest point; the same frame measured in the morning and at night. */
async function measure(page: Page, preset: 'L1' | 'night') {
  return page.evaluate(async (preset) => {
    const a = window.__SS__!; await a.ready; await a.loadScenario('perf-night-street'); a.cheats.god(true);
    a.settings.set({ timeOfDay: preset }); a.camera.follow(); await a.screenshotReady(); a.resume();
    await new Promise(resolve => setTimeout(resolve, 3000));
    const frameMs: number[] = []; let previous = a.perf().renderedFrames;
    const fieldMs: number[] = [];
    while (frameMs.length < 600) {
      await new Promise(requestAnimationFrame);
      const p = a.perf(); if (p.renderedFrames === previous) continue; previous = p.renderedFrames;
      if (p.frameMs > 0) frameMs.push(p.frameMs); fieldMs.push(p.lighting?.lightFieldMs ?? 0);
    }
    const sorted = [...frameMs].sort((x, y) => x - y), q = (k: number) => sorted[Math.ceil(sorted.length * k) - 1];
    const perf = a.perf();
    return { preset, frameMsP50: q(.5), frameMsP95: q(.95), lightFieldMsMean: fieldMs.reduce((s, v) => s + v, 0) / fieldMs.length, drawCalls: perf.drawCalls, triangles: perf.triangles, lighting: perf.lighting, quality: perf.quality.tier, infected: a.getState().ai!.count, lamps: a.lights.state() };
  }, preset);
}

test('T-E25-14 @E25 @E25-AC14 @perf desktop high: L1 morning and night street (41 lamps in the field window, 60 infected) within E18 budgets', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/?test=1&renderer=webgl&quality=high&audio=muted&dpr=1'); await page.waitForFunction(() => Boolean(window.__SS__));
  const morning = await measure(page, 'L1'); await page.locator('canvas').screenshot({ path: `${out}/perf-high-morning.png` });
  const night = await measure(page, 'night'); await page.locator('canvas').screenshot({ path: `${out}/perf-high-night.png` });
  mkdirSync(out, { recursive: true }); writeFileSync(`${out}/perf-high.json`, JSON.stringify({ morning, night }, null, 2) + '\n');
  for (const run of [morning, night]) {
    expect(run.quality).toBe('high'); expect(run.infected).toBe(60);
    expect(run.frameMsP95).toBeLessThanOrEqual(qualityBudgets.high.frameMs); expect(run.drawCalls).toBeLessThanOrEqual(qualityBudgets.high.drawCalls);
    expect(run.lighting!.shadowMaps).toBe(1);
  }
  expect(morning.lighting!.lightPools).toBe(0);
  expect(night.lighting!.lightPools).toBeGreaterThanOrEqual(40); expect(night.lighting!.lightPools).toBeLessThanOrEqual(512);
});

test.describe('Pixel 7 emulated low', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  test('T-E25-14b @E25 @E25-AC14 @perf phone low (4x CPU throttle): L1 morning and night street within the low budget', async ({ page, context }) => {
    test.setTimeout(300_000);
    const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/?test=1&renderer=webgl&quality=low&audio=muted'); await page.waitForFunction(() => Boolean(window.__SS__));
    const morning = await measure(page, 'L1'); await page.screenshot({ path: `${out}/perf-low-morning.png` });
    const night = await measure(page, 'night'); await page.screenshot({ path: `${out}/perf-low-night.png` });
    mkdirSync(out, { recursive: true }); writeFileSync(`${out}/perf-low.json`, JSON.stringify({ morning, night }, null, 2) + '\n');
    for (const run of [morning, night]) {
      expect(run.quality).toBe('low');
      // E18-AC08 measures the phone proxy at p50 (>= 30 fps); p95 is reported alongside.
      expect(run.frameMsP50).toBeLessThanOrEqual(qualityBudgets.low.frameMs); expect(run.drawCalls).toBeLessThanOrEqual(qualityBudgets.low.drawCalls);
    }
    expect(night.lighting!.lightPools).toBeLessThanOrEqual(256);
  });
});
