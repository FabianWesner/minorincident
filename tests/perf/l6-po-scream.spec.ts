import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../e2e/fixtures';
// Native uncapped cadence; use tools/perf/quiet-run.sh (20 minute maximum reservation).
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const backend of ['webgl', 'webgpu']) for (const tier of ['high', 'low']) for (const debug of [false, true]) test(`@E24 @perf PO33 native L6 screams ${backend} ${tier} debug=${debug}`, async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, `/?test=1&renderer=${backend}&quality=${tier}&audio=muted&dpr=1${debug ? '&debug=true' : ''}`);
  const rows = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L6', { seed: 1, progression: 'L6-default' }); a.pause(); a.missions.begin(); a.cheats.god(true);
    const lamp = a.query({}).find(e => e.archetype === 'pickup.headlamp')!;
    a.teleport(1, lamp.transform); a.input.set({ interact: true }); await a.step(24); a.input.clear();
    const rows = [];
    for (const beat of ['breach1At', 'breach2At', 'abandon'] as const) {
      const s = a.missions.state()!.l6!, target = beat === 'abandon' ? s.breach2At + 900 : s[beat];
      await a.step(Math.max(0, target - a.tick() - 5)); await a.screenshotReady();
      const frames: number[] = []; let previous = 0;
      a.resume();
      while (a.tick() < target + 60) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve)); if (previous) frames.push(now - previous); previous = now;
      }
      a.pause(); rows.push({ beat, frames, max: Math.max(...frames), state: a.missions.state()!.l6, perf: a.perf(), backend: a.getState().render.backend });
    }
    return rows;
  });
  mkdirSync('test-results/l6-po/perf', { recursive: true });
  writeFileSync(`test-results/l6-po/perf/${backend}-${tier}-debug${debug}.json`, JSON.stringify(rows, null, 2));
  for (const row of rows) { expect(row.backend).toBe(backend); expect(row.max, row.beat).toBeLessThan(tier === 'high' ? 50 : 100); }
});
