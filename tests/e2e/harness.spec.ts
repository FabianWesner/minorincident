import { SimWorld } from '../../src/sim/world/SimWorld';
import { mkdirSync, writeFileSync } from 'node:fs';
import { stateHash } from '../../src/sim/world/stateHash';
import { scriptedInput } from '../fixtures/inputScript';
import { attachErrorGuard, boot, expect, test } from './fixtures';

function artifact(name: string, data: unknown): void {
  mkdirSync('test-results/epics/E01', { recursive: true });
  writeFileSync(`test-results/epics/E01/${name}.json`, JSON.stringify(data, null, 2) + '\n');
}

test('T-E01-04b @E01 @E01-AC04 browser and Node match after 3600 scripted ticks', async ({ page }) => {
  const world = new SimWorld(); await world.init(); world.loadScenario('empty', 1);
  try {
    for (let tick = 0; tick < 3600; tick++) { world.setInput(scriptedInput(tick)); world.update(); }
    await boot(page);
    const script = Array.from({ length: 60 }, (_, i) => scriptedInput(i * 60));
    const browserState = await page.evaluate(async (frames) => {
      const api = window.__SS__!; await api.loadScenario('empty', { seed: 1 }); api.pause();
      for (const frame of frames) { api.input.set(frame); await api.step(60); }
      return api.getState();
    }, script);
    expect(stateHash(browserState)).toBe(stateHash(world.getState()));
    const { render, ...simState } = browserState;
    expect(render.backend).toBe('webgl'); expect(simState).toEqual(world.getState());
    artifact('determinism', { ticks: 3600, seed: 1, nodeHash: stateHash(world.getState()), browserHash: stateHash(browserState) });
  } finally { world.dispose(); }
});

test('T-E01-05 @E01 @E01-AC05 API query gate, semver, every contract method and epic stubs', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (request) => { if (request.resourceType() === 'script') scripts.push(request.url()); });
  await page.goto('/?renderer=webgl');
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => typeof window.__SS__)).toBe('undefined');
  expect(scripts.some((url) => /testApi|Debug/.test(url))).toBe(false);
  await boot(page);
  const surface = await page.evaluate(async () => {
    const api = window.__SS__!;
    const errors: Record<string, string> = {};
    const stubs: [string, () => unknown][] = [
      ['loadLevel', () => api.loadLevel('L1')], ['spawn', () => api.spawn('infected.stub', { x: 0, z: 0 })],
      ['cheats.killAll', () => api.cheats.killAll()], ['cheats.completeObjective', () => api.cheats.completeObjective()],
      ['bot.start', () => api.bot.start()], ['bot.stop', () => api.bot.stop()], ['bot.status', () => api.bot.status()],
    ];
    for (const [name, call] of stubs) { try { await call(); errors[name] = 'NO ERROR'; } catch (error) { errors[name] = (error as Error).message; } }
    api.teleport('player', { x: 2, z: 3 });
    const entity = api.getEntity(1), missing = api.getEntity(999), nearby = api.query({ kind: 'player', archetype: 'player.stub', within: { x: 2, z: 3, r: 1 } });
    api.input.set({ move: { x: 1, z: 0 } }); api.input.clear(); await api.step(1);
    await api.screenshotReady();
    return { version: api.version, keys: Object.keys(api).sort(), vfxKeys: Object.keys(api.vfx).sort(), errors, entity, missing, nearby, events: api.events(0), perf: api.perf() };
  });
  expect(surface.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(surface.keys).toEqual(['version', 'ready', 'pause', 'resume', 'step', 'setTimeScale', 'tick', 'loadLevel', 'loadScenario', 'unloadScenario', 'getState', 'getEntity', 'query', 'events', 'input', 'spawn', 'teleport', 'survivor', 'setLoadout', 'cheats', 'bot', 'camera', 'settings', 'vfx', 'perf', 'screenshotReady'].sort());
  expect(surface.vfxKeys).toEqual(['emit', 'stepRender']);
  const epics: Record<string, string> = { loadLevel: 'E12', spawn: 'E07', 'cheats.killAll': 'E07', 'cheats.completeObjective': 'E12', 'bot.start': 'E19', 'bot.stop': 'E19', 'bot.status': 'E19' };
  for (const [name, epic] of Object.entries(epics)) expect(surface.errors[name]).toBe(`NotImplemented ${epic}: ${name}`);
  expect(surface.entity?.transform).toMatchObject({ x: 2, z: 3 }); expect(surface.missing).toBeNull(); expect(surface.nearby).toHaveLength(1);
  expect(surface.events).toContainEqual({ tick: 1, type: 'sim.tick' }); expect(surface.perf.entities).toBe(1);
});

test('T-E01-06 @E01 @E01-AC06 pause + exact step and 10x sim time within 2%', async ({ page }) => {
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await boot(page);
  await page.evaluate(async () => { const api = window.__SS__!; await api.step(17); await api.step(23); });
  expect(await page.evaluate(() => window.__SS__!.tick())).toBe(40);
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => window.__SS__!.tick())).toBe(40);
  await page.evaluate(() => { window.__SS__!.setTimeScale(1); window.__SS__!.resume(); });
  await page.clock.runFor(2000);
  const normal = await page.evaluate(() => { const api = window.__SS__!; api.pause(); return api.tick() - 40; });
  await page.evaluate(() => { window.__SS__!.setTimeScale(10); window.__SS__!.resume(); });
  await page.clock.runFor(2000);
  const fast = await page.evaluate((start) => { const api = window.__SS__!; api.pause(); return api.tick() - start; }, normal + 40);
  expect(normal).toBeGreaterThanOrEqual(119);
  expect(fast / normal).toBeGreaterThanOrEqual(9.8); expect(fast / normal).toBeLessThanOrEqual(10.2);
  expect(Math.abs(fast - 1200) / 1200).toBeLessThanOrEqual(0.02);
  artifact('time-scale', { realMs: 2000, normalTicks: normal, fastTicks: fast, ratio: fast / normal });
});

test('T-E01-07 @E01 @E01-AC07 load/unload x20 returns all resources to baseline', async ({ page }) => {
  await boot(page);
  const data = await page.evaluate(async () => {
    const api = window.__SS__!;
    await api.unloadScenario(); await api.screenshotReady();
    const baseline = { ...api.getState().perf, geometries: api.perf().geometries, textures: api.perf().textures };
    const cycles = [];
    for (let i = 0; i < 20; i++) {
      await api.loadScenario('empty', { seed: i }); api.pause(); await api.step(5); await api.screenshotReady();
      if (api.getState().perf.entities !== 1 || api.getState().perf.bodies !== 2) throw new Error('Scenario was not loaded');
      await api.unloadScenario(); await api.screenshotReady();
      cycles.push({ ...api.getState().perf, geometries: api.perf().geometries, textures: api.perf().textures });
    }
    return { baseline, cycles };
  });
  expect(data.baseline.entities).toBe(0); expect(data.baseline.bodies).toBe(0); expect(data.baseline.listeners).toBe(0);
  for (const cycle of data.cycles) expect(cycle).toEqual(data.baseline);
  artifact('lifecycle', data);
});

test('T-E01-10 @E01 @E01-AC10 guard detects errors and uncaught exceptions', async ({ browser }) => {
  // A separate page tests the guard without emitting expected errors on the guarded app page.
  const page = await browser.newPage();
  const guard = attachErrorGuard(page);
  try {
    await page.goto('about:blank');
    await page.evaluate(() => { console.error('guard-probe'); setTimeout(() => { throw new Error('uncaught-probe'); }, 0); });
    await expect.poll(() => guard.errors.length).toBe(2);
    expect(guard.errors).toContain('console.error: guard-probe'); expect(guard.errors).toContain('pageerror: uncaught-probe');
  } finally { guard.dispose(); await page.close(); }
});
