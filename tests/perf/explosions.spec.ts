import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
/** E27 worst case for the E18 budgets: car explosion + aftermath fires + smoke column + 30 chasing infected. */
for (const tier of ['high', 'low'] as const) test(`E27 @E27 @perf ${tier} car explosion + fire + smoke column + 30 infected frame measurement`, async ({ page }) => {
  test.setTimeout(120_000);
  if (tier === 'low') {
    await page.setViewportSize({ width: 390, height: 844 });
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await boot(page, `/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1`);
  const result = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('blast-stress'); a.cheats.god(true); a.settings.set({ cameraShake: true, slowMotion: false });
    a.teleport('player', { x: -1.5, z: 5 }); a.spawn('hazard.propane', { x: 2.5, z: -1.5 }); a.spawn('hazard.barrel', { x: -2.5, z: -2 });
    await a.screenshotReady();
    const initialInfected = a.getState().ai!.count, car = a.query({ kind: 'vehicle' })[0].id; a.explosions.wreck(car); a.resume();
    // The wreck explodes after 3 s and chains into the propane tank and the barrel.
    while (!a.events(-1).some(e => e.type === 'explosion')) await new Promise(r => requestAnimationFrame(r));
    const times: number[] = [], sim: number[] = [], puffs: number[] = [], particles: number[] = [], spikes: { at: number; ms: number }[] = []; let previous = 0;
    const start = performance.now();
    while (performance.now() - start < 7000) {
      const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
      if (previous) { times.push(now - previous); if (now - previous > 34) spikes.push({ at: Math.round(now - start), ms: Math.round(now - previous) }); sim.push(a.perf().simMs); const v = a.getState().render.vfx!; puffs.push(v.blasts.puffs); particles.push(v.particles); } previous = now;
    }
    const p95 = (v: number[]) => [...v].sort((x, y) => x - y)[Math.ceil(v.length * .95) - 1];
    const gl = document.querySelector('canvas')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
    const blasts = a.events(0).filter(e => e.type === 'explosion').map(e => (e as { defId: string }).defId);
    return { frameP95: p95(times), frameMax: Math.max(...times), simP95: p95(sim), frames: times.length, maxPuffs: Math.max(...puffs), maxParticles: Math.max(...particles), blasts, initialInfected, infectedAlive: a.getState().ai!.count, spikes, fires: a.query({ archetype: 'hazard.fire' }).length, perf: a.perf(), gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null };
  });
  mkdirSync('test-results/epics/E27', { recursive: true });
  writeFileSync(`test-results/epics/E27/perf-${tier}.json`, JSON.stringify({ ...result, cpuThrottle: tier === 'low' ? 4 : 1, viewport: tier === 'low' ? '390x844' : '1600x900' }, null, 2));
  await page.screenshot({ path: `test-results/epics/E27/perf-${tier}.png` });
  expect(result.blasts).toContain('explosion.car'); expect(result.blasts.length).toBeGreaterThanOrEqual(2);
  expect(result.initialInfected).toBe(30); expect(result.fires).toBeGreaterThan(0);
  expect(result.frameP95).toBeLessThanOrEqual(tier === 'high' ? 16.7 : 33.4); expect(result.simP95).toBeLessThanOrEqual(tier === 'high' ? 4 : 6);
});
