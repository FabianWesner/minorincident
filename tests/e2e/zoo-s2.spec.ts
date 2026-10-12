import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

for (const [name, move, windup] of [['gorilla-throw', 'gorilla.grab-throw', 48], ['elephant-charge', 'elephant.charge', 54], ['elephant-swipe', 'elephant.swipe', 42]] as const) {
  test(`T-E07-19-${name}-browser @E07-AC05 @E07-AC19 production telegraph, pause, activation and shared bar`, async ({ page }) => {
    test.setTimeout(120_000);
    const spec = JSON.parse(readFileSync(`tests/scenes/zoo-s2/qa-zoo-${name}.json`, 'utf8')) as SceneSpec;
    await page.goto('/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&profile=1&dpr=1');
    await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    await page.evaluate(async s => { await window.__SS__!.ready; await window.__SCENE__!.load(s); window.__SS__!.settings.set({ flashReduction: true, gore: 'Off' }); }, spec);
    await page.evaluate(async n => { await window.__SCENE__!.step(1); await window.__SS__!.step(n - 1); await window.__SCENE__!.ready(); }, windup - 1);
    const before = await page.evaluate(() => ({ id: window.__SCENE__!.actors.get('animal')!.entity, state: window.__SS__!.getState(), events: window.__SS__!.events() }));
    const a = before.state.entities.find(e => e.id === before.id)!.infected!.specialAttack!;
    expect(before.state.entities.find(e => e.id === before.id)!.health.max).toBe(move.startsWith('elephant') ? 1200 : 1800);
    expect(a).toMatchObject({ move, stage: 'telegraph' }); expect(a.activeTick - a.startTick).toBe(windup);
    expect(before.state.render.vfx?.telegraphs.some(t => t.attackId === a.attackId)).toBe(true);
    const phone = page.viewportSize()!.width < 900;
    expect(before.state.render.healthBars?.bars.find(b => b.id === before.id)).toMatchObject({ fraction: 1, width: phone ? 48 : 64, height: phone ? 6 : 8 });
    await page.evaluate(() => window.__SS__!.pause());
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__SS__!.getState().tick)).toBe(before.state.tick);
    await page.evaluate(async () => { await window.__SS__!.step(1); await window.__SCENE__!.ready(); });
    const after = await page.evaluate(() => ({ state: window.__SS__!.getState(), events: window.__SS__!.events() }));
    expect(after.events.some(ev => ev.type === 'infected.special' && ev.attackId === a.attackId && ev.stage === 'active')).toBe(true);
    expect(after.state.render.vfx?.telegraphs.some(t => t.attackId === a.attackId)).toBe(false);
    if (move === 'elephant.swipe') expect(after.state.player!.health.current).toBe(75);
    await page.evaluate(async () => { await window.__SS__!.step(100); await window.__SCENE__!.ready(); });
    const impact = await page.evaluate(() => ({ state: window.__SS__!.getState(), events: window.__SS__!.events() }));
    expect(impact.events.filter(ev => ev.type === 'infected.attack' && ev.attackId === a.attackId && ev.targetId === 1)).toHaveLength(1);
    expect(impact.state.player!.health.current).toBe(move === 'elephant.swipe' ? 75 : move === 'elephant.charge' ? 60 : 70);
  });
}

for (const [width, height] of [[390, 844], [844, 390]] as const) test(`T-E07-19-elephant-bar-${width} @E07-AC19 shared mobile bar uses real HP and updates within a frame`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  const spec = JSON.parse(readFileSync('tests/scenes/zoo-s2/qa-zoo-elephant-swipe.json', 'utf8')) as SceneSpec;
  spec.script = []; spec.actors![0].at = [8, 0];
  await page.goto('/?test=1&scenelab&renderer=webgl&quality=low&audio=muted&dpr=1');
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  await page.evaluate(async s => { await window.__SS__!.ready; await window.__SCENE__!.load(s); window.__SS__!.settings.set({ textSize: 1.5 }); await window.__SCENE__!.ready(); }, spec);
  const id = await page.evaluate(() => window.__SCENE__!.actors.get('animal')!.entity);
  expect(await page.evaluate(id => window.__SS__!.getState().render.healthBars!.bars.find(b => b.id === id), id)).toMatchObject({ fraction: 1, width: 48, height: 6 });
  await page.evaluate(async () => { window.__SCENE__!.command('animal', { hit: { amount: 300 } }); await window.__SCENE__!.step(1); await window.__SCENE__!.ready(); });
  expect(await page.evaluate(id => window.__SS__!.getState().render.healthBars!.bars.find(b => b.id === id), id)).toMatchObject({ fraction: .75, width: 48, height: 6 });
});
