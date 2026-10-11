import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '../e2e/fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

for (const tier of ['high', 'low'] as const) test(`T-E07-06-alpha-support-${tier} @E18-AC01 @perf mixed horde with live roar telegraphs and buffs stays within counters`, async ({ page }) => {
  test.setTimeout(120_000);
  const count = tier === 'high' ? 200 : 100;
  const spec: SceneSpec = {
    name: `alpha-support-horde-${tier}`, seed: 37, ground: 'asphalt', size: 64, time: 'L4', dof: false, infectedCap: 200,
    actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }, { id: 'regular', kind: 'infected', archetype: 'infected.runner', count: count - 6, spread: 12, at: [0, 0], state: 'idle' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `alpha-${i}`, kind: 'infected' as const, archetype: 'infected.alpha', at: [6, (i - 3) * 2] as [number, number], yaw: 180, state: 'idle' as const }))],
    script: Array.from({ length: 6 }, (_, i) => ({ frame: 10, actor: `alpha-${i}`, do: { special: 'alpha.roar' as const, target: 'courier' } })),
    camera: { mode: 'game', target: [0, 0], zoom: 2 }, trace: false,
  };
  await page.goto(`/?test=1&scenelab&renderer=webgl&quality=${tier}&audio=muted&profile=1&dpr=1`);
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  const proof = await page.evaluate(async spec => {
    const api = window.__SS__!, lab = window.__SCENE__!; await api.ready; await lab.load(spec); api.cheats.god(true);
    await lab.step(30); await lab.ready(); const telegraph = { perf: api.perf(), state: api.getState() };
    await lab.step(30); await lab.ready(); const active = { perf: api.perf(), state: api.getState() };
    return { telegraph, active };
  }, spec);
  expect(proof.telegraph.state.ai!.count).toBe(count); expect(proof.active.state.ai!.count).toBe(count);
  expect(proof.telegraph.state.render.vfx!.telegraphs.length).toBeGreaterThanOrEqual(6);
  expect(proof.active.state.entities.filter(e => e.infected?.roar).length).toBeGreaterThan(0);
  for (const stage of [proof.telegraph, proof.active]) {
    expect(stage.perf.drawCalls).toBeLessThanOrEqual(tier === 'high' ? 600 : 300);
    expect(stage.perf.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
    expect(stage.state.render.crowd!.meshDrawCalls).toBeLessThanOrEqual(30); expect(stage.state.render.crowd!.nonInstancedMeshes).toBe(0);
  }
  mkdirSync('test-results/alpha-s3/perf', { recursive: true });
  writeFileSync(`test-results/alpha-s3/perf/render-${tier}.json`, JSON.stringify(proof, null, 2));
});
