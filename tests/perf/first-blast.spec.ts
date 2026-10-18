import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';
/** E27 cold first blast on both backends (vfx-stunning-3): the explosions.spec.ts car chain, measured from the first
 * explosion event. `firstMax` covers the first 1.5 s (blast onset: cold blast/fireball/debris/PostFx draws), `max`
 * the whole 7 s (including the corpse-page beat). Native timing: run through tools/perf/quiet-run.sh, --workers=1.
 * Measurement only: E18's hitch limit stays asserted in explosions.spec.ts (WebGL). */
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
const out = process.env.FIRST_BLAST_OUT ?? 'test-results/first-blast';
for (const renderer of ['webgl', 'webgpu'] as const) for (const tier of ['high', 'low'] as const) test(`E27 @perf first blast ${renderer} ${tier}`, async ({ page }) => {
  test.setTimeout(120_000);
  if (tier === 'low') {
    await page.setViewportSize({ width: 390, height: 844 });
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  const diag = process.env.FIRST_BLAST_DIAG === '1';
  await boot(page, `/?test=1&renderer=${renderer}&quality=${tier}&audio=muted&dpr=1${diag ? '&scenelab=1' : ''}`);
  const result = await page.evaluate(async (diag) => {
    const a = window.__SS__!; await a.loadScenario('blast-stress'); a.cheats.god(true); a.settings.set({ cameraShake: true, slowMotion: false });
    a.teleport('player', { x: -1.5, z: 5 }); a.spawn('hazard.propane', { x: 2.5, z: -1.5 }); a.spawn('hazard.barrel', { x: -2.5, z: -2 });
    await a.screenshotReady();
    // Diagnostic (FIRST_BLAST_DIAG=1): which programs/pipelines/node graphs are built synchronously during play.
    const built: { at: number; kind: string; what: string; ms?: number }[] = [];
    if (diag) {
      type RO = { material?: { type: string; name: string }; object?: { name: string; type: string; parent?: { name: string } } };
      const renderer = (window as unknown as { __SCENE__: { game: { view: { renderer: { backend: Record<string, (...args: unknown[]) => unknown>; _nodes: Record<string, (...args: unknown[]) => unknown> } } } } }).__SCENE__.game.view.renderer;
      const what = (ro: RO) => `${ro.object?.parent?.name ?? ''}/${ro.object?.name || ro.object?.type}:${ro.material?.type}${ro.material?.name ? ' ' + ro.material.name : ''}`;
      const t0 = 0, backend = renderer.backend, nodes = renderer._nodes;
      const pipeline = backend.createRenderPipeline.bind(backend), program = backend.createProgram.bind(backend), nodeBuild = nodes.getForRender.bind(nodes);
      backend.createRenderPipeline = (ro, promises) => { if (!promises) built.push({ at: Math.round(performance.now() - t0), kind: 'pipeline', what: what(ro as RO) }); return pipeline(ro, promises); };
      backend.createProgram = (stage) => { built.push({ at: Math.round(performance.now() - t0), kind: 'program', what: (stage as { name: string; stage: string }).stage + ' ' + (stage as { name: string }).name }); return program(stage); };
      nodes.getForRender = (ro) => { const s = performance.now(), r = nodeBuild(ro), ms = performance.now() - s; if (ms > 1) built.push({ at: Math.round(s - t0), kind: 'nodes', what: what(ro as RO), ms: Math.round(ms * 10) / 10 }); return r; };
    }
    const car = a.query({ kind: 'vehicle' })[0].id; a.explosions.wreck(car); a.resume();
    // Frames before the blast are the warm baseline; the wreck explodes after 3 s.
    const before: number[] = []; let previous = 0;
    while (!a.events(-1).some(e => e.type === 'explosion')) { const now = await new Promise<number>(r => requestAnimationFrame(r)); if (previous) before.push(now - previous); previous = now; }
    a.explosions.blast('explosion.fuel-truck', { x: 4, z: -8 });
    const times: { at: number; ms: number }[] = [], start = performance.now();
    while (performance.now() - start < 7000) {
      const now = await new Promise<number>(r => requestAnimationFrame(r));
      times.push({ at: Math.round(now - start), ms: Math.round((now - previous) * 10) / 10 }); previous = now;
    }
    const max = (rows: { ms: number }[]) => Math.max(...rows.map(r => r.ms));
    const p95 = (v: number[]) => [...v].sort((x, y) => x - y)[Math.ceil(v.length * .95) - 1];
    const first = times.filter(t => t.at <= 1500);
    return { backend: a.perf().backend, firstMax: max(first), firstAt: first.find(t => t.ms === max(first))!.at, max: max(times), maxAt: times.find(t => t.ms === max(times))!.at,
      p95: p95(times.map(t => t.ms)), warmP95: p95(before.slice(10)), frames: times.length, spikes: times.filter(t => t.ms > 34), blasts: a.events(0).filter(e => e.type === "explosion").length, built, blastStart: Math.round(start) };
  }, diag);
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/${renderer}-${tier}-r${test.info().repeatEachIndex}.json`, JSON.stringify({ ...result, cpuThrottle: tier === 'low' ? 4 : 1, viewport: tier === 'low' ? '390x844' : '1600x900' }, null, 2));
  console.log(`first-blast ${renderer} ${tier}: firstMax ${result.firstMax} ms @${result.firstAt}, max ${result.max} ms @${result.maxAt}, p95 ${result.p95}`);
  expect(result.backend).toBe(renderer); expect(result.blasts).toBeGreaterThanOrEqual(2);
});
