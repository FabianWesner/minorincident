import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../../src/Game';
import { test, expect, boot } from '../fixtures';

const output = 'test-results/p0-l7-departure';
test.use({ trace: 'off' });

for (const quality of ['high', 'low'] as const) test(`@E29-AC13 @E29-AC17 corridor retry boards a trapped straggler with real input, ${quality}`, async ({ page }) => {
  test.setTimeout(300_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
  await boot(page, `/?test=1&scenelab=1&renderer=webgl&dpr=1&quality=${quality}&audio=muted&seed=1&ui=1`);
  await page.evaluate(async quality => {
    const a = window.__SS__!; a.settings.set({ quality });
    await a.loadLevel('L7', { seed: 1, progression: 'L7-default' }); a.settings.set({ quality });
  }, quality);
  expect(await page.evaluate(() => window.__SS__!.getState().render.quality)).toBe(quality);
  await page.evaluate(async quality => {
    const a = window.__SS__!; a.pause(); a.cheats.god(true);
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const variant = quality === 'low' ? 'male' : 'female';
    game.campaign!.character = variant; a.survivor.select(variant, 4);
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    // Arrange a corridor checkpoint with a living, physically enclosed straggler.
    // Setup ends at restore: all courier motion below is DOM mouse/keyboard input.
    w.l7Encounters!.state.started = true; a.cheats.killAll();
    a.cheats.completeObjective('rocket');
    a.teleport('player', { x: -52, z: 47.5 });
    const ids = w.l7Encounters!.state.roster.map(r => r.id), last = ids.at(-1)!;
    ids.forEach((id, i) => a.teleport(id, id === last ? { x: -35, z: 47 } : { x: -64 + Math.floor(i / 5), z: 45.5 + i % 5 }));
    a.cheats.completeObjective('corridor');
    w.missions!.checkpoint('corridor');
    const saved = JSON.parse(JSON.stringify(w.missions!.saveResume()));
    w.missions!.loadResume({ current: saved.checkpoint, checkpoint: saved.checkpoint });
    for (const [dx, dz, halfX, halfZ] of [[-1.8, 0, .25, 2], [1.8, 0, .25, 2], [0, -1.8, 2, .25], [0, 1.8, 2, .25]]) {
      const wall = { x: -35 + dx, y: 1.5, z: 47 + dz, halfX, halfY: 1.5, halfZ };
      w.physics.addBlocker(wall);
      w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 980_000 + dx * 10 + dz, blocked: true, wall });
    }
    a.camera.follow();
    game.view.view.zoom(Math.log(1.5 / game.view.view.getState().targetZoom), true);
    await a.step(2);
  }, quality);
  const probe = () => page.evaluate(() => {
    const a = window.__SS__!, s = a.getState(), r = s.l7?.roster.at(-1), e = r && a.getEntity(r.id);
    return { tick: s.tick, scenario: s.scenario, checkpoint: a.missions.state()?.checkpoint, p: s.player!.transform,
      phase: s.l7Departure?.phase, boarded: s.l7Departure?.boarded.length, roster: s.l7?.roster.length,
      last: e?.transform, lastId: r?.id, hud: document.querySelector('[data-testid="survivors-found"]')?.textContent ?? '',
      cue: document.querySelector('[data-testid="sign-of-life"]')?.textContent ?? '' };
  });
  expect((await probe()).checkpoint).toBe('corridor');
  const click = await page.evaluate(() => window.__SS__!.input.project({ x: -56, z: 47.5 }));
  await page.mouse.click(click.x, click.y);
  for (let i = 0; i < 30; i++) { await page.evaluate(() => window.__SS__!.step(6)); if ((await probe()).p.x < -55) break; }
  await page.keyboard.down('w'); await page.keyboard.down('a');
  for (let i = 0; i < 120; i++) { await page.evaluate(() => window.__SS__!.step(3)); if ((await probe()).p.x < -69.5) break; }
  await page.keyboard.up('w'); await page.keyboard.up('a');
  const atDoor = await probe(); expect(Math.hypot(atDoor.p.x + 70.5, atDoor.p.z - 47.5)).toBeLessThan(2);
  const trace = [atDoor]; let confirmed = false;
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/${quality}-1-ring.png` });
  for (let i = 0; i < 100; i++) {
    await page.evaluate(() => window.__SS__!.step(60));
    const s = await probe(); trace.push(s);
    if (i === 10) { await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${output}/${quality}-2-wait.png` }); }
    if (!confirmed && s.phase === 'boarding' && s.hud.includes('Everyone aboard')) {
      confirmed = true; await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${output}/${quality}-3-everyone.png` });
    }
    if (s.phase === 'departing') { await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${output}/${quality}-departure.png` }); break; }
    if (s.scenario !== 'L7') break;
  }
  const end = await probe();
  writeFileSync(`${output}/${quality}-report.json`, JSON.stringify({ atDoor, end, seconds: (end.tick - atDoor.tick) / 60, trace }, null, 2));
  console.log(JSON.stringify({ quality, atDoor, end, seconds: (end.tick - atDoor.tick) / 60 }));
  expect(end.phase, 'the complete living roster boards; a trapped follower cannot hang departure').toBe('departing');
  expect(end.boarded).toBe(end.roster);
  expect(trace.some(s => /Aboard \d+\/\d+/.test(s.hud))).toBe(true);
  expect(trace.some(s => /Waiting for .+ · \d+ m/.test(s.cue))).toBe(true);
  expect(confirmed, 'Everyone aboard is visible before the cinematic hides the HUD').toBe(true);
  expect(end.hud).toContain('Everyone aboard');
  expect(await page.evaluate(() => window.__SS__!.getState().render.missionMarker?.visible)).toBe(false);
  await expect(page.locator('[data-testid=mission-marker]')).toBeHidden();
  expect((end.tick - atDoor.tick) / 60).toBeLessThan(60);
  await page.evaluate(() => window.__SS__!.step(550));
  await page.waitForFunction(() => window.__SS__!.getState().scenario === 'L8');
  await page.waitForFunction(() => document.body.dataset.uiScreen === 'game');
  await page.evaluate(() => window.__SS__!.screenshotReady());
  expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L8');
  expect(await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom)).toBe(1.5);
  expect(await page.evaluate(() => window.__SS__!.getState().render.character?.modelId)).toBe(`char.courier-${quality === 'low' ? 'male' : 'female'}.skin`);
  expect(await page.evaluate(() => window.__SS__!.getState().render.character?.gearTier)).toBe(4);
  await expect(page.locator('[data-testid=objective-text]')).toHaveText('');
  await expect(page.locator('[data-testid=mission-tracker]')).toHaveText('');
  await expect(page.locator('[data-testid=objective-tracker]')).toBeHidden();
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/${quality}-4-L8.png` });
});

test('@E29-AC13 @E29-AC17 visible walled follower boards continuously at low quality and zoom 1.5', async ({ page }) => {
  test.setTimeout(300_000); mkdirSync(output, { recursive: true });
  await boot(page, '/?test=1&scenelab=1&renderer=webgl&dpr=1&quality=low&audio=muted&seed=1&ui=1');
  await page.evaluate(async () => {
    const a = window.__SS__!; a.settings.set({ quality: 'low' });
    await a.loadLevel('L7', { seed: 1, progression: 'L7-default' }); a.settings.set({ quality: 'low' });
  });
  expect(await page.evaluate(() => window.__SS__!.getState().render.quality)).toBe('low');
  const initial = await page.evaluate(async () => {
    const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world;
    a.pause(); a.cheats.god(true); a.cheats.killAll(); w.l7Encounters!.state.started = true;
    a.cheats.completeObjective('rocket'); a.cheats.completeObjective('corridor');
    const d = w.l7Departure!, ids = w.l7Encounters!.state.roster.map(r => r.id), last = ids.at(-1)!;
    for (const id of ids.slice(0, -1)) { const e = w.entities.get(id)!; e.hidden = true; e.passengerOf = d.state.busId; d.state.boarded.push(id); }
    a.teleport('player', { x: -70.5, z: 47.5 });
    const follower = w.entities.get(last)!;
    if (!w.solids.relocate(follower, { x: -62, z: 45.8, y: .7 }, 'test.visible-trap', 3)) throw new Error('No clear visible trap position');
    const p = { ...follower.transform };
    for (const [i, [dx, dz, halfX, halfZ]] of [[-1.8, 0, .25, 2], [1.8, 0, .25, 2], [0, -1.8, 2, .25], [0, 1.8, 2, .25]].entries()) {
      const wall = { x: p.x + dx, y: 1.5, z: p.z + dz, halfX, halfY: 1.5, halfZ };
      w.physics.addBlocker(wall); w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 990_000 + i, blocked: true, wall });
    }
    a.camera.follow(); game.view.view.zoom(Math.log(1.5 / game.view.view.getState().targetZoom), true); game.view.advance(0);
    await a.step(1);
    const probe = { last, source: p, maxStep: 0, hideAwayFromDoor: false, relocations: [] as { visible: boolean; distance: number }[], assists: [] as { visible: boolean; tick: number }[] };
    (window as unknown as { continuity: typeof probe }).continuity = probe;
    const relocate = w.solids.relocate.bind(w.solids);
    w.solids.relocate = (...args) => {
      if (args[2] === 'l7.boarding-recovery') probe.relocations.push({ visible: !w.infected!.director.offscreen(args[0].transform, args[0].transform.y - .7), distance: Math.hypot(args[0].transform.x - w.entities.get(1)!.transform.x, args[0].transform.z - w.entities.get(1)!.transform.z) });
      return relocate(...args);
    };
    let previous = { ...follower.transform }, hidden = !!follower.hidden;
    w.events.on('sim.tick', () => {
      if (!hidden) {
        probe.maxStep = Math.max(probe.maxStep, Math.hypot(follower.transform.x - previous.x, follower.transform.z - previous.z));
        if (follower.hidden && Math.hypot(follower.transform.x + 74.4, follower.transform.z - 47) > .1) probe.hideAwayFromDoor = true;
      }
      previous = { ...follower.transform }; hidden = !!follower.hidden;
    }, 10);
    w.events.on('mission.signal', e => {
      if (e.type === 'mission.signal' && e.name === 'l7.survivor-assisted' && e.actorId === last) probe.assists.push({ visible: !w.infected!.director.offscreen(follower.transform), tick: w.tick });
    });
    return { source: p, visible: !w.infected!.director.offscreen(p) };
  });
  expect(initial.visible).toBe(true);
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/low-visible-trap-before.png` });
  let captured = false;
  for (let i = 0; i < 60; i++) {
    await page.evaluate(() => window.__SS__!.step(60));
    const phase = await page.evaluate(() => window.__SS__!.getState().l7Departure);
    if (!captured && phase?.assisting?.length) {
      captured = true; await page.evaluate(() => window.__SS__!.screenshotReady());
      await page.screenshot({ path: `${output}/low-visible-trap-assist.png` });
    }
    if (phase?.phase === 'departing') break;
  }
  const result = await page.evaluate(() => (window as unknown as { continuity: { maxStep: number; hideAwayFromDoor: boolean; relocations: { visible: boolean; distance: number }[]; assists: { visible: boolean; tick: number }[] } }).continuity);
  writeFileSync(`${output}/low-visible-trap.json`, JSON.stringify({ initial, result }, null, 2));
  expect(captured).toBe(true); expect(result.assists).toHaveLength(1); expect(result.assists[0].visible).toBe(true);
  expect(result.relocations.every(r => !r.visible && r.distance > 12)).toBe(true);
  expect(result.maxStep).toBeLessThan(.25); expect(result.hideAwayFromDoor).toBe(false);
  expect(await page.evaluate(() => window.__SS__!.getState().l7Departure?.phase)).toBe('departing');
});
