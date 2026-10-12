import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
test.use({ viewport: { width: 1280, height: 720 } });
for (const lod of [0, 1, 2]) test(`T-E07-01-elephant-camera-${lod} @E07-AC01 elephant comparison uses actual production assets`, async ({ page }) => {
  test.setTimeout(120_000);
  const spec = JSON.parse(readFileSync(`tests/scenes/elephant-asset/lod${lod}.json`, 'utf8')) as SceneSpec;
  await page.goto('/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&profile=1&dpr=1');
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  await page.evaluate(async s => { await window.__SS__!.ready; await window.__SCENE__!.load(s); await window.__SCENE__!.step(30); await window.__SCENE__!.ready(); }, spec);
  const proof = await page.evaluate(() => {
    const lab = window.__SCENE__!, api = window.__SS__!;
    const ids = ['elephant', 'lion', 'gorilla'].map(name => lab.actors.get(name)!.entity);
    return { figures: api.crowdFigures().filter(f => ids.includes(f.id)), render: api.getState().render.crowd, perf: api.perf() };
  });
  expect(proof.figures).toHaveLength(3);
  expect(proof.figures.every(f => f.drawn)).toBe(true);
  expect(proof.render?.batches.find(b => b.id === 'inf.elephant' && b.instances > 0)?.source).toBe('glb');
  expect(proof.render?.nonInstancedMeshes).toBe(0);
  expect(proof.perf.drawCalls).toBeLessThanOrEqual(600);
  expect(proof.perf.triangles).toBeLessThanOrEqual(1_500_000);
});
for (const quality of ['high', 'low'] as const) test(`T-E07-12-elephant-assets @E07-AC12 @E18-AC01 ${quality} mixed elephant/lion/gorilla crowd stays within E18 counters`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/?test=1&renderer=webgl&quality=${quality}&audio=muted&profile=1&dpr=1`);
  await page.waitForFunction(() => !!window.__SS__);
  const proof = await page.evaluate(async tier => {
    const api = window.__SS__!; await api.ready; await api.loadScenario('horde-arena'); api.pause(); api.cheats.god(true);
    const count = tier === 'high' ? 200 : 100;
    for (let i = 0; i < count; i++) api.spawn('infected.runner', { x: (i % 20) * .8 - 8, z: Math.floor(i / 20) * .8 - 12 },
      { state: 'chase', variant: i < 4 ? 'inf.elephant' : i < 7 ? 'infected.lion' : i < 10 ? 'infected.gorilla' : 'inf.common-worker' });
    api.camera.preset('perf-horde'); await api.step(120); await api.screenshotReady();
    return { count: api.getState().ai!.count, crowd: api.getState().render.crowd, perf: api.perf() };
  }, quality);
  expect(proof.count).toBe(quality === 'high' ? 200 : 100);
  expect(proof.crowd?.batches.filter(b => b.id === 'inf.elephant').reduce((n, b) => n + b.instances, 0)).toBe(4);
  expect(proof.crowd?.nonInstancedMeshes).toBe(0);
  expect(proof.crowd?.meshDrawCalls).toBeLessThanOrEqual(30);
  expect(proof.perf.drawCalls).toBeLessThanOrEqual(quality === 'high' ? 600 : 300);
  expect(proof.perf.triangles).toBeLessThanOrEqual(quality === 'high' ? 1_500_000 : 500_000);
  console.log(JSON.stringify({ quality, count: proof.count, drawCalls: proof.perf.drawCalls, triangles: proof.perf.triangles, crowdDrawCalls: proof.crowd?.meshDrawCalls, perf: proof.perf }));
});
