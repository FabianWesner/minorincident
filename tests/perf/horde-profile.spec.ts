import { mkdirSync, writeFileSync } from 'node:fs';
import { test, boot } from '../e2e/fixtures';

// Diagnostic only: CPU samples locate renderer submission/driver stalls, not a frame-time gate.
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
test('desktop horde CPU sampling @profile', async ({ page, context }) => {
  test.setTimeout(120_000); await boot(page, '/?test=1&renderer=webgl&quality=high&audio=muted&dpr=1&profile');
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('perf-horde-200'); a.cheats.god(true); a.camera.preset('perf-horde');
    for (let i = 0; i < 40; i++) a.npcs.civilian('jogger', { x: i % 10 * 1.2 - 6, z: 6 + Math.floor(i / 10) * 1.2 }, { waypoints: [{ x: i % 10 * 1.2 - 6, z: 6 + Math.floor(i / 10) * 1.2 }] });
    await a.screenshotReady(); a.resume();
  });
  const cdp = await context.newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
  await page.waitForTimeout(6000);
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map<number, number>();
  profile.samples?.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas?.[i] ?? 1000) / 1000));
  const summary = profile.nodes.map(n => ({ function: n.callFrame.functionName, file: n.callFrame.url.split('/').at(-1), line: n.callFrame.lineNumber + 1, selfMs: self.get(n.id) ?? 0 })).sort((a, b) => b.selfMs - a.selfMs).slice(0, 30);
  const perf = await page.evaluate(() => window.__SS__!.perf());
  mkdirSync('test-results/epics/E18/horde', { recursive: true }); writeFileSync('test-results/epics/E18/horde/cpu-profile.json', JSON.stringify({ profile, summary, perf }));
  console.log(JSON.stringify({ summary, perf }));
});
