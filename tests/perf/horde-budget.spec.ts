import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test, expect } from '../e2e/fixtures';

// One worker, native GPU, under e2e-lock. PERF_HORDE_PHASE=before records the unchanged budget failures.
const phase = process.env.PERF_HORDE_PHASE ?? 'after';
const runs = Number(process.env.PERF_HORDE_RUNS ?? 1);
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  for (let run = 1; run <= runs; run++) test(`horde budget ${tier} run ${run} @E18-AC01 @E18-AC09 @perf`, async ({ page, context }) => {
    test.setTimeout(180_000);
    if (tier === 'low') { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    await page.goto(`/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=${tier === 'high' ? 1 : 1.5}&profile`);
    await page.waitForFunction(() => Boolean(window.__SS__));
    const proof = await page.evaluate(async tier => {
      const a = window.__SS__!; await a.ready; await a.loadScenario(tier === 'high' ? 'perf-horde-200' : 'perf-horde-100'); a.pause(); a.cheats.god(true); a.camera.preset('perf-horde');
      // Forty live civilians outside grabbing range, same load on both tiers.
      for (let i = 0; i < 40; i++) a.npcs.civilian('jogger', { x: (i % 10) * 1.2 - 6, z: 6 + Math.floor(i / 10) * 1.2 }, { waypoints: [{ x: (i % 10) * 1.2 - 6, z: 6 + Math.floor(i / 10) * 1.2 }] });
      await a.step(0); await a.screenshotReady(); const fixed = a.perf(); a.resume();
      const frameMs: number[] = [], simMs: number[] = [], updateMs: number[] = [], renderMs: number[] = [];
      let previous = 0; const start = performance.now(); const startTick = a.tick();
      for (let i = 0; i < 720 || performance.now() - start < 12_000; i++) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        if (i >= 120 && previous) { frameMs.push(now - previous); const p = a.perf(); simMs.push(p.simMs); updateMs.push(p.updateCpuMs); renderMs.push(p.renderCpuMs); }
        previous = now;
      }
      const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
      const gl = document.querySelector('canvas')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { tier, fixed, perf: a.perf(), gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string : null, ticks: a.tick() - startTick, infected: a.getState().ai!.count, civilians: a.query({ kind: 'civilian' }).length, frameMsP50: percentile(frameMs, .5), frameMsP95: percentile(frameMs, .95), simMsP95: percentile(simMs, .95), updateCpuMsP95: percentile(updateMs, .95), renderCpuMsP95: percentile(renderMs, .95), frameMs };
    }, tier);
    const dir = 'test-results/epics/E18/horde'; mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${phase}-${tier}-${run}.json`, JSON.stringify(proof, null, 2));
    await page.locator('canvas').screenshot({ path: `${dir}/${phase}-${tier}-${run}.png` });
    console.log(JSON.stringify({ phase, run, tier, p95: proof.frameMsP95, sim: proof.simMsP95, update: proof.updateCpuMsP95, render: proof.renderCpuMsP95, triangles: proof.fixed.triangles, draws: proof.fixed.drawCalls, profile: proof.fixed.profile }));
    expect(proof.gpu).not.toMatch(/swiftshader|llvmpipe|software/i); expect(proof.infected).toBe(tier === 'high' ? 200 : 100); expect(proof.civilians).toBe(40); expect(proof.ticks).toBeGreaterThan(300);
    if (phase !== 'before') { expect(proof.fixed.drawCalls).toBeLessThanOrEqual(tier === 'high' ? 600 : 300); expect(proof.fixed.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000); expect(proof.frameMsP95).toBeLessThanOrEqual(tier === 'high' ? 14 : 1000 / 30); }
  });
});
