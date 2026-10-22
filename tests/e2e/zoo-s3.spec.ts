import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
for (const [name, move, windup, hp] of [['zebra-kick', 'zebra.kick', 36, 180], ['zebra-stampede', 'zebra.stampede', 48, 180], ['flamingo-dive', 'flamingo.dive', 36, 15]] as const) {
  test(`T-E07-19-${name}-browser @E07-AC05 @E07-AC19 @E30-AC10 production cue, pause, bar, impact and expiry`, async ({ page }) => {
    test.setTimeout(120_000);
    const spec = JSON.parse(readFileSync(`tests/scenes/zoo-s3/qa-zoo-${name}.json`, 'utf8')) as SceneSpec;
    await page.goto('/?test=1&scenelab&ui=1&renderer=webgl&quality=high&audio=muted&profile=1&dpr=1');
    await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    await page.evaluate(async s => { await window.__SS__!.ready; await window.__SCENE__!.load(s); document.body.dataset.uiScreen = 'game'; window.__SS__!.settings.set({ flashReduction: true, gore: 'Off' }); await window.__SCENE__!.step(1); }, spec);
    await page.evaluate(async n => { await window.__SS__!.step(n - 2); await window.__SCENE__!.ready(); }, windup);
    const before = await page.evaluate(() => ({ id: window.__SCENE__!.actors.get('animal')!.entity, state: window.__SS__!.getState() }));
    const a = before.state.entities.find(e => e.id === before.id)!.infected!.specialAttack!;
    expect(a).toMatchObject({ move, stage: 'telegraph' }); expect(a.activeTick - a.startTick).toBe(windup);
    expect(before.state.entities.find(e => e.id === before.id)!.health.max).toBe(hp);
    expect(before.state.player!.health.current).toBe(100); expect(before.state.render.vfx!.obstruction.opacity).toBe(0);
    expect(before.state.render.vfx!.telegraphs.some(t => t.attackId === a.attackId)).toBe(true);
    expect(before.state.render.healthBars!.bars.find(b => b.id === before.id)).toMatchObject({ fraction: 1, width: 64, height: 8 });
    await page.evaluate(() => window.__SS__!.pause()); await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__SS__!.getState().tick)).toBe(before.state.tick);
    await page.evaluate(async () => { await window.__SS__!.step(1); await window.__SCENE__!.ready(); });
    expect(await page.evaluate(id => window.__SS__!.events().some(ev => ev.type === 'infected.special' && ev.attackId === id && ev.stage === 'active'), a.attackId)).toBe(true);
    if (move === 'flamingo.dive') {
      await page.evaluate(async () => { await window.__SS__!.step(24); await window.__SCENE__!.ready(); });
      const hit = await page.evaluate(() => window.__SS__!.getState());
      expect(hit.player!.health.current).toBe(95); expect(hit.render.vfx!.obstruction).toEqual({ remainingTicks: 48, opacity: .18 });
      await expect(page.getByTestId('health-bar')).toBeVisible();
      await expect(page.getByTestId('health-bar')).toHaveAttribute('aria-valuenow', '95');
      await expect(page.getByTestId('flamingo-feathers')).toHaveCSS('pointer-events', 'none');
      await expect(page.getByTestId('flamingo-feathers')).toHaveCSS('opacity', '0.18');
      await page.evaluate(async () => { await window.__SS__!.step(48); await window.__SCENE__!.ready(); });
      expect(await page.evaluate(() => window.__SS__!.getState().render.vfx!.obstruction.opacity)).toBe(0);
    } else {
      await page.evaluate(async () => { await window.__SS__!.step(100); await window.__SCENE__!.ready(); });
      const impact = await page.evaluate(() => window.__SS__!.getState()); expect(impact.player!.health.current).toBe(move === 'zebra.kick' ? 80 : 25);
    }
    expect(await page.evaluate(id => window.__SS__!.events().filter(ev => ev.type === 'infected.attack' && ev.attackId === id && ev.targetId === 1).length, a.attackId)).toBe(1);
  });
}
for (const [width, height] of [[390, 844], [844, 390]] as const) test(`T-E07-19-zebra-flamingo-phone-${width} @E07-AC19 @E30-AC10 shared phone bars update from real HP in low tier`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  const spec = JSON.parse(readFileSync('tests/scenes/zoo-s3/qa-zoo-flamingo-dive.json', 'utf8')) as SceneSpec;
  spec.script = []; spec.actors!.push({ id: 'zebra', kind: 'infected', archetype: 'infected.zebra', at: [-3, 0], state: 'idle' });
  await page.goto('/?test=1&scenelab&renderer=webgl&quality=low&audio=muted&dpr=1');
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  await page.evaluate(async s => { await window.__SS__!.ready; await window.__SCENE__!.load(s); await window.__SCENE__!.ready(); }, spec);
  const ids = await page.evaluate(() => ['animal', 'zebra'].map(name => window.__SCENE__!.actors.get(name)!.entity));
  for (const id of ids) expect(await page.evaluate(id => window.__SS__!.getState().render.healthBars!.bars.find(b => b.id === id), id)).toMatchObject({ fraction: 1, width: 48, height: 6 });
  await page.evaluate(async () => { window.__SCENE__!.command('zebra', { hit: { amount: 45 } }); await window.__SCENE__!.step(1); await window.__SCENE__!.ready(); });
  expect(await page.evaluate(id => window.__SS__!.getState().render.healthBars!.bars.find(b => b.id === id), ids[1])).toMatchObject({ fraction: .75, width: 48, height: 6 });
  const out = 'test-results/epics/E07/phone-bars'; mkdirSync(out, { recursive: true });
  await page.locator('canvas').screenshot({ path: `${out}/zebra-flamingo-${width}.png` });
  writeFileSync(`${out}/zebra-flamingo-${width}.json`, JSON.stringify(await page.evaluate(ids => ({ entities: ids.map(id => window.__SS__!.getEntity(id)), bars: window.__SS__!.getState().render.healthBars }), ids), null, 2));
});
