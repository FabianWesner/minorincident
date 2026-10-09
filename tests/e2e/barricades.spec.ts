import { boot, expect, test } from './fixtures';

test('T-E26-02-browser @E26-AC02 sleeping prop-yard has zero matrix updates after settling', async ({ page }) => {
  await boot(page); const result = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('prop-yard'); a.pause(); await a.step(60); await a.screenshotReady(); return { perf: a.perf(), count: a.getState().entities.filter(e => e.kind === 'physics-prop').length };
  });
  expect(result.count).toBe(300); expect(result.perf.awakeProps).toBe(0); expect(result.perf.propUploads).toBe(0);
});
test('T-E26-16-browser @E26 @E26-AC16 core browser wiring builds, repairs and breaks a real barricade', async ({ page }) => {
  await boot(page); await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('barricade-lab'); a.pause(); a.teleport('player', { x: 0, z: 1.3 }); await a.step(90); await a.screenshotReady();
  });
  expect(await page.evaluate(() => window.__SS__!.barricades.intact('door'))).toBe(true);
  await page.locator('canvas').screenshot({ path: 'test-results/epics/E26/barricade-braced.png' });
  await page.evaluate(async () => { const a = window.__SS__!, id = a.barricades.slots().find(s => s.state.slot.id === 'door')!.id; a.interact.hit(id, 150, 'bullet'); await a.step(120); await a.screenshotReady(); });
  const hp = await page.evaluate(() => window.__SS__!.getState().entities.find(e => e.barricade?.slot.id === 'door')!.health.current); expect(hp).toBe(162.5);
  await page.locator('canvas').screenshot({ path: 'test-results/epics/E26/barricade-damaged.png' });
  await page.evaluate(async () => { const a = window.__SS__!, id = a.barricades.slots().find(s => s.state.slot.id === 'door')!.id; a.interact.hit(id, 1000, 'bullet'); await a.step(6); await a.screenshotReady(); });
  expect(await page.evaluate(() => window.__SS__!.barricades.intact('door'))).toBe(false);
  await page.locator('canvas').screenshot({ path: 'test-results/epics/E26/barricade-break.png' });
});


test('T-E26-15-browser @E26 @E26-AC15 Node and browser match the 60s physics tape hash', async ({ page }) => {
  const { SimWorld } = await import('../../src/sim/world/SimWorld');
  const { stateHash } = await import('../../src/sim/world/stateHash');
  const { propSequence } = await import('../../src/debug/scenarios/propSequence');
  const w = new SimWorld(); await w.init(); w.loadScenario('prop-yard'); w.combat!.damage.god = true;
  propSequence(w); const expected = stateHash(w.getState()); w.dispose();
  await boot(page);
  const result = await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('prop-yard'); a.pause(); a.cheats.god(true); const hash = a.physicsProps.scriptedSequence(); return { hash, tick: a.tick() }; });
  expect(result.tick).toBe(3600); expect(result.hash).toBe(expected);
});
