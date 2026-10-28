import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { canvasFrame, canvasFrameChecks } from './canvas-frame';
import { boot, expect, test, testUrl } from './fixtures';

// Minimal browser smoke (docs/qa/test-strategy.md): boot, L1 start with its figures actually drawn on both backends, no
// console/pipeline errors (the fixtures' error guard fails every test on console errors and failed requests). Next to it:
// webgpu-unflagged.spec.ts (real menu → L1 on players' WebGPU) and crowd-gpu-limits.spec.ts (compiled-program limits).
test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });

// N12 dedicates the existing boot case to the public artifact. QA-looking query
// parameters must stay inert while a real menu start reaches a rendered level.
test('public build: menu start draws L1 and exposes no QA globals @public-smoke', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/?test=1&testApi=1&debug=true&motionlab=1&scenelab=1&lookdev=1&quality=low&dpr=1&audio=muted');
  await expect(page.getByRole('heading', { name: 'MINOR INCIDENT' })).toBeVisible();
  expect(await page.evaluate(() => ['__SS__', '__SCENE__', '__MOTIONLAB__', '__ASSET__'].some(key => key in window))).toBe(false);
  await page.getByTestId('start-game').click();
  await page.getByTestId('character-female').click();
  await page.getByTestId('level-L1').click();
  await page.getByTestId('mission-button').click({ timeout: 120_000 });
  await page.getByTestId('pause-button').waitFor({ state: 'visible', timeout: 120_000 });
  await expect(page).toHaveTitle('Minor Incident');
  mkdirSync('test-results/smoke', { recursive: true });
  await page.screenshot({ path: 'test-results/smoke/public-boot.png' });
  expect(canvasFrameChecks(await canvasFrame(page, false)).filter(c => !c.pass), 'public L1 canvas contains visible spatial detail').toEqual([]);
  expect(await page.evaluate(() => ['__SS__', '__SCENE__', '__MOTIONLAB__', '__ASSET__'].some(key => key in window))).toBe(false);
});

// Q-208 guard (Opus QA, batch 20: "the courier's own skin and her held bat get their shaders rebuilt over and over during
// play. The game freezes for 0.6 to 1.8 s each time"). Plays L1 through the lab handover and the outbreak with the bat,
// then walks the courier on and off the corpse pile in real frames (the foreground depth slice toggles there). Fails on any
// courier/carried-weapon build after warm-up, any rebuild of a program that was already built (same material, object and
// render context: a program key that changed at runtime), or any frame over 200 ms (PO checklist Q-126). First builds of
// other objects that only appear later are listed in the annotation. WebGPU low at zoom 1.5, as reported.
test('L1 handover + outbreak: no shader builds after warm-up and no frame over 200 ms @smoke', async ({ page }) => {
  test.setTimeout(200_000);
  await page.goto('/');
  const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
  test.skip(!adapter && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
  await boot(page, testUrl.replace('renderer=webgl', 'renderer=webgpu').replace('quality=high', 'quality=low') + '&loadProfile=2');
  const builds = (): Promise<Record<string, number>> => page.evaluate(() => ({ ...window.__SS__!.perf().nodeBuildMaterials }));
  const pile = await page.evaluate(async () => {
    const a = window.__SS__!;
    a.settings.set({ quality: 'low' }); await a.loadLevel('L1', { seed: 1 });
    // Q-209: the level warm-up (prewarmHeld) must already have built the bat the courier picks up below.
    const loaded = { ...a.perf().nodeBuildMaterials };
    a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5);
    // Handover: the parcel is delivered, the technician walks in, the lab accident lets the infected out.
    a.cheats.completeObjective('pickup'); a.cheats.completeObjective('deliver');
    for (let i = 0; i < 40 && a.missions.state()!.steps.escape?.status !== 'active'; i++) await a.step(60);
    a.cheats.completeObjective('escape'); a.cheats.completeObjective('weapon');
    await a.step(120); a.cheats.killAll(); await a.step(30);
    // Ordinary L1 human corpses are not solid foreground triggers. Add a dead Alpha,
    // whose large corpse is the production trigger, and prove both switch states.
    const player = a.query({ kind: 'player' })[0];
    const alphaId = a.spawn('infected.alpha', { x: player.transform.x + 4, z: player.transform.z });
    a.cheats.killAll(); await a.step(2);
    const alpha = a.getEntity(alphaId)!;
    a.teleport(1, { x: alpha.transform.x + 7, z: alpha.transform.z });
    const far = a.getState().render.courierForeground;
    a.teleport(1, { x: alpha.transform.x + 1, z: alpha.transform.z });
    const near = a.getState().render.courierForeground;
    return { alpha: { x: alpha.transform.x, z: alpha.transform.z }, far, near, loaded };
  });
  const { alpha, far, near, loaded } = pile;
  expect(far, 'courier foreground off beyond the large corpse trigger').toBe(false);
  expect(near, 'courier foreground on beside a dead Alpha').toBe(true);
  // Warm-up: the level's own prewarm plus a few real frames next to the pile.
  await page.evaluate(async () => { const a = window.__SS__!; a.resume(); await new Promise(r => setTimeout(r, 1500)); });
  const warm = await builds();
  const frames = await page.evaluate(async spots => {
    const a = window.__SS__!, gaps: number[] = [], foreground: boolean[] = []; let previous = 0, stop = false;
    const sample = (now: number): void => { if (previous) gaps.push(now - previous); previous = now; if (!stop) requestAnimationFrame(sample); };
    requestAnimationFrame(sample);
    for (let round = 0; round < 2; round++) for (const spot of spots) {
      a.teleport(1, { x: spot.x + 7, z: spot.z }); await new Promise(r => setTimeout(r, 700)); foreground.push(a.getState().render.courierForeground);
      a.teleport(1, { x: spot.x + 1, z: spot.z }); await new Promise(r => setTimeout(r, 700)); foreground.push(a.getState().render.courierForeground);
    }
    stop = true; a.pause();
    return { foreground, max: Math.max(...gaps), over: gaps.filter(g => g > 200), count: gaps.length };
  }, [alpha]);
  expect(frames.foreground, 'foreground toggles during the measured frames').toEqual([false, true, false, true]);
  const after = await builds(), built = Object.entries(after).filter(([key, n]) => n !== warm[key]);
  test.info().annotations.push({ type: 'builds after warm-up', description: JSON.stringify(Object.fromEntries(built)) }, { type: 'frames', description: `max ${frames.max.toFixed(0)} ms in ${frames.count}` });
  // Keys are material:object:m<material id>:c<render context>:o<object id> (Renderer loadProfile=2).
  expect(built.filter(([key]) => /^(character:|action-held:)/.test(key)).map(([key]) => key), 'courier or carried-weapon builds after warm-up').toEqual([]);
  expect(built.filter(([key, n]) => n > 1 || warm[key]).map(([key]) => key), 'programs rebuilt during play').toEqual([]);
  expect(frames.over, `gameplay frames over 200 ms (max ${frames.max.toFixed(0)} ms in ${frames.count})`).toEqual([]);
  // Q-209 (Opus QA: "the held weapon's shaders compile once, the first time she takes it out... bat at pickup on L1 (4 programs),
  // fire axe at L2 start (7 programs)"): no carried-weapon program is built after the level's warm-up, pickup included.
  const heldBuilds = (from: Record<string, number>, to: Record<string, number>) => Object.keys(to).filter(key => key.startsWith('action-held:') && to[key] !== from[key]);
  expect(heldBuilds(loaded, after), 'L1 carried-weapon builds after the level warm-up (bat pickup)').toEqual([]);
  const l2 = await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L2', { seed: 1 }); const loaded = { ...a.perf().nodeBuildMaterials };
    a.missions.begin(); a.resume(); await new Promise(r => setTimeout(r, 2500));
    // Q-211: the axe is picked up for real (no pickup entity exists at load), still without a new program.
    a.cheats.completeObjective('axe'); await new Promise(r => setTimeout(r, 1500)); a.pause();
    return { loaded, after: { ...a.perf().nodeBuildMaterials } };
  });
  expect(heldBuilds(l2.loaded, l2.after), 'L2 carried-weapon builds after the level warm-up (fire axe at the start and at its pickup)').toEqual([]);
  const l8 = await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L8', { seed: 1 }); a.pause(); a.missions.begin();
    const loaded = { ...a.perf().nodeBuildMaterials }, state = a.getState(), carId = state.l8!.carId, car = a.getEntity(carId)!;
    const yaw = car.transform.yaw, c = Math.cos(yaw), s = Math.sin(yaw);
    a.teleport(1, { x: car.transform.x + c * .71 + s * 2.025, z: car.transform.z - s * .71 + c * 2.025 });
    a.input.set({ interact: true }); await a.step(1); a.input.clear(); a.resume(); await new Promise(resolve => setTimeout(resolve, 1500)); a.pause();
    const boarded = a.events(0).some(event => event.type === 'vehicle.entered' && event.sourceId === carId && event.targetId === 1);
    return { loaded, after: { ...a.perf().nodeBuildMaterials }, boarded, carId };
  });
  const lateVehicleBuilds = Object.entries(l8.after).filter(([key, count]) => count !== l8.loaded[key] && /^(character:|action-held:|vehicle:)/.test(key));
  mkdirSync('test-results/smoke', { recursive: true });
  writeFileSync('test-results/smoke/l8-boarding-builds.json', JSON.stringify({ level: 'L8', vehicle: 'APC', boarded: l8.boarded, before: l8.loaded, after: l8.after, lateVehicleBuilds: Object.fromEntries(lateVehicleBuilds) }, null, 2));
  test.info().annotations.push({ type: 'L8 boarding shader builds', description: JSON.stringify({ carId: l8.carId, boarded: l8.boarded, builds: Object.fromEntries(lateVehicleBuilds) }) });
  expect(l8.boarded, 'L8 APC boarding exercised after warm-up').toBe(true);
  expect(lateVehicleBuilds, 'courier, weapon, or vehicle builds after L8 warm-up and APC boarding').toEqual([]);
});

// P0 guard (PROD "all other players are invisible"): each on-screen pedestrian's head/torso pixels must change when that
// pedestrian is moved off screen, so hand props and shadows alone cannot pass.
for (const renderer of ['webgl', 'webgpu'] as const) test(`L1 start: pedestrians are drawn on screen (${renderer}), not only their props @smoke`, async ({ page }) => {
  test.setTimeout(120_000);
  if (renderer === 'webgpu') {
    await page.goto('/');
    const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
    test.skip(!adapter && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
  }
  await boot(page, testUrl.replace('renderer=webgl', `renderer=${renderer}`));
  const before = await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L1', { seed: 1 }); a.missions.begin(); a.pause(); a.camera.follow();
    const player = a.query({ kind: 'player' })[0].transform;
    const calm = () => a.query({ kind: 'civilian' }).filter(e => !e.hidden && !e.civilian?.pet && e.civilian?.adult !== false && e.civilian?.state === 'calm' && e.health.current > 0);
    for (const [i, c] of calm().slice(0, 6).entries()) a.teleport(c.id, { x: player.x - 4 + (i % 3) * 3, z: player.z + 3 + Math.floor(i / 3) * 3 });
    await a.step(30); await a.screenshotReady();
    // Entity transforms sit .7 m above the feet: head ~ +.95, chest ~ +.45.
    const civilians = calm().map(e => ({ id: e.id, head: a.camera.project(e.transform.x, e.transform.y + .95, e.transform.z), chest: a.camera.project(e.transform.x, e.transform.y + .45, e.transform.z) }))
      .filter(c => Math.abs(c.head[0]) < .85 && Math.abs(c.head[1]) < .85 && Math.abs(c.chest[1]) < .7 && c.head[2] < 1);
    return { civilians, backend: a.perf().backend };
  });
  mkdirSync('test-results/smoke', { recursive: true });
  const shown = PNG.sync.read(await page.locator('canvas').screenshot({ path: `test-results/smoke/l1-${renderer}.png` }));
  await page.evaluate(async ids => { const a = window.__SS__!; ids.forEach((id, i) => a.teleport(id, { x: -400 - i * 3, z: -400 })); await a.step(2); await a.screenshotReady(); }, before.civilians.map(c => c.id));
  const hidden = PNG.sync.read(await page.locator('canvas').screenshot());
  const drawn = before.civilians.filter(c => {
    const cx = Math.round((c.head[0] + 1) / 2 * shown.width), top = Math.round((1 - c.head[1]) / 2 * shown.height);
    const bottom = Math.round((1 - c.chest[1]) / 2 * shown.height), half = Math.max(3, Math.round((bottom - top) / 4));
    let changed = 0;
    for (let y = Math.max(0, top); y < Math.min(shown.height, bottom); y++) for (let x = Math.max(0, cx - half); x < Math.min(shown.width, cx + half); x++) {
      const i = (y * shown.width + x) * 4;
      if (Math.abs(shown.data[i] - hidden.data[i]) + Math.abs(shown.data[i + 1] - hidden.data[i + 1]) + Math.abs(shown.data[i + 2] - hidden.data[i + 2]) > 24) changed++;
    }
    return changed >= (bottom - top) * half * 2 * .25;
  }).length;
  expect(before.backend).toBe(renderer);
  expect(before.civilians.length, 'pedestrians in the L1 start view').toBeGreaterThanOrEqual(3);
  expect(drawn, 'pedestrian heads/torsos actually rendered').toBe(before.civilians.length);
});
