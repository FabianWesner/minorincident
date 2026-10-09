import { mkdirSync, writeFileSync } from 'node:fs';
import { test, boot } from '../e2e/fixtures';
/** Same game-camera fixture before/after. Run on the quiet Mac under E2E_SLOTS=1. */
for (const level of ['L1', 'L2', 'L3'] as const) test(`E28 ${level} frame comparison @perf`, async ({ page }) => {
  test.setTimeout(180_000); await boot(page, '/?test=1&renderer=webgl&quality=high&dpr=1&audio=muted&profile');
  await page.evaluate(async level => { const a = window.__SS__!; await a.loadLevel(level, { seed: 28, ...(level === 'L1' ? {} : { progression: `${level}-default` as 'L2-default' | 'L3-default' }) }); a.pause(); a.missions.begin(); a.cheats.god(true); await a.step(120); }, level);
  const result = await page.evaluate(async () => {
    const a = window.__SS__!, frames: number[] = [], cpu: number[] = []; let previous = 0; a.resume();
    for (let i = 0; i < 360; i++) { const now = await new Promise<number>(resolve => requestAnimationFrame(resolve)); if (previous && i > 60) { frames.push(now - previous); cpu.push(a.perf().updateCpuMs + a.perf().renderCpuMs); } previous = now; }
    a.pause(); const q = (v: number[], p: number) => v.sort((a, b) => a - b)[Math.floor(v.length * p)];
    return { frameP50: q(frames, .5), frameP95: q(frames, .95), cpuP50: q(cpu, .5), cpuP95: q(cpu, .95), counters: a.perf() };
  });
  const dir = 'test-results/epics/E28/perf'; mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${process.env.E28_PHASE ?? 'after'}-${level}.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify({ level, ...result }));
});
