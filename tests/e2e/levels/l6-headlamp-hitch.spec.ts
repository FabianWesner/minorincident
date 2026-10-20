import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';

// PO 10-20 #62 "L6 after I picked up the headlamp there is a 3-5s freeze". Real-time play (clock running),
// physical E press at the lantern; every animation frame from 1 s before to 4 s after the pickup is recorded.
// Timing spec: run through tools/perf/quiet-run.sh with --workers=1 (L6_HITCH_WEBGPU=1 for the WebGPU pass).
const webgpu = process.env.L6_HITCH_WEBGPU === '1';
if (webgpu) test.use({ launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] } });
for (const quality of ['high', 'low'] as const) test(`T-E24-headlamp-hitch ${webgpu ? 'webgpu' : 'webgl2'} ${quality}: no frame over 50 ms when the headlamp is picked up`, async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, `/?test=1&ui=1&${webgpu ? '' : 'renderer=webgl&'}quality=${quality}&audio=muted&dpr=1&loadProfile=1`);
  await page.evaluate(async quality => {
    const a = window.__SS__!;
    await a.loadLevel('L6', { seed: 1, progression: 'L6-default' }); a.settings.set({ quality }); a.pause(); a.missions.begin();
    a.teleport(1, { x: 1.5, z: -.9 }); a.camera.follow(); await a.step(2); await a.screenshotReady();
  }, quality);
  await page.evaluate(() => {
    const probe = (window as unknown as { hitch: { frames: { t: number; ms: number }[]; previous: number; stopped: boolean } }).hitch = { frames: [] as { t: number; ms: number }[], previous: 0, stopped: false };
    const frame = (now: number) => { if (probe.previous) probe.frames.push({ t: now, ms: now - probe.previous }); probe.previous = now; if (!probe.stopped) requestAnimationFrame(frame); };
    requestAnimationFrame(frame); window.__SS__!.resume();
  });
  // Press only once play is steady (90 consecutive frames under 34 ms): the resume after loading has its own first frames.
  await page.waitForFunction(() => { const f = (window as unknown as { hitch: { frames: { ms: number }[] } }).hitch.frames; return f.length >= 90 && f.slice(-90).every(x => x.ms < 34); }, undefined, { timeout: 60_000, polling: 100 });
  const builds = await page.evaluate(() => ({ count: window.__SS__!.perf().nodeBuilds as number, keys: { ...window.__SS__!.perf().nodeBuildMaterials } as Record<string, number> }));
  const pressed = await page.evaluate(() => performance.now());
  await page.keyboard.down('e'); await page.waitForTimeout(700); await page.keyboard.up('e');
  await page.waitForFunction(() => window.__SS__!.missions.state()!.l6!.flashlight, undefined, { timeout: 20_000 });
  const lit = await page.evaluate(() => performance.now());
  await page.waitForTimeout(4000);
  const settled = await page.evaluate(() => performance.now());
  // The first breach (30-40 s in) is the other candidate the PO could have met near the pickup. Report it too.
  await page.waitForFunction(() => window.__SS__!.missions.state()!.l6!.phase !== 'shelter', undefined, { timeout: 60_000, polling: 250 });
  const breached = await page.evaluate(() => performance.now());
  await page.waitForTimeout(3000);
  const result = await page.evaluate(({ pressed, settled, breached }) => {
    const probe = (window as unknown as { hitch: { frames: { t: number; ms: number }[]; stopped: boolean } }).hitch; probe.stopped = true; window.__SS__!.pause();
    const before = probe.frames.filter(f => f.t < pressed - 200 && f.t > pressed - 1500), after = probe.frames.filter(f => f.t >= pressed && f.t < settled);
    const breach = probe.frames.filter(f => f.t >= breached - 2500);
    return { before: Math.max(...before.map(f => f.ms)), after: Math.max(...after.map(f => f.ms)), over50: after.filter(f => f.ms > 50).map(f => Math.round(f.ms)), frames: after.length,
      breachMax: Math.max(...breach.map(f => f.ms)), breachOver50: breach.filter(f => f.ms > 50).map(f => Math.round(f.ms)), backend: window.__SS__!.getState().render.backend };
  }, { pressed, settled, breached });
  const after = await page.evaluate(() => ({ count: window.__SS__!.perf().nodeBuilds as number, keys: { ...window.__SS__!.perf().nodeBuildMaterials } as Record<string, number> }));
  const compiled = { nodeBuilds: after.count - builds.count, materials: Object.entries(after.keys).filter(([k, n]) => n > (builds.keys[k] ?? 0)).map(([k, n]) => `${k} x${n - (builds.keys[k] ?? 0)}`) };
  console.log(`headlamp compiles after pickup: ${compiled.nodeBuilds} ${JSON.stringify(compiled.materials.slice(0, 40))}`);
  const out = `test-results/l6-headlamp-hitch`; mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/${webgpu ? 'webgpu' : 'webgl2'}-${quality}.json`, JSON.stringify({ ...result, compiled, litAfterMs: lit - pressed }, null, 2));
  console.log(`headlamp ${result.backend} ${quality}: max before ${result.before.toFixed(1)} ms, max after ${result.after.toFixed(1)} ms, over 50: ${JSON.stringify(result.over50)}; breach max ${result.breachMax.toFixed(1)} ms over 50 ${JSON.stringify(result.breachOver50)}`);
  expect(result.backend).toBe(webgpu ? 'webgpu' : 'webgl');
  expect(result.over50).toEqual([]);
});
