import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
for (const tier of ['high', 'low'] as const) for (const species of ['lion', 'gorilla', 'elephant', 'zebra', 'flamingo']) {
  test(`T-E30-09-${species}-${tier}-browser @E30-AC09 @E30-AC15 same drawn entity turns from healthy/barless to infected/shared bar`, async ({ page }) => {
    test.setTimeout(120000);
    if (tier === 'low') await page.setViewportSize({ width: 390, height: 844 });
    const spec = JSON.parse(readFileSync(`tests/scenes/l8-systems/${species}.json`, 'utf8')) as SceneSpec;
    if (tier === 'low') spec.camera = { mode: 'game', target: 'animal', zoom: species === 'elephant' ? 1.3 : 1 };
    await page.goto(`/?test=1&scenelab&renderer=webgl&quality=${tier}&audio=muted&dpr=1`);
    await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    await page.evaluate(async s => { await window.__SS__!.ready; await window.__SCENE__!.load(s); await window.__SCENE__!.ready(); }, spec);
    const id = await page.evaluate(() => window.__SCENE__!.actors.get('animal')!.entity);
    const before = await page.evaluate(() => window.__SS__!.getState());
    expect(before.entities.find(e => e.id === id)!.civilian?.zooAnimal).toBe(species);
    expect(before.entities.find(e => e.id === id)!.infected).toBeUndefined();
    expect(before.render.healthBars!.bars.some(b => b.id === id)).toBe(false);
    await page.evaluate(async () => { await window.__SS__!.step(600); await window.__SCENE__!.step(1); await window.__SCENE__!.ready(); });
    const after = await page.evaluate(() => window.__SS__!.getState());
    expect(after.entities.filter(e => e.id === id)).toHaveLength(1);
    expect(after.entities.find(e => e.id === id)!.archetype).toBe(`infected.${species}`);
    expect(after.render.healthBars!.bars.find(b => b.id === id)).toMatchObject({ fraction: 1, width: tier === 'low' ? 48 : 64, height: tier === 'low' ? 6 : 8 });
    expect(await page.evaluate(id => window.__SS__!.events().filter(ev => ev.type === 'civilian.turned' && ev.id === id).map(ev => ev.type === 'civilian.turned' ? ev.infectedId : 0), id)).toEqual([id]);
  });
}
