import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { look } from '../../tools/playtest/eyes';
import { canvasFrame, canvasFrameChecks } from './canvas-frame';
import { boot, expect, test, testUrl } from './fixtures';

const l10HangarWeapons = ['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg', 'weapon.shotgun', 'weapon.rocket-launcher', 'weapon.pipe-bomb', 'weapon.hunting-rifle', 'weapon.nail-gun', 'weapon.machete', 'weapon.molotov', 'weapon.assault-rifle', 'weapon.flashbang', 'weapon.flamethrower'];

// Minimal browser smoke (docs/qa/test-strategy.md): boot, L1 start with its figures actually drawn on both backends, no
// console/pipeline errors (the fixtures' error guard fails every test on console errors and failed requests). Next to it:
// webgpu-unflagged.spec.ts (real menu → L1 on players' WebGPU) and crowd-gpu-limits.spec.ts (compiled-program limits).
test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });

// The public artifact permits pause diagnostics; QA-only query parameters stay
// inert while a real menu start reaches a rendered level.
test('public build: menu start draws L1, debug info is query-gated, and no QA globals escape @public-smoke', async ({ page }) => {
  test.setTimeout(150_000);
  mkdirSync('test-results/smoke', { recursive: true });
  // Q-280: the PO opens ?debug=1 on PROD and expects the original pause diagnostics.
  for (const debug of ['1', 'true', null]) {
    const params = new URLSearchParams('test=1&testApi=1&motionlab=1&scenelab=1&lookdev=1&quality=low&dpr=1&audio=muted');
    if (debug) params.set('debug', debug);
    await page.goto(`/?${params}`);
    await expect(page.getByRole('heading', { name: 'MINOR INCIDENT' })).toBeVisible();
    expect(await page.evaluate(() => ['__SS__', '__SCENE__', '__MOTIONLAB__', '__ASSET__'].some(key => key in window))).toBe(false);
    await page.getByTestId('start-game').click();
    if (await page.getByTestId('character-female').isVisible()) await page.getByTestId('character-female').click();
    // Diagnostics do not unlock levels or enable debug campaign cheats on PROD.
    await expect(page.getByTestId('level-L2')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('level-L2').click({ force: true });
    await expect(page.getByTestId('level-L1')).toBeVisible();
    await page.getByTestId('level-L1').click();
    await page.getByTestId('mission-button').click({ timeout: 120_000 });
    await page.getByTestId('pause-button').waitFor({ state: 'visible', timeout: 120_000 });
    await expect(page).toHaveTitle('Minor Incident');
    if (debug === '1') await page.screenshot({ path: 'test-results/smoke/public-boot.png' });
    expect(canvasFrameChecks(await canvasFrame(page, false)).filter(c => !c.pass), 'public L1 canvas contains visible spatial detail').toEqual([]);
    expect(await page.evaluate(() => ['__SS__', '__SCENE__', '__MOTIONLAB__', '__ASSET__'].some(key => key in window))).toBe(false);
    await page.getByTestId('pause-button').click();
    await expect(page.getByTestId('menu-pause')).toBeVisible();
    const panel = page.getByTestId('pause-debug');
    if (debug) {
      await expect(panel).toBeVisible();
      await expect(page.getByTestId('pause-debug-text')).toContainText('Level: L1');
      for (const field of ['Step:', 'Checkpoint:', 'Player (x, z, y):', 'District:', 'HP ', 'Loadout:', 'Backend:', 'FPS (2 s avg):', 'Entities:', 'Build:']) await expect(panel).toContainText(field);
    } else await expect(panel).toHaveCount(0);
    const loadedDebugChunk = await page.evaluate(() => performance.getEntriesByType('resource').some(r => /\/DebugInfo-[^/]+\.js/.test(r.name)));
    expect(loadedDebugChunk, `debug=${debug ?? 'absent'} loads the overlay chunk only when requested`).toBe(Boolean(debug));
    await page.screenshot({ path: `test-results/smoke/public-debug-${debug ?? 'absent'}.png` });
  }
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
  await boot(page, testUrl.replace('renderer=webgl', 'renderer=webgpu').replace('quality=high', 'quality=low') + '&loadProfile=2&ui=1');
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
  const ending = await page.evaluate(async () => {
    const a = window.__SS__!;
    a.cheats.completeObjective('firestation'); await a.step(1); await a.screenshotReady();
    return { closed: a.missions.state()!.gates['fire-shutter'] === false, builds: { ...a.perf().nodeBuildMaterials } };
  });
  const shutterKeys = Object.keys(ending.builds).filter(key => key.startsWith('story:shutter:'));
  expect(ending.closed, 'native L1 completion closes the bay shutter').toBe(true);
  expect(shutterKeys.length, 'shutter surface was included in loading warm-up').toBeGreaterThan(0);
  expect(shutterKeys.filter(key => ending.builds[key] !== loaded[key]), 'shutter closure builds no new shader').toEqual([]);
  const l2 = await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L2', { seed: 1 }); const loaded = { ...a.perf().nodeBuildMaterials };
    a.missions.begin(); a.resume(); await new Promise(r => setTimeout(r, 2500));
    // Q-211: the axe is picked up for real (no pickup entity exists at load), still without a new program.
    a.cheats.completeObjective('axe'); await new Promise(r => setTimeout(r, 1500)); a.pause();
    return { loaded, after: { ...a.perf().nodeBuildMaterials } };
  });
  expect(heldBuilds(l2.loaded, l2.after), 'L2 carried-weapon builds after the level warm-up (fire axe at the start and at its pickup)').toEqual([]);
  // Q-276: L3 has three killable cast families that settle as frozen corpses.
  // Exercise a civilian, police officer and soldier after the level's loading warm-up.
  const l3 = await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L3', { seed: 1 }); a.pause();
    const loaded = { ...a.perf().nodeBuildMaterials };
    a.missions.begin(); a.cheats.god(true); await a.step(30); await a.screenshotReady();
    const required = ['npc.civilian-man-a', 'npc.police-officer', 'npc.national-guard'];
    const cast = a.query({ kind: 'civilian' });
    const player = a.getEntity(1)!.transform;
    const corpses = required.map((model, index) => {
      const actor = cast.find(e => e.health.current > 0 && (e.appearance?.asset ?? e.civilian?.model) === model);
      if (!actor) throw new Error(`L3 corpse warm-up fixture is missing ${model}`);
      a.teleport(actor.id, { x: player.x + 3 + index * 2, z: player.z + 3 });
      a.npcs.finish(actor.id); return { id: actor.id, model };
    });
    await a.step(123); await a.screenshotReady(); a.resume();
    await new Promise(resolve => setTimeout(resolve, 1500)); a.pause();
    const drawnCorpses = a.crowdFigures().filter(f => f.drawn && corpses.some(c => c.id === f.id)).map(f => f.id);
    // A retry replaces the entity records but must retain the warmed corpse graphs.
    a.missions.checkpoint('armory'); a.missions.restore('armory');
    await a.step(3); await a.screenshotReady();
    a.missions.completeObjective('armory'); a.missions.completeObjective('defend'); await a.step(30);
    const at = a.getEntity(1)!.transform;
    // The authored checkpoint is at (225, 0); marker and arrow point straight at it (PO 10-31: no route steering).
    const hud = { text: document.querySelector('[data-testid=objective-text]')?.textContent,
      expectedDistance: Math.round(Math.hypot(225 - at.x, at.z)), marker: a.missions.state()!.marker };
    return { loaded, after: { ...a.perf().nodeBuildMaterials }, corpses, drawnCorpses, hud };
  });
  const lateCorpseBuilds = Object.entries(l3.after).filter(([key, count]) => key.startsWith('corpse_') && count !== l3.loaded[key]);
  mkdirSync('test-results/smoke', { recursive: true });
  writeFileSync('test-results/smoke/l3-corpse-builds.json', JSON.stringify({ level: 'L3', corpses: l3.corpses, before: l3.loaded, after: l3.after, lateCorpseBuilds: Object.fromEntries(lateCorpseBuilds) }, null, 2));
  test.info().annotations.push({ type: 'L3 corpse shader builds', description: JSON.stringify({ corpses: l3.corpses, builds: Object.fromEntries(lateCorpseBuilds) }) });
  expect(lateCorpseBuilds, 'L3 civilian, police and soldier corpse shader builds after warm-up').toEqual([]);
  expect([...new Set(l3.drawnCorpses)].sort(), 'all three settled corpses are actually drawn').toEqual(l3.corpses.map(c => c.id).sort());
  expect(l3.hud.marker, 'L3 marker and arrow point at the army checkpoint itself').toBe('l3-zone');
  expect(l3.hud.text, 'visible L3 HUD distance measures the army checkpoint').toContain(` · ${l3.hud.expectedDistance}\u00a0m`);
  // Faster L7 followers bring newly discovered civilian tiers into the close
  // camera during the first fight. Their hidden LOD1 must already be compiled.
  const l7 = await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L7', { seed: 1 }); a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5);
    a.bot.start('complete');
    let reached = false;
    for (let second = 0; second < 120; second++) {
      await a.step(60);
      const p = a.getEntity(1)!.transform;
      reached = a.query({ kind: 'infected' }).some(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 15);
      if (reached) break;
    }
    a.bot.stop(); await a.screenshotReady();
    const before = { ...a.perf().nodeBuildMaterials };
    a.resume(); await new Promise(resolve => setTimeout(resolve, 20_000)); a.pause();
    const late = Object.entries(a.perf().nodeBuildMaterials).filter(([key, count]) => key.startsWith('pal_picketWhite:static:') && count !== before[key]);
    return { reached, late };
  });
  expect(l7.reached, 'L7 warm-up regression must reach the native fight').toBe(true);
  expect(l7.late, 'L7 near civilian tiers compile before entering the fight camera').toEqual([]);
  const l8 = await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L8', { seed: 1 }); a.pause(); a.missions.begin();
    const loaded = { ...a.perf().nodeBuildMaterials }, state = a.getState(), carId = state.l8!.carId, car = a.getEntity(carId)!;
    a.cheats.god(true);
    const passengerCount = a.testFixtures.l8Boarding();
    // Let the real vehicle passenger-entry animation seat the fixture roster.
    await a.step(180);
    const passengers = a.getEntity(carId)!.vehicle!.passengers ?? [];
    const seated = passengers.filter(passenger => passenger.phase === 'seated').length;
    const yaw = car.transform.yaw, c = Math.cos(yaw), s = Math.sin(yaw);
    a.teleport(1, { x: car.transform.x + c * .71 + s * 2.025, z: car.transform.z - s * .71 + c * 2.025 });
    a.input.set({ interact: true }); await a.step(1); a.input.clear(); a.resume(); await new Promise(resolve => setTimeout(resolve, 1500)); a.pause();
    const boarded = a.events(0).some(event => event.type === 'vehicle.entered' && event.sourceId === carId && event.targetId === 1);
    return { loaded, after: { ...a.perf().nodeBuildMaterials }, boarded, carId, passengerCount, seated };
  });
  const lateVehicleBuilds = Object.entries(l8.after).filter(([key, count]) => count !== l8.loaded[key] && /^(character:|action-held:|vehicle:)/.test(key));
  mkdirSync('test-results/smoke', { recursive: true });
  writeFileSync('test-results/smoke/l8-boarding-builds.json', JSON.stringify({ level: 'L8', vehicle: 'APC', boarded: l8.boarded, before: l8.loaded, after: l8.after, lateVehicleBuilds: Object.fromEntries(lateVehicleBuilds) }, null, 2));
  test.info().annotations.push({ type: 'L8 boarding shader builds', description: JSON.stringify({ carId: l8.carId, boarded: l8.boarded, passengers: `${l8.seated}/${l8.passengerCount}`, builds: Object.fromEntries(lateVehicleBuilds) }) });
  expect(l8.passengerCount, 'L8 fixture includes the living evacuation group').toBeGreaterThan(0);
  expect(l8.seated, 'L8 passenger entry seats the evacuation group before the courier boards').toBe(l8.passengerCount);
  expect(l8.boarded, 'L8 APC boarding exercised after warm-up').toBe(true);
  expect(lateVehicleBuilds, 'courier, weapon, or vehicle builds after L8 warm-up and APC boarding').toEqual([]);
  // Q-227: L10 grants its guns through mission arsenal transactions, long after loading, rather than ground entities.
  // Reach the authored hangar arsenal restoration, then exercise each gun's held graph.
  const l10 = await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L10', { seed: 1 }); a.pause(); a.missions.begin(); a.cheats.god(true);
    const loaded = { ...a.perf().nodeBuildMaterials };
    const warmedPages = a.getState().render.crowd!.staticCorpsePages;
    a.settings.set({ vfx: false });
    const disabledPages = a.getState().render.crowd!.staticCorpsePages;
    a.settings.set({ vfx: true });
    const restoredPages = a.getState().render.crowd!.staticCorpsePages;
    for (const step of ['crash', 'farmstead', 'restricted-zone', 'research-hangar', 'research', 'cure', 'research-exit', 'delivery-corridor']) {
      a.cheats.completeObjective(step); await a.step(1); await a.screenshotReady();
    }
    return { loaded, warmedPages, disabledPages, restoredPages, pickups: a.events(0).filter(e => e.type === 'pickup.collected' && 'actionId' in e).map(e => 'actionId' in e ? e.actionId : '') };
  });
  expect(l10.warmedPages, 'L10 corpse pages were prepared during loading').toBeGreaterThan(0);
  expect(l10.disabledPages, 'disabling VFX retains warmed corpse pages').toBe(l10.warmedPages);
  expect(l10.restoredPages, 'enabling VFX retains warmed corpse pages').toBe(l10.warmedPages);
  expect(l10.pickups, 'L10 checkpoint weapons were collected').toEqual(expect.arrayContaining(['weapon.handgun', 'weapon.shotgun', 'weapon.army-mg', 'weapon.rocket-launcher', 'weapon.flamethrower']));
  const rackIds = await page.evaluate(() => {
    const p = window.__SS__!.getState().player!;
    return [...new Set([...p.weapons!.LEFT.rack, ...p.weapons!.RIGHT.rack].map(slot => slot.id))];
  });
  expect(rackIds).toEqual(expect.arrayContaining(l10HangarWeapons));
  expect(await page.locator('.hud-weapon-rack .hud-weapon-choice').count()).toBeGreaterThanOrEqual(14);
  mkdirSync('test-results/smoke/l10-rack', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(async () => { await window.__SS__!.screenshotReady(); });
  await page.screenshot({ path: 'test-results/smoke/l10-rack/rack-high-1280x720.png' });
  for (const id of l10HangarWeapons) {
    await page.locator(`.hud-weapon-choice[data-weapon="${id}"]`).click();
    await page.evaluate(async () => { await window.__SS__!.step(16); });
    const selected = await page.evaluate(() => { const p = window.__SS__!.getState().player!, side = p.weapons!.selectedSide, rack = p.weapons![side]; const id = rack.index < 0 ? 'weapon.fists' : rack.rack[rack.index].id; return id === 'weapon.kick' ? 'weapon.fists' : id; });
    expect(selected, `rack click for ${id}`).toBe(id);
  }
  const keyboardSeen = new Set<string>();
  for (let i = 0; i < l10HangarWeapons.length * 3 && keyboardSeen.size < l10HangarWeapons.length; i++) {
    await page.keyboard.press('q'); await page.evaluate(async () => { await window.__SS__!.step(16); });
    const selected = await page.evaluate(() => { const p = window.__SS__!.getState().player!, side = p.weapons!.selectedSide, rack = p.weapons![side]; const id = rack.index < 0 ? 'weapon.fists' : rack.rack[rack.index].id; return id === 'weapon.kick' ? 'weapon.fists' : id; });
    if (l10HangarWeapons.includes(selected)) keyboardSeen.add(selected);
  }
  expect([...keyboardSeen].sort()).toEqual([...l10HangarWeapons].sort());
  await page.setViewportSize({ width: 390, height: 844 });
  const touchSession = await page.context().newCDPSession(page);
  await touchSession.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const tap = async (x: number, y: number) => {
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await tap(195, 400);
  await page.evaluate(async () => { await window.__SS__!.step(16); });
  for (const id of l10HangarWeapons) {
    const box = await page.locator(`.hud-weapon-choice[data-weapon="${id}"]`).boundingBox();
    expect(box).not.toBeNull(); await tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.evaluate(async () => { await window.__SS__!.step(16); });
    const selected = await page.evaluate(() => { const p = window.__SS__!.getState().player!, rack = p.weapons![p.weapons!.selectedSide]; return rack.index < 0 ? 'weapon.fists' : rack.rack[rack.index].id; });
    if (selected !== id) await page.screenshot({ path: 'test-results/smoke/l10-rack/touch-failure.png' });
    expect(selected, `touch rack selection for ${id}`).toBe(id);
  }
  expect(await page.evaluate(() => window.__SS__!.getState().input.scheme)).toBe('touch');
  await touchSession.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await touchSession.detach();
  await page.evaluate(async () => { await window.__SS__!.screenshotReady(); });
  const rack = await page.locator('.hud-weapon-rack').boundingBox();
  expect(rack).not.toBeNull(); expect(rack!.x + rack!.width).toBeLessThanOrEqual(390); expect(rack!.y + rack!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: 'test-results/smoke/l10-rack/rack-high-phone-390x844.png' });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(async () => {
    const a = window.__SS__!; a.setLoadout(['weapon.molotov', 'weapon.fire-axe'], ['weapon.pipe-bomb']);
    a.cheats.infiniteCharges(true); a.camera.follow();
    const p = a.getState().player!.transform; a.input.set({ aim: { x: 1, z: 0 }, aimPoint: { x: p.x + 8, z: p.z }, aimSource: 'keyboard' });
    await a.step(1); await a.screenshotReady();
  });
  for (const zoom of [1, 1.5]) {
    await page.evaluate(async value => { const a = window.__SS__!; a.camera.zoom(value); await a.screenshotReady(); }, zoom);
    await page.screenshot({ path: `test-results/smoke/l10-rack/molotov-high-z${zoom}.png` });
  }
  const l10GunBuilds = await page.evaluate(async () => {
    const a = window.__SS__!;
    for (const gun of ['weapon.handgun', 'weapon.shotgun', 'weapon.army-mg', 'weapon.rocket-launcher', 'weapon.flamethrower']) { a.setLoadout(['weapon.fire-axe'], [gun]); await a.step(1); await a.screenshotReady(); }
    return { after: { ...a.perf().nodeBuildMaterials } };
  });
  expect(heldBuilds(l10.loaded, l10GunBuilds.after), 'L10 carried-weapon builds after level warm-up (all checkpoint pickups)').toEqual([]);
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
  await boot(page, testUrl.replace('renderer=webgl', `renderer=${renderer}`) + '&scenelab=1');
  const before = await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L1', { seed: 1 }); a.missions.begin(); a.pause(); a.camera.follow();
    // Keep the six-person visibility fixture in view on a narrow portrait canvas, too.
    if (innerWidth < innerHeight) a.camera.zoom(1.5);
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
  // Real-input aiming must treat semantic HUD buttons like native buttons.
  // Cover the view with the weapon widget's role, then keep it out of photos.
  const visibleBodies = await page.evaluate(look);
  expect(visibleBodies.allies.length + visibleBodies.enemies.length, 'pointer guard has a visible positive control').toBeGreaterThan(0);
  await page.evaluate(() => {
    const overlay = document.createElement('div'); overlay.dataset.testid = 'pointer-role-fixture'; overlay.setAttribute('role', 'button');
    overlay.style.cssText = 'position:fixed;inset:44px 0 0;z-index:9999'; document.body.append(overlay);
  });
  try {
    const blocked = await page.evaluate(look);
    expect(blocked.allies.length + blocked.enemies.length, 'role=button intercepts aim without becoming a target').toBe(0);
  } finally { await page.getByTestId('pointer-role-fixture').evaluate(e => e.remove()); }
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
  // Settings must keep a live world and render loop on both backends. The
  // full L1–L10 ordinary-UI matrix lives in tools/qa/quality-switch.mjs.
  for (const quality of ['low', 'high', 'low', 'high'] as const) {
    const start = await page.evaluate(quality => {
      const a = window.__SS__!; a.settings.set({ quality }); a.resume();
      return { tick: a.tick(), frames: a.perf().renderedFrames };
    }, quality);
    await expect.poll(() => page.evaluate(() => window.__SS__!.tick()), { message: `${renderer}/${quality}: world keeps ticking` }).toBeGreaterThan(start.tick + 5);
    await expect.poll(() => page.evaluate(() => window.__SS__!.perf().renderedFrames), { message: `${renderer}/${quality}: world keeps rendering` }).toBeGreaterThan(start.frames + 5);
    const state = await page.evaluate(() => ({ tier: window.__SS__!.getState().render.quality, lost: window.__SS__!.perf().contextLost }));
    expect(state, `${renderer}/${quality}: no recovery or tier drift`).toEqual({ tier: quality, lost: false });
  }
});
