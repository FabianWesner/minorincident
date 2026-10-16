import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

for (const [name, move, windup] of [['lion-pounce', 'lion.pounce', 36], ['lion-flank', 'lion.flank', 36], ['gorilla-roar', 'gorilla.roar', 60], ['gorilla-pound', 'gorilla.pound', 60]] as const) {
  test(`T-E07-19-${name}-browser @E07-AC05 @E07-AC19 @E30-AC10 production telegraph, pause, activation and shared bar`, async ({ page }) => {
    test.setTimeout(120_000);
    const spec = JSON.parse(readFileSync(`tests/scenes/zoo-s1/qa-zoo-${name}.json`, 'utf8')) as SceneSpec;
    await page.goto('/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&profile=1&dpr=1');
    await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    await page.evaluate(async s => { await window.__SS__!.ready; await window.__SCENE__!.load(s); window.__SS__!.settings.set({ flashReduction: true, gore: 'Off' }); }, spec);
    await page.evaluate(async n => { await window.__SCENE__!.step(1); await window.__SS__!.step(n - 1); await window.__SCENE__!.ready(); }, windup - 1);
    const before = await page.evaluate(() => ({ id: window.__SCENE__!.actors.get('animal')!.entity, state: window.__SS__!.getState(), events: window.__SS__!.events() }));
    const a = before.state.entities.find(e => e.id === before.id)!.infected!.specialAttack!;
    expect(a).toMatchObject({ move, stage: 'telegraph' }); expect(a.activeTick - a.startTick).toBe(windup);
    expect(before.state.render.vfx?.telegraphs.some(t => t.attackId === a.attackId)).toBe(true);
    expect(before.state.render.healthBars?.bars.find(b => b.id === before.id)).toMatchObject({ fraction: 1, width: 64, height: 8 });
    await page.evaluate(() => window.__SS__!.pause());
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__SS__!.getState().tick)).toBe(before.state.tick);
    await page.evaluate(async () => { await window.__SS__!.step(1); await window.__SCENE__!.ready(); });
    const after = await page.evaluate(() => ({ state: window.__SS__!.getState(), events: window.__SS__!.events() }));
    expect(after.events.some(ev => ev.type === 'infected.special' && ev.attackId === a.attackId && ev.stage === 'active')).toBe(true);
    expect(after.state.render.vfx?.telegraphs.some(t => t.attackId === a.attackId)).toBe(false);
    if (move === 'gorilla.pound') expect(after.state.player!.health.current).toBe(70);
    if (move === 'gorilla.roar') {
      const regular = await page.evaluate(() => window.__SCENE__!.actors.get('regular')!.entity);
      expect(after.state.entities.find(e => e.id === regular)!.infected!.roar).toMatchObject({ x: 0, z: 0, speedScale: 1 });
    }
  });
}
