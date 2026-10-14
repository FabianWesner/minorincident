import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import { readSpec } from '../../tools/scenelab/session';

for (const tier of ['high', 'low'] as const) for (const zoom of [1, .5]) test(`T-E32-09-scale-${tier}-${zoom} @E32 @E32-AC09 regular Alpha and Mega keep distinct live models and bars at the game camera`, async ({ page }) => {
  test.setTimeout(120_000);
  const spec = readSpec('tests/scenes/catalog/l10-alpha-scale.json');
  await page.goto(`/?test=1&scenelab&renderer=webgl&quality=${tier}&audio=muted&profile=1&dpr=1`);
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  const proof = await page.evaluate(async ({ spec, zoom }) => {
    const api = window.__SS__!, lab = window.__SCENE__!; await api.ready;
    await lab.load({ ...spec, camera: { ...spec.camera!, zoom } as typeof spec.camera }); await lab.step(1); await lab.ready();
    return { state: api.getState(), perf: api.perf() };
  }, { spec, zoom });
  const alphas = proof.state.entities.filter(e => e.archetype === 'infected.alpha');
  expect(alphas).toHaveLength(2);
  const regular = alphas.find(e => !e.infected!.pursuit)!, mega = alphas.find(e => e.infected!.pursuit)!;
  expect(mega.infected!.variant).toBe('inf.mega-alpha');
  const bars = proof.state.render.healthBars!;
  const regularBar = bars.bars.find(b => b.id === regular.id)!, megaBar = bars.bars.find(b => b.id === mega.id)!;
  expect(regularBar).toBeDefined(); expect(megaBar).toBeDefined();
  expect(megaBar.width).toBe(regularBar.width * 1.5); expect(megaBar.height).toBeGreaterThan(regularBar.height);
  expect(bars.draws).toBe(3);
  expect(megaBar.y - megaBar.height / 2 - 2).toBeGreaterThanOrEqual(0);
  const batches = proof.state.render.crowd!.batches;
  for (const model of ['inf.alpha', 'inf.mega-alpha']) expect(batches.some(b => b.id === model && b.instances > 0 && b.source === 'glb')).toBe(true);
  mkdirSync('test-results/epics/E32/l10-alpha-contracts', { recursive: true });
  writeFileSync(`test-results/epics/E32/l10-alpha-contracts/scale-${tier}-${zoom}.json`, JSON.stringify(proof, null, 2));
});
