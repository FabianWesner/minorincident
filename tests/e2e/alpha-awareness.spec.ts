import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

for (const tier of ['high', 'low'] as const) for (const zoom of [.5, 1]) {
  test(`T-E07-06-awareness-browser @E07-AC06 ${tier} z${zoom} proximity turns and roars before chasing`, async ({ page }) => {
    const spec = JSON.parse(readFileSync('tests/scenes/catalog/alpha-awareness-courier.json', 'utf8')) as SceneSpec;
    spec.camera = { mode: 'game', target: [-1, 0], zoom };
    await page.goto(`/?test=1&scenelab&renderer=webgl&quality=${tier}&audio=muted&profile=1&dpr=1`);
    await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    const notice = await page.evaluate(async spec => {
      const api = window.__SS__!, lab = window.__SCENE__!; await api.ready; await lab.load(spec);
      await lab.step(7); await lab.ready();
      const id = lab.actors.get('alpha')!.entity;
      return { id, alpha: api.getState().entities.find(e => e.id === id)!, events: api.events() };
    }, spec);
    expect(notice.alpha.infected!.heardTargetId).toBe(1);
    expect(notice.alpha.infected!.state).toBe('alerted');
    expect(Math.abs(notice.alpha.transform.yaw)).toBeGreaterThan(.5);
    expect(notice.events).toContainEqual(expect.objectContaining({ type: 'telegraph', sourceId: notice.id, special: 'alpha.roar', duration: .6 }));
    expect(notice.events).toContainEqual(expect.objectContaining({ type: 'ai.alerted', targetId: notice.id, sourceId: 1, cause: 'hearing' }));
    await page.evaluate(async () => { await window.__SCENE__!.step(36); });
    const state = await page.evaluate(id => window.__SS__!.getState().entities.find(e => e.id === id)!.infected!.state, notice.id);
    expect(['chase', 'attack']).toContain(state);
  });
}
