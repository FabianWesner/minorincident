import { devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../e2e/fixtures';

test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  test(`L1 occupied escape street ${tier} @E19 @E19-AC24 @perf unchanged E18 budgets`, async ({ page, context }) => {
    test.setTimeout(240_000);
    if (tier === 'low') { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    await boot(page, `/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=${tier === 'high' ? 1 : 1.5}${process.env.MI_L1_STREET_PROFILE === '1' ? '&profile' : ''}`);
    await page.evaluate(async () => {
      const a = window.__SS__!; await a.loadLevel('L1', { seed: 1 }); a.missions.begin(); a.pause(); a.cheats.god(true);
      for (let i = 0; i < 8 && a.missions.state()!.steps.weapon.status !== 'active'; i++) a.cheats.completeObjective();
      a.teleport('player', { x: 23.1, z: 38.289 }); await a.step(1200);
      a.teleport('player', { x: 14, z: 4 }); a.camera.follow(); await a.step(600); await a.screenshotReady();
    });
    const proof = await page.evaluate(async () => {
      const a = window.__SS__!, ms: number[] = []; let last = 0, draws = 0, triangles = 0;
      let peak: ReturnType<typeof a.perf> | undefined;
      a.resume(); const start = performance.now();
      for (let i = 0; i < 720 || performance.now() - start < 12_000; i++) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        if (i >= 120 && last) ms.push(now - last); last = now;
        const p = a.perf(); if (p.drawCalls > draws) peak = p; draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles);
      }
      a.pause(); ms.sort((a, b) => a - b);
      return { p50: ms[Math.ceil(ms.length * .5) - 1], p95: ms[Math.ceil(ms.length * .95) - 1], draws, triangles, infected: a.getState().ai!.count, peak, perf: a.perf(), groups: a.missions.state()!.l1!.streetGroups };
    });
    const output = 'test-results/l1-street-infected/perf'; mkdirSync(output, { recursive: true });
    writeFileSync(`${output}/${tier}.json`, JSON.stringify(proof, null, 2) + '\n');
    await page.screenshot({ path: `${output}/${tier}.png` });
    expect(proof.groups?.some(g => g.ids.length > 0)).toBe(true);
    expect(proof.draws).toBeLessThanOrEqual(tier === 'high' ? 600 : 300);
    expect(proof.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
    if (process.env.PHONE_PERF === '1' && tier === 'low') expect(proof.p95).toBeLessThanOrEqual(33.3);
    expect(Math.round((tier === 'high' ? proof.p95 : proof.p50) * 1e6) / 1e6).toBeLessThanOrEqual(tier === 'high' ? 14 : 1000 / 30);
  });
});
