import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, boot } from '../e2e/fixtures';
import { PNG } from 'pngjs';
import { infectedDefinitions } from '../../src/data/infected';
const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { id: string; status: string }[];
test('T-E07-12 @E07 @E07-AC12 @perf 200 infected render in fixed scene graph and at most 30 crowd draws', async ({ page }) => {
  mkdirSync('test-results/epics/E07', { recursive: true });
  await boot(page); await page.evaluate(async () => {
    const api = window.__SS__!; await api.loadScenario('horde-arena'); api.pause(); api.cheats.god(true);
    for (let i = 0; i < 200; i++) api.spawn('infected.runner', { x: i % 20 * 0.8 - 8, z: Math.floor(i / 20) * 0.8 - 4 }, { state: 'chase' });
    await api.step(0); await api.screenshotReady();
  });
  const proof = await page.evaluate(() => ({ ai: window.__SS__!.getState().ai!, crowd: window.__SS__!.getState().render.crowd!, perf: window.__SS__!.perf() }));
  const runners = proof.crowd.batches.filter((b) => b.id === 'infected.runner');
  if (manifest.find((asset) => asset.id === 'inf.common-worker')!.status === 'integrated') expect(runners.every(batch => batch.source === 'glb')).toBe(true);
  expect(proof.ai.count).toBe(200);
  const rendered = runners.reduce((sum, batch) => sum + batch.instances, 0);
  expect(rendered).toBeGreaterThan(0); expect(rendered).toBeLessThan(200);
  expect(runners.find(batch => batch.lod === 'lod0')!.instances).toBe(8); // Offscreen instances are culled; simulation keeps all 200. expect(proof.crowd.meshDrawCalls).toBeLessThanOrEqual(30); expect(proof.crowd.nonInstancedMeshes).toBe(0); expect(proof.crowd.objects).toBe(proof.crowd.batches.length + 4);
  mkdirSync('test-results/epics/E07', { recursive: true }); writeFileSync('test-results/epics/E07/render-perf.json', JSON.stringify(proof, null, 2) + '\n');
  await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/horde-200.png' });
  // Remove all infected and compare actual renderer draws, including fixed crowd shadow/telegraph batches.
  const before = proof.perf.drawCalls; const after = await page.evaluate(async () => { const api = window.__SS__!; api.cheats.killAll(); await api.step(2762); await api.screenshotReady(); return api.perf().drawCalls; }); expect(before - after).toBeGreaterThan(0); expect(before - after).toBeLessThanOrEqual(30); writeFileSync('test-results/epics/E07/render-perf.json', JSON.stringify({ ...proof, removedDrawCalls: after, crowdDrawDelta: before - after }, null, 2) + '\n');
  const roles = infectedDefinitions.filter((def) => def.id !== 'infected.crow').map((def) => def.id);
  const mixed = await page.evaluate(async (roles) => {
    const api = window.__SS__!;
    for (let i = 0; i < 190; i++) api.spawn(roles[i % roles.length], { x: i % 20 * 1.2 - 12, z: Math.floor(i / 20) * 1.2 - 6 }, { state: 'idle', perched: false });
    api.spawn('infected.crow', { x: -8, z: -4 }); api.spawn('infected.crow', { x: 8, z: -4 });
    await api.step(0); await api.screenshotReady(); return api.getState();
  }, roles);
  expect(mixed.ai!.count).toBe(200); expect(mixed.render.crowd!.meshDrawCalls).toBeLessThanOrEqual(30); expect(mixed.render.crowd!.objects).toBe(proof.crowd.objects); expect(mixed.render.crowd!.nonInstancedMeshes).toBe(0);
  await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/horde-archetypes.png' });
  writeFileSync('test-results/epics/E07/mixed-render.json', JSON.stringify(mixed.render.crowd, null, 2) + '\n');
});
test('T-E07-13 @E07 @E07-AC13 @vision golden-hour street has 60 separable runners glowing eyes and an identifiable player', async ({ page }) => {
  mkdirSync('test-results/epics/E07', { recursive: true });
  await boot(page); await page.evaluate(async () => {
    const api = window.__SS__!; await api.loadScenario('horde-readability'); api.pause();
    for (let i = 0; i < 60; i++) api.spawn('infected.runner', { x: i % 6 * 0.9 - 2.3, z: Math.floor(i / 6) * 1.2 - 14 }, { state: 'idle', yaw: -Math.PI / 4 });
    api.spawn('weapon.bat', { x: -3, z: 3 }); api.spawn('weapon.grenade', { x: 2, z: 5 });
    api.camera.preset('horde-readability'); api.settings.set({ timeOfDay: 'golden', bloom: true }); await api.step(0); await api.screenshotReady();
  });
  const image = await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/horde-readability.png' }), pixels = PNG.sync.read(image);
  let eyePixels = 0, redPixels = 0;
  for (let i = 0; i < pixels.data.length; i += 4) { const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2]; if (r > 200 && r > g * 1.8 && r > b * 1.8) eyePixels++; if (r > 110 && r > g * 1.4 && r > b * 1.2) redPixels++; }
  expect(eyePixels).toBeGreaterThan(40); expect(redPixels).toBeGreaterThan(200);
  const state = await page.evaluate(() => window.__SS__!.getState()); expect(state.ai!.count).toBe(60); const visibleRunners = state.render.crowd!.batches.filter((b) => b.id === 'infected.runner').reduce((sum, batch) => sum + batch.instances, 0); expect(visibleRunners).toBeGreaterThan(0); expect(visibleRunners).toBeLessThanOrEqual(60); expect(state.render.lighting!.preset).toBe('golden');
  await page.evaluate(async () => { window.__SS__!.settings.set({ idPass: true }); await window.__SS__!.screenshotReady(); });
  const mask = PNG.sync.read(await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/player-mask.png' }));
  let heroPixels = 0; for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) heroPixels++;
  expect(heroPixels).toBeGreaterThan(1000);
  await page.evaluate(async () => { const api = window.__SS__!; api.settings.set({ idPass: false }); api.spawn('infected.brute', { x: -2, z: -2 }, { state: 'chase' }); api.spawn('infected.runner', { x: -1.5, z: 1 }, { state: 'chase' }); await api.step(1); await api.screenshotReady(); });
  await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/telegraphs.png' });
  const burst = await page.evaluate(async () => {
    const api = window.__SS__!; api.spawn('infected.bloated', { x: 3, z: 0 }, { state: 'idle' }); api.cheats.killAll(); await api.step(1); await api.screenshotReady(); return api.getState();
  });
  expect(burst.render.crowd!.meshDrawCalls).toBeLessThanOrEqual(7); // Three corpse archetypes can each occupy two LODs, plus one explosion telegraph.
  await page.locator('canvas').screenshot({ path: 'test-results/epics/E07/bloated-windup.png' });
  writeFileSync('test-results/epics/E07/readability.json', JSON.stringify({ eyePixels, redPixels, heroPixels, crowd: state.render.crowd, lighting: state.render.lighting }, null, 2) + '\n');
});
