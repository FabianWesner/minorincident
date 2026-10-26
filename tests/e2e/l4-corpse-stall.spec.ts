import type { Page } from '@playwright/test';
import { boot, expect, test, testUrl } from './fixtures';

// Q-197 (PO 10-26, PROD batch 18): "L4 freezes. Just the radar is working but main screen frezes." At the L4 hold
// step (~172 s, 326 corpses, 53 downed, WebGPU low) the 3D view stopped while the sim, the DOM HUD and the radar ran
// on at 119 FPS. Root cause: a lost WebGPU device was never recovered (Game only listened for webglcontextlost;
// three then skips every render). Guards, on an unflagged browser:
// 1. fill L4 to >= 400 corpses with >= 50 downed, walk the courier and require the canvas image (DOM UI hidden) to
//    change every step, with no GPU validation, pipeline, device or render-subsystem error;
// 2. crash the GPU process mid-level: the game must rebuild its renderer and draw new frames again.
test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });

const gpuFailure = /pipeline creation failed|Tint IR|MTLFunction|GPUValidationError|GPUOutOfMemoryError|Uncaptured|Device Lost|Render (device-lost|gpu-error|update|render)/i;

async function requireWebgpu(page: Page): Promise<void> {
  await page.goto('/');
  const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
  test.skip(!adapter && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
}
/** The canvas alone: the HUD, radar and debug text change every frame even when the 3D view is frozen. */
async function canvasShot(page: Page): Promise<Buffer> {
  const style = await page.addStyleTag({ content: '* { visibility: hidden !important } canvas { visibility: visible !important }' });
  try { return await page.screenshot(); } finally { await style.evaluate(node => (node as Element).remove()); }
}
/** Walk the courier a few metres per step; every canvas image must differ from the previous one. */
async function stalls(page: Page, steps: number): Promise<number[]> {
  let previous: Buffer | null = null; const stalled: number[] = [];
  for (let i = 0; i < steps; i++) {
    const rendered = await page.evaluate(async i => {
      const a = window.__SS__!, me = a.getEntity(1)!.transform, before = a.perf().renderedFrames;
      a.teleport('player', { x: me.x + (i % 2 ? -2.5 : 2.5), z: me.z + 1.5 });
      a.resume(); for (let k = 0; k < 20; k++) await new Promise(requestAnimationFrame); a.pause();
      return a.perf().renderedFrames - before;
    }, i);
    expect(rendered, 'view.update rendered frames').toBeGreaterThan(0);
    const shot = await canvasShot(page);
    if (previous && shot.equals(previous)) stalled.push(i);
    previous = shot;
  }
  return stalled;
}

// STALL_BACKENDS=webgpu,webgl and STALL_LEVELS=L1,L4,L10 widen the default (WebGPU, L4) for render-path changes.
for (const level of (process.env.STALL_LEVELS ?? 'L4').split(',')) for (const backend of (process.env.STALL_BACKENDS ?? 'webgpu').split(',') as ('webgpu' | 'webgl')[]) {
  test(`T-Q197-l4-corpse-stall @E19 ${backend} low: ${level} with >= 400 corpses and >= 50 downed keeps presenting frames`, async ({ page }) => {
    test.setTimeout(420_000);
    if (backend === 'webgpu') await requireWebgpu(page);
    const failures: string[] = [];
    page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && gpuFailure.test(m.text())) failures.push(m.text()); });
    await boot(page, testUrl.replace('renderer=webgl', `renderer=${backend}`).replace('quality=high', 'quality=low'));
    const fill = await page.evaluate(async level => {
      const a = window.__SS__!;
      await a.loadLevel(level, { seed: 1, ...(level === 'L1' ? {} : { progression: `${level}-default` as 'L4-default' }) }); a.pause(); a.missions.begin(); a.cheats.god(true);
      // The PO's spot at the L4 hold step (Q-197 readout: -19.45, 10.82 near D-FAIR/l4-reception-4); other levels: their start.
      if (level === 'L4') a.teleport('player', { x: -19.45, z: 10.82 });
      await a.step(5);
      const frame = () => new Promise(requestAnimationFrame);
      const counts = () => {
        const infected = a.query({ kind: 'infected' });
        return { corpses: infected.filter(e => e.corpse || e.health.current <= 0 && e.infected!.recoverAt < 0).length,
          downed: infected.filter(e => e.health.current <= 0 && e.infected!.recoverAt >= 0 && !e.corpse).length };
      };
      const me = a.getEntity(1)!.transform;
      const wave = (n: number, seed: number, radius: (i: number) => number) => {
        for (let i = 0; i < n; i++) {
          const angle = (seed * n + i) * 2.39996, r = radius(i);
          try { a.spawn('infected.runner', { x: me.x + Math.cos(angle) * r, z: me.z + Math.sin(angle) * r }); } catch { /* director cap or pool */ }
        }
      };
      // Waves killed for good (corpse pages), then waves only knocked down (live downed bodies).
      for (let w = 0; w < 40 && counts().corpses < 420; w++) { wave(14, w, i => 3 + (w % 8) * 3.5 + (i % 3)); await a.step(2); a.cheats.killAll(); await a.step(30); await frame(); }
      for (let w = 0; w < 8 && counts().downed < 60; w++) { wave(10, w, () => 4 + (w % 5) * 4); await a.step(2); a.cheats.downAll(); await a.step(20); await frame(); }
      return { ...counts(), backend: a.perf().backend };
    }, level);
    expect(fill.backend).toBe(backend);
    expect(fill.corpses, 'corpses on the plaza').toBeGreaterThanOrEqual(400);
    expect(fill.downed, 'downed infected').toBeGreaterThanOrEqual(50);
    const stalled = await stalls(page, 12);
    await page.waitForTimeout(1000);
    expect(failures, 'GPU validation, pipeline, device or render-subsystem errors').toEqual([]);
    expect(stalled, 'canvas images identical to the previous step (frozen view)').toEqual([]);
  });
}

test('T-Q197-gpu-device-lost @E19 webgpu low: a GPU process crash mid-level rebuilds the renderer and the view draws again', async ({ page, context }) => {
  test.setTimeout(240_000);
  await requireWebgpu(page);
  const losses: string[] = [], failures: string[] = [];
  page.on('console', m => {
    if (/Render device-lost, rebuilding/.test(m.text())) losses.push(m.text());
    else if ((m.type() === 'error' || m.type() === 'warning') && gpuFailure.test(m.text())) failures.push(m.text());
  });
  await boot(page, testUrl.replace('renderer=webgl', 'renderer=webgpu').replace('quality=high', 'quality=low'));
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L4', { seed: 1, progression: 'L4-default' }); a.pause(); a.missions.begin(); a.cheats.god(true); await a.step(30); });
  expect(await stalls(page, 2)).toEqual([]);
  const cdp = await context.browser()!.newBrowserCDPSession();
  const crashed = await cdp.send('Browser.crashGpuProcess' as never).then(() => true, () => false);
  test.skip(!crashed, 'This browser cannot crash its GPU process over CDP');
  await expect.poll(() => losses.length, { timeout: 20_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (window.__SS__!.perf() as { contextLost: boolean }).contextLost), { timeout: 120_000 }).toBe(false);
  const after = await page.evaluate(() => window.__SS__!.perf().backend);
  expect(['webgpu', 'webgl']).toContain(after);
  expect(await stalls(page, 4), 'the rebuilt renderer presents new frames').toEqual([]);
  expect(failures, 'errors other than the recovered device loss').toEqual([]);
});
