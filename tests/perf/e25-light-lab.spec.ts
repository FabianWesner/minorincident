import { devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '../e2e/fixtures';
import { qualityBudgets } from '../../src/core/Quality';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  test(`T-E25-14c @E25 @E25-AC14 @perf trailer light-lab ${tier} within unchanged E18 budgets`, async ({ page, context }) => {
    test.setTimeout(240_000);
    if (tier === 'low') { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    await page.goto(`/?test=1&scenelab&renderer=webgl&quality=${tier}&audio=muted&dpr=${tier === 'high' ? 1 : 1.5}`); await page.waitForFunction(() => !!window.__SCENE__);
    const scene: SceneSpec = { name: 'light-lab', ground: 'asphalt', time: 'night', size: 50, dof: false,
      props: [{ asset: 'prop.light-tower-trailer', at: [-10, 0] }, { asset: 'prop.privacy-fence', at: [8, 0], scale: [1, 1, 4] }],
      actors: [{ kind: 'courier', at: [2, 0] }, { kind: 'infected', count: tier === 'high' ? 40 : 30, spread: 6, at: [0, 0], state: 'idle' }], camera: { mode: 'game', target: [0, 0], zoom: 1.5 } };
    const result = await page.evaluate(async scene => {
      await window.__SS__!.ready; await window.__SCENE__!.load(scene); await window.__SCENE__!.step(180); window.__SS__!.cheats.god(true); window.__SS__!.resume();
      await new Promise(resolve => setTimeout(resolve, 3000));
      const frames: number[] = [], sim: number[] = []; let prior = window.__SS__!.perf().renderedFrames;
      while (frames.length < 600) { await new Promise(requestAnimationFrame); const perf = window.__SS__!.perf(); if (perf.renderedFrames === prior) continue; prior = perf.renderedFrames; frames.push(perf.frameMs); sim.push(perf.simMs); }
      frames.sort((a, b) => a - b); sim.sort((a, b) => a - b);
      return { p50: frames[299], p95: frames[569], simP95: sim[569], perf: window.__SS__!.perf(), lighting: window.__SS__!.getState().render.lighting };
    }, scene);
    mkdirSync('test-results/epics/E25/closure', { recursive: true }); writeFileSync(`test-results/epics/E25/closure/perf-light-lab-${tier}.json`, JSON.stringify(result, null, 2));
    await page.locator('canvas').screenshot({ path: `test-results/epics/E25/closure/perf-light-lab-${tier}.png` });
    expect(tier === 'high' ? result.p95 : result.p50).toBeLessThanOrEqual(qualityBudgets[tier].frameMs);
    expect(result.simP95).toBeLessThanOrEqual(qualityBudgets[tier].simMs); expect(result.perf.drawCalls).toBeLessThanOrEqual(qualityBudgets[tier].drawCalls); expect(result.perf.triangles).toBeLessThanOrEqual(qualityBudgets[tier].triangles);
    expect(result.perf.lighting!.heroLights).toBeLessThanOrEqual(tier === 'high' ? 8 : 3); expect(result.perf.lighting!.shadowMaps).toBeLessThanOrEqual(tier === 'high' ? 3 : 1); expect(result.lighting!.practicalEffects.beams).toBe(4);
  });
});
