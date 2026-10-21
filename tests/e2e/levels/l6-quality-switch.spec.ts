import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';
import { canvasFrame, canvasFrameLimits } from '../canvas-frame';

// QA 10-21 #82 "L6, both survivors, tick ~30-160 in the shelter (3,0): switching quality low -> high throws
// "TypeError: Cannot read properties of null (reading 'depthTexture')" in the shadow update (updateShadow). WebGL2: the 3D
// view stays blank (HUD only) for the rest of the session, also after switching again; WebGPU: ~190 GPU validation errors".
// Real quality switches through the settings API with the clock running (real rAF frames), low -> high -> low -> high,
// then zoom 1.5 at high and low. Every step must stay error-free and present a varied game canvas.
// WebGPU pass: L6_QS_WEBGPU=1.
const webgpu = process.env.L6_QS_WEBGPU === '1';
if (webgpu) test.use({ launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] } });
const spots = [
  { name: 'L6-shelter', level: 'L6', setup: [] as string[], at: { x: 3, z: 0 } },
  { name: 'L6-tunnel', level: 'L6', setup: ['shelter', 'stop'], at: { x: 112, z: 15.4 } },
  { name: 'L6-exit', level: 'L6', setup: ['shelter', 'stop', 'retreat'], at: { x: 246, z: 15 } },
  { name: 'L1-street', level: 'L1', setup: [] as string[], at: null },
] as const;
for (const spot of spots) test(`QA #82 ${webgpu ? 'webgpu' : 'webgl2'} ${spot.name}: runtime quality switches keep the 3D view and raise no error`, async ({ page }) => {
  test.setTimeout(240_000);
  const out = `test-results/l6-quality-switch/${webgpu ? 'webgpu' : 'webgl2'}`; mkdirSync(out, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' || /validation|depthTexture/i.test(m.text())) errors.push(`console ${m.text().slice(0, 200)}`); });
  await boot(page, `/?test=1&ui=1&${webgpu ? '' : 'renderer=webgl&'}quality=low&audio=muted&dpr=1&seed=1`);
  await page.evaluate(async spot => {
    const a = window.__SS__!;
    await a.loadLevel(spot.level, spot.level === 'L6' ? { seed: 1, progression: 'L6-default' } : { seed: 1 }); a.settings.set({ quality: 'low' }); a.pause(); a.missions.begin();
    a.cheats.god(true);
    for (const id of spot.setup) a.cheats.completeObjective(id);
    // Tunnel and exit run with the headlamp on: the hero spot is the shadow source there.
    if (spot.setup.length) a.missions.state()!.items.push('headlamp');
    if (spot.at) a.teleport(1, spot.at);
    a.camera.follow(); await a.step(30); await a.screenshotReady();
  }, spot);
  const rows: unknown[] = [];
  const settle = async (label: string) => {
    const frames = await page.evaluate(() => window.__SS__!.perf().renderedFrames);
    await page.evaluate(() => window.__SS__!.resume()); await page.waitForTimeout(1500); await page.evaluate(() => window.__SS__!.pause());
    const after = await page.evaluate(() => window.__SS__!.perf().renderedFrames);
    let frame: Awaited<ReturnType<typeof canvasFrame>> | null = null, frameError = '';
    try { frame = await canvasFrame(page); } catch (e) { frameError = String(e).slice(0, 200); }
    const state = await page.evaluate(() => ({ tier: window.__SS__!.perf().quality.tier, zoom: window.__SS__!.getState().render.camera.zoom, drawCalls: window.__SS__!.perf().drawCalls, backend: window.__SS__!.getState().render.backend, preset: window.__SS__!.getState().render.lighting?.preset }));
    await page.screenshot({ path: `${out}/${spot.name}-${rows.length}-${label}.png` });
    const row = { label, ...state, frames: after - frames, variance: frame?.variance, variedTiles: frame?.variedTiles, frameError, errors: errors.length };
    rows.push(row); return row;
  };
  await settle('low-z1');
  const setQuality = async (quality: 'low' | 'high') => { try { await page.evaluate(t => window.__SS__!.settings.set({ quality: t }), quality); } catch (e) { errors.push(`set ${quality}: ${String(e).slice(0, 200)}`); } };
  for (const tier of ['high', 'low', 'high'] as const) { await setQuality(tier); await settle(`${tier}-z1`); }
  await page.mouse.move(800, 450);
  for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 120); await page.evaluate(() => window.__SS__!.step(1)); }
  await page.evaluate(() => window.__SS__!.step(30));
  await settle('high-zoomed');
  await setQuality('low'); await settle('low-zoomed');
  writeFileSync(`${out}/${spot.name}.json`, JSON.stringify({ rows, errors }, null, 2));
  console.log(`${spot.name} ${webgpu ? 'webgpu' : 'webgl2'}: ${JSON.stringify(rows)} errors ${JSON.stringify(errors.slice(0, 3))}`);
  expect(errors).toEqual([]);
  for (const row of rows as { label: string; frames: number; variance?: number; variedTiles?: number; frameError: string; backend: string; tier: string }[]) {
    expect(row.frameError, row.label).toBe('');
    expect(row.frames, row.label).toBeGreaterThan(10);
    expect(row.variance ?? 0, row.label).toBeGreaterThan(canvasFrameLimits.varianceMin);
    expect(row.variedTiles ?? 0, row.label).toBeGreaterThanOrEqual(canvasFrameLimits.variedTilesMin);
    expect(row.backend).toBe(webgpu ? 'webgpu' : 'webgl');
    expect(row.tier).toBe(row.label.startsWith('high') ? 'high' : 'low');
  }
});
