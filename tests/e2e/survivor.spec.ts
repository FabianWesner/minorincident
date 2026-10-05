import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from './fixtures';

test('T-E04-09 @E04 @E04-AC09 sixty-second input bot visits every sim clip with zero missing mappings', async ({ page }) => {
  test.setTimeout(120_000); await boot(page);
  const result = await page.evaluate(async () => {
    const api = window.__SS__!; await api.loadScenario('survivor', { seed: 1 }); api.pause();
    const seen = new Set<string>(); let mismatches = 0;
    const observe = () => { const s = api.getState(); seen.add(s.player!.survivor!.animation); if (s.render.character!.animation !== s.player!.survivor!.animation) mismatches++; };
    observe();
    const actions = ['swing', 'shoot', 'throw', 'kick', 'interact', 'enter-car'] as const;
    for (let tick = 0; tick < 3600; tick += 12) {
      const cycle = tick % 600;
      api.input.set({ move: cycle < 120 ? { x: 0.3, z: 0 } : cycle < 240 ? { x: -1, z: 0 } : { x: 0, z: 0 } });
      if (cycle === 252) api.survivor.act(actions[Math.floor(tick / 600)]);
      if (cycle === 360) api.survivor.damage(5);
      if (cycle === 432) api.survivor.damage(100);
      observe(); await api.step(12); observe();
    }
    api.input.clear(); await api.step(12); observe();
    return { seen: [...seen], mismatches, tick: api.tick(), character: api.getState().render.character, perf: api.perf() };
  });
  mkdirSync('test-results/epics/E04', { recursive: true }); writeFileSync('test-results/epics/E04/animation-bot.json', JSON.stringify(result, null, 2));
  expect(result.tick).toBeGreaterThanOrEqual(3600); expect(result.mismatches).toBe(0); expect(result.character!.missingClips).toBe(0);
  expect(result.seen.sort()).toEqual(['idle', 'walk', 'run', 'hurt', 'die', 'swing', 'shoot', 'throw', 'kick', 'interact', 'enter-car'].sort());
  expect(result.character!.sources.every((s) => s.source === 'glb')).toBe(true);
});

test('T-E04-wiring @E04 actual keyboard input moves the survivor; variant selection is cosmetic and unload frees resources', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { await window.__SS__!.loadScenario('survivor'); window.__SS__!.pause(); });
  const start = await page.evaluate(() => window.__SS__!.getState());
  await page.keyboard.down('KeyW'); await page.evaluate(() => window.__SS__!.step(30)); await page.keyboard.up('KeyW');
  const moving = await page.evaluate(() => window.__SS__!.getState());
  expect(Math.hypot(moving.player!.transform.x - start.player!.transform.x, moving.player!.transform.z - start.player!.transform.z)).toBeGreaterThan(1);
  await page.evaluate(() => window.__SS__!.survivor.select('male', 4));
  const male = await page.evaluate(() => window.__SS__!.getState());
  expect(male.render.character!.variant).toBe('male'); expect(male.render.character!.gearTier).toBe(4);
  expect(male.player!.health).toEqual(moving.player!.health); expect(male.player!.transform).toEqual(moving.player!.transform);
  await page.evaluate(() => window.__SS__!.unloadScenario());
  const unloaded = await page.evaluate(() => ({ state: window.__SS__!.getState(), perf: window.__SS__!.perf() }));
  expect(unloaded.state.perf).toEqual({ entities: 0, bodies: 0, colliders: 0, listeners: 0 }); expect(unloaded.state.render.character).toBeNull();
  // Three retains one fullscreen shadow-pass geometry as a shared renderer cache.
  expect(unloaded.perf.geometries).toBeLessThanOrEqual(1);
  const cycles = await page.evaluate(async () => {
    const api = window.__SS__!, result = [];
    for (let i = 0; i < 3; i++) { await api.loadScenario('survivor'); api.pause(); await api.step(5); await api.unloadScenario(); result.push(api.perf()); }
    return result;
  });
  for (const cycle of cycles) { expect(cycle.geometries).toBe(unloaded.perf.geometries); expect(cycle.textures).toBe(unloaded.perf.textures); }
});
