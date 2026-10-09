import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test, expect } from '../e2e/fixtures';

// Diagnostic loader/attack coverage. Same native phone, 4x CPU and real clock as T-E20-20.
// Loading-screen stalls are retained, rather than excluding them from the frame recording.
const phase = process.env.L2_PERF_PHASE ?? 'after';
const dir = 'test-results/epics/E20/perf/hitches';
test.use({ channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true,
  launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const source of ['L1', 'L2'] as const) test(`campaign loader hitch ${source} to ${source === 'L1' ? 'L2' : 'L3'} low`, async ({ page, context }) => {
  test.setTimeout(300_000); mkdirSync(dir, { recursive: true });
  const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('/?test=1&renderer=webgl&quality=low&audio=muted&dpr=1.5&profile');
  await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async source => { const a = window.__SS__!; await a.ready; await a.loadLevel(source, { seed: 2 }); a.pause(); await a.screenshotReady(); }, source);
  const proof = await page.evaluate(async source => {
    const a = window.__SS__!, target = source === 'L1' ? 'L2' : 'L3', frames: { ms: number; at: number; scenario: string | null }[] = [];
    let previous = performance.now(), stop = false;
    const frame = () => { const now = performance.now(); frames.push({ ms: now - previous, at: now, scenario: a.getState().scenario }); previous = now; if (!stop) requestAnimationFrame(frame); };
    requestAnimationFrame(frame); await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const start = performance.now();
    await a.loadLevel(target, { seed: 2, progression: target === 'L2' ? 'L2-default' : 'L3-default' });
    await a.screenshotReady(); await new Promise(resolve => setTimeout(resolve, 2000)); stop = true;
    return { source, target, elapsedMs: performance.now() - start, maxMs: Math.max(...frames.map(f => f.ms)), over50: frames.filter(f => f.ms > 50), frames };
  }, source);
  writeFileSync(`${dir}/${phase}-${source}-loader-low.json`, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ ...proof, frames: undefined }));
  expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe(proof.target);
});
test('station attack start hitch low', async ({ page, context }) => {
  test.setTimeout(300_000); mkdirSync(dir, { recursive: true });
  const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('/?test=1&renderer=webgl&quality=low&audio=muted&dpr=1.5&profile');
  await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L3', { seed: 2, progression: 'L3-default' }); a.pause(); a.missions.begin(); a.cheats.god(true); a.bot.start('complete'); });
  // Ordinary bot inputs acquire the handgun; stop before the authored five-second attack delay.
  for (let i = 0; i < 200 && !await page.evaluate(() => window.__SS__!.missions.state()!.l3!.handgunAt > 0); i++) await page.evaluate(() => window.__SS__!.step(15));
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.l3!.attackAt)).toBe(0);
  const proof = await page.evaluate(async () => {
    const a = window.__SS__!, frames: { ms: number; tick: number; attackAt: number; sim: number; update: number; render: number }[] = [];
    let previous = 0, end = 0; a.resume();
    for (let i = 0; i < 4000; i++) {
      const now = await new Promise<number>(resolve => requestAnimationFrame(resolve)), attackAt = a.missions.state()!.l3!.attackAt;
      if (previous && i > 2) { const p = a.perf(); frames.push({ ms: now - previous, tick: a.tick(), attackAt, sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs }); } previous = now;
      if (!end && attackAt) end = now + 2000;
      if (end && now >= end) break;
    }
    a.pause(); return { maxMs: Math.max(...frames.map(f => f.ms)), over50: frames.filter(f => f.ms > 50), attackAt: a.missions.state()!.l3!.attackAt, frames };
  });
  writeFileSync(`${dir}/${phase}-station-start-low.json`, JSON.stringify(proof, null, 2)); console.log(JSON.stringify({ ...proof, frames: undefined }));
  expect(proof.attackAt).toBeGreaterThan(0);
});
