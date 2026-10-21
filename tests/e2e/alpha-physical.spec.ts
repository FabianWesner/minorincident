import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  for (const move of ['charge', 'ground-slam'] as const) test(`T-E07-06-${move}-${viewport.width} @E07-AC05 @E07-AC06 real Scene Lab telegraph, impact and hurt`, async ({ page }) => {
    test.setTimeout(120_000); await page.setViewportSize(viewport);
    const spec = JSON.parse(readFileSync(`tests/scenes/alpha-s2/qa-alpha-${move}.json`, 'utf8')) as SceneSpec;
    await page.goto('/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&profile=1&dpr=1');
    await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    const windup = move === 'charge' ? 48 : 60;
    const before = await page.evaluate(async ({ spec, windup }) => {
      const lab = window.__SCENE__!, api = window.__SS__!; await api.ready; await lab.load(spec); await lab.step(windup - 1); await lab.ready();
      const id = lab.actors.get('alpha')!.entity;
      return { source: api.getEntity(id)!, player: api.getEntity(1)!, telegraph: api.events().find(ev => ev.type === 'telegraph' && ev.sourceId === id), figures: api.crowdFigures().filter(f => f.id === id), markers: api.getState().render.vfx?.telegraphs };
    }, { spec, windup });
    expect(before.source.infected!.specialAttack!.stage).toBe('telegraph'); expect(before.player.health.current).toBe(100);
    expect(before.telegraph).toMatchObject({ move: `alpha.${move}`, duration: windup / 60, area: { radius: move === 'charge' ? 1 : 4 } });
    expect(before.markers).toHaveLength(1);
    expect(before.figures).toHaveLength(1); expect(before.figures[0].drawn).toBe(true);
    const impact = await page.evaluate(async () => {
      const lab = window.__SCENE__!, api = window.__SS__!; await lab.step(43); await lab.ready();
      const id = lab.actors.get('alpha')!.entity;
      return { source: api.getEntity(id)!, player: api.getEntity(1)!, events: api.events(), perf: api.perf(), crowd: api.getState().render.crowd };
    });
    expect(impact.player.health.current).toBe(move === 'charge' ? 70 : 75);
    expect(impact.player.survivor?.knockdown).toBeDefined(); expect(['knockdown', 'get-up']).toContain(impact.player.survivor!.animation);
    expect(impact.events.filter(ev => ev.type === 'combat.hit' && ev.targetId === 1 && ev.actionId === `alpha.${move}`)).toHaveLength(1);
    if (move === 'charge') expect(impact.events.some(ev => ev.type === 'barricade.damaged' && ev.amount === 300 && ev.hp === 0 && ev.slotId === 'line')).toBe(true);
    expect(impact.crowd?.nonInstancedMeshes).toBe(0); expect(impact.perf.drawCalls).toBeLessThanOrEqual(600); expect(impact.perf.triangles).toBeLessThanOrEqual(1_500_000);
  });
}
for (const quality of ['high', 'low'] as const) test(`T-E07-physical-budget-${quality} @E18-AC01 @perf pooled physical markers and bars within E18 mixed horde`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/?test=1&scenelab&renderer=webgl&quality=${quality}&audio=muted&profile=1&dpr=1`);
  await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
  const proof = await page.evaluate(async quality => {
    const api = window.__SS__!, lab = window.__SCENE__!; await api.ready;
    const count = quality === 'high' ? 200 : 100;
    await lab.load({ name: 'alpha-physical-horde', infectedCap: 200, ground: 'asphalt', size: 40, time: 'L4', dof: false,
      actors: [{ id: 'courier', kind: 'courier', at: [0, 0], god: true },
        ...Array.from({ length: count - 6 }, (_, i) => ({ id: `runner-${i}`, kind: 'infected' as const, archetype: 'infected.runner', at: [i % 20 - 10, Math.floor(i / 20) - 12] as [number, number], state: 'chase' as const })),
        ...Array.from({ length: 6 }, (_, i) => ({ id: `alpha-${i}`, kind: 'infected' as const, archetype: 'infected.alpha', at: [i - 3, -5] as [number, number], state: 'idle' as const }))] });
    for (let i = 0; i < 6; i++) lab.command(`alpha-${i}`, { special: i % 2 ? 'alpha.charge' : 'alpha.ground-slam', target: 'courier' });
    api.camera.preset('perf-horde'); await api.step(1); await api.screenshotReady();
    return { count: api.getState().ai!.count, drawn: api.crowdFigures().filter(figure => figure.drawn).length, perf: api.perf(), crowd: api.getState().render.crowd, markers: api.getState().render.vfx?.telegraphs };
  }, quality);
  expect(proof.markers).toHaveLength(6);
  expect(proof.count).toBe(quality === 'high' ? 200 : 100); expect(proof.crowd?.meshDrawCalls).toBeLessThanOrEqual(30);
  expect(proof.drawn).toBe(proof.count);
  expect(proof.perf.drawCalls).toBeLessThanOrEqual(quality === 'high' ? 600 : 300);
  expect(proof.perf.triangles).toBeLessThanOrEqual(quality === 'high' ? 1_500_000 : 500_000);
  mkdirSync('test-results/alpha-s2', { recursive: true }); writeFileSync(`test-results/alpha-s2/render-${quality}.json`, JSON.stringify(proof, null, 2));
});
