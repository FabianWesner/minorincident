import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';

test.use({ launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] } });
for (const webgpu of [false, true]) for (const tier of ['high', 'low'] as const) for (const zoom of [1, .5]) test(`T-E29-16-browser @E29-AC16 @E24-AC14 @E29-AC03 @E29-AC14 ${webgpu ? 'webgpu' : 'webgl2'} ${tier} zoom ${zoom}: entry, real rocket pickup and checkpoint death`, async ({ page }) => {
  test.setTimeout(180_000);
  const out = `test-results/l7-entry/${webgpu ? 'webgpu' : 'webgl2'}-${tier}-z${zoom}`;
  mkdirSync(out, { recursive: true });
  await boot(page, `/?test=1&scenelab=1&ui=1&${webgpu ? 'renderer=webgpu&' : 'renderer=webgl&'}quality=${tier}&audio=muted&dpr=1`);
  await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L6', { seed: 29, progression: 'L6-default' }); a.pause(); a.missions.begin();
    // Fixture starts on the raised exit apron; the full shelter-to-exit input route retains its own acceptance test.
    a.cheats.completeObjective('shelter'); a.cheats.completeObjective('stop'); a.cheats.completeObjective('retreat');
    a.teleport(1, { x: 261, z: 15 });
    a.missions.state()!.l6!.survivors.forEach((r, i) => a.teleport(r.id, { x: 266 + Math.floor(i / 3) * .8, z: 15 + (i % 3 - 1) * .8 }));
    a.camera.cinematic({ position: [285, 32.9, 39], target: [261, 3.9, 15] }, true); await a.step(1);
  });
  const readLighting = () => page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game;
    const light = (game.view as unknown as { lighting: import('../../../src/render/Lighting').Lighting }).lighting;
    const weather = { ...game.world.weather!.snapshot(), snow: game.world.weather!.snow };
    // The two authored weather states have different cloud cover. Compare the
    // rendered key at equal attenuation; retain actual intensity/weather too.
    const attenuation = (1 - weather.clouds * .4) * (1 - weather.snow * .3);
    return { preset: light.preset, actualIntensity: light.intensity.value, weather, key: { intensity: Number((light.intensity.value / attenuation).toFixed(10)), color: light.color.value.toArray(), direction: light.direction.value.toArray(), subwayDarkness: light.subwayDarkness.value, heroSurfaceFill: light.heroSurfaceFill.value } };
  });
  // Keep the underground approach diagnostic separate from the post-trigger exterior key.
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${out}/l6-exit-before-handover.png` });
  const approachLighting = await readLighting();
  await page.keyboard.down('s'); await page.keyboard.down('d'); await page.evaluate(() => window.__SS__!.step(100));
  await page.keyboard.up('s'); await page.keyboard.up('d');
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.phase)).toBe('result');
  const carried = await page.evaluate(() => {
    const a = window.__SS__!, p = a.getEntity(1)!;
    return { ids: a.missions.state()!.result!.escapedSurvivors!.map(e => e.id).sort((a,b) => a-b), weapons: [...p.weapons!.LEFT.rack, ...p.weapons!.RIGHT.rack].map(s => s.id).sort() };
  });
  await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/l6-exit.png` });
  const exitLighting = await readLighting();
  // Read the actual canvas, excluding the DOM result panel, as the Scene Lab CLI does.
  const exitWorld = await page.evaluate(async () => { await window.__SS__!.screenshotReady(); return document.querySelector('canvas')!.toDataURL('image/png'); });
  writeFileSync(`${out}/l6-exit-world.png`, Buffer.from(exitWorld.split(',')[1], 'base64'));

  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForFunction(() => window.__SS__!.getState().scenario === 'L7');
  await page.evaluate(async () => { const a = window.__SS__!; await a.screenshotReady(); a.pause(); a.camera.follow(); });
  const arrived = await page.evaluate(() => { const s = window.__SS__!.getState(); return { ids: s.l7!.roster.map(r => r.id).sort((a,b) => a-b), weapons: [...s.player!.weapons!.LEFT.rack, ...s.player!.weapons!.RIGHT.rack].map(s => s.id).sort() }; });
  expect(arrived).toEqual(carried);
  const entryLighting = await readLighting();
  const entryWorld = await page.evaluate(async () => {
    const a = window.__SS__!; a.camera.cinematic({ position: [285, 32.9, 39], target: [261, 3.9, 15] }, true);
    await a.screenshotReady(); const png = document.querySelector('canvas')!.toDataURL('image/png'); a.camera.follow(); return png;
  });
  writeFileSync(`${out}/l7-entry-world.png`, Buffer.from(entryWorld.split(',')[1], 'base64'));

  writeFileSync(`${out}/handover-lighting.json`, JSON.stringify({ approach: approachLighting, exit: exitLighting, entry: entryLighting }, null, 2));
  expect.soft(entryLighting.key, 'The exterior L6/L7 handover retains the actual night key and darkness').toEqual(exitLighting.key);


  expect(await page.evaluate(() => window.__SS__!.getState().render.backend)).toBe(webgpu ? 'webgpu' : 'webgl');
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('night-exit');
  if (zoom === .5) { await page.mouse.move(800, 450); for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -120); await page.evaluate(() => window.__SS__!.step(1)); } await page.evaluate(() => window.__SS__!.step(30)); }
  await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/night-exit.png` });
  expect(await page.evaluate(() => window.__SS__!.getState().render.camera.zoom)).toBeCloseTo(zoom, 2);
  const initial = await page.evaluate(() => window.__SS__!.getState().l7!.roster);
  await page.evaluate(async () => { const a = window.__SS__!; a.survivor.damage(1000); await a.step(121); });
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('night-exit');
  expect(await page.evaluate(() => window.__SS__!.getState().l7!.roster)).toEqual(initial);
  expect(await page.evaluate(() => window.__SS__!.events(0).some(e => e.type === 'checkpoint.restored' && e.id === 'night-exit'))).toBe(true);
  // Click the real production pickup: device adapters drive the approach and the interaction hold.
  const click = await page.evaluate(() => {
    const a = window.__SS__!, pickup = a.query({}).find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === 'weapon.rocket-launcher')!;
    return a.input.project(pickup.transform);
  });
  await page.mouse.click(click.x, click.y);
  await page.keyboard.down('e');
  for (let i = 0; i < 30 && await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint) !== 'rocket'; i++) await page.evaluate(() => window.__SS__!.step(12));
  await page.keyboard.up('e');
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('rocket');
  await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/rocket.png` });
  for (const checkpoint of ['rocket', 'corridor']) {
    if (checkpoint === 'corridor') {
      const group = await page.evaluate(async () => {
        const a = window.__SS__!, roster = a.getState().l7!.roster;
        // This is a checkpoint/restore fixture, not the full L7 route. Move the
        // living cohort with the courier, matching l7-checkpoints.test.ts: the
        // production corridor checkpoint requires every follower within 18 m.
        for (const [i, r] of roster.entries()) if (r.status === 'following') a.teleport(r.id, { x: -23 + Math.floor(i / 4), z: 46 + i % 4 });
        a.teleport(1, { x: -30, z: 47 }); await a.step(1);
        const p = a.getEntity(1)!.transform;
        return roster.filter(r => r.status === 'following').map(r => { const t = a.getEntity(r.id)!.transform; return { id: r.id, distance: Math.hypot(t.x - p.x, t.z - p.z) }; });
      });
      for (const member of group) expect(member.distance, `corridor fixture follower ${member.id}`).toBeLessThanOrEqual(18);
    }
    const before = await page.evaluate(() => { const s = window.__SS__!.getState(); return { roster: s.l7!.roster, bus: s.l7Departure, weapons: s.player!.weapons, checkpoint: window.__SS__!.missions.state()!.checkpoint }; });
    expect(before.checkpoint).toBe(checkpoint);
    await page.evaluate(async () => { const a = window.__SS__!; await a.step(121); a.survivor.damage(1000); await a.step(121); });
    const after = await page.evaluate(() => window.__SS__!.getState());
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe(checkpoint); expect(after.player!.health.current).toBeGreaterThan(0);
    expect(after.l7!.roster).toEqual(before.roster);
    expect(after.l7Departure!.busId).toBe(before.bus!.busId); expect(after.l7Departure!.boarded).toEqual(before.bus!.boarded);
    expect(after.player!.weapons!.RIGHT.rack.map(s => s.id)).toEqual(before.weapons!.RIGHT.rack.map(s => s.id));
    await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/${checkpoint}-retry.png` });
  }
  writeFileSync(`${out}/state.json`, JSON.stringify(await page.evaluate(() => ({ state: window.__SS__!.getState(), events: window.__SS__!.events(0), perf: window.__SS__!.perf() })), null, 2));
});
