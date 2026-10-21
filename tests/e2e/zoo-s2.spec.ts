import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

for (const [name, move, windup] of [['gorilla-throw', 'gorilla.grab-throw', 48], ['elephant-charge', 'elephant.charge', 54], ['elephant-swipe', 'elephant.swipe', 42]] as const) {
  test(`T-E07-19-${name}-browser @E07-AC05 @E07-AC19 @E30-AC10 production telegraph, pause, activation and shared bar`, async ({ page }) => {
    test.setTimeout(120_000);
    const spec = JSON.parse(readFileSync(`tests/scenes/zoo-s2/qa-zoo-${name}.json`, 'utf8')) as SceneSpec;
    // A settled sedan occupies the charge corridor and stops the elephant after
    // receiving its impulse. Exercise courier impact with that corridor clear;
    // the separate admitted-chassis case below retains the authored obstacle.
    if (move === 'elephant.charge') spec.vehicles = [];
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

test('T-E07-19-elephant-charge-chassis @E07-AC19 @E30-AC10 admitted sedan stops the charge after one real impulse and the barricade breaks', async ({ page }) => {
  test.setTimeout(120_000);
  const spec = JSON.parse(readFileSync('tests/scenes/zoo-s2/qa-zoo-elephant-charge.json', 'utf8')) as SceneSpec;
  spec.script = [];
  await page.goto('/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&profile=1&dpr=1');
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  await page.evaluate(async s => {
    await window.__SS__!.ready; await window.__SCENE__!.load(s);
    (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game.world.inspectionGhost = true;
  }, spec);
  const car = await page.evaluate(() => window.__SCENE__!.vehicles.get('car')!);
  // Let the actual chassis settle and require its ordinary parked blocker before
  // starting the special. No synthetic collision wall or physics state change.
  for (let i = 0; i < 120; i++) {
    if (await page.evaluate(id => (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game.world.events.events().some(e => e.type === 'world.blocker.changed' && e.id === -id && e.blocked), car)) break;
    await page.evaluate(async () => { await window.__SCENE__!.step(1); });
  }
  const before = await page.evaluate(id => {
    const lab = window.__SCENE__!, w = (lab as unknown as { game: import('../../src/Game').Game }).game.world;
    const admitted = w.events.events().some(e => e.type === 'world.blocker.changed' && e.id === -id && e.blocked);
    w.inspectionGhost = false;
    lab.command('animal', { special: 'elephant.charge', target: 'courier' });
    return { admitted, car: structuredClone(w.entities.get(id)!), attack: structuredClone(w.entities.get(lab.actors.get('animal')!.entity)!.infected!.specialAttack!) };
  }, car);
  expect(before.admitted).toBe(true);
  expect(before.attack.move).toBe('elephant.charge');
  await page.evaluate(async () => { await window.__SCENE__!.step(154); await window.__SCENE__!.ready(); });
  const after = await page.evaluate(id => ({ car: window.__SS__!.getEntity(id)!, state: window.__SS__!.getState(), events: window.__SS__!.events() }), car);
  expect(after.car.health.current).toBe(before.car.health.current - 80);
  expect(Math.hypot(after.car.transform.x - before.car.transform.x, after.car.transform.z - before.car.transform.z)).toBeGreaterThanOrEqual(1);
  expect(after.events.filter(e => e.type === 'infected.attack' && e.attackId === before.attack.attackId && e.targetId === car)).toHaveLength(1);
  expect(after.events.some(e => e.type === 'barricade.broken')).toBe(true);
  expect(after.events.filter(e => e.type === 'infected.attack' && e.attackId === before.attack.attackId && e.targetId === 1)).toHaveLength(0);
  expect(after.state.player!.health.current).toBe(100);
  const out = 'test-results/epics/E07'; mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/elephant-chassis.json`, JSON.stringify({ before, after }, null, 2));
});

for (const [width, height] of [[390, 844], [844, 390]] as const) test(`T-E07-19-elephant-bar-${width} @E07-AC19 @E30-AC10 shared mobile bar uses real HP and updates within a frame`, async ({ page }) => {
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
  const out = 'test-results/epics/E07/phone-bars'; mkdirSync(out, { recursive: true });
  await page.locator('canvas').screenshot({ path: `${out}/elephant-${width}.png` });
  writeFileSync(`${out}/elephant-${width}.json`, JSON.stringify(await page.evaluate(id => ({ entity: window.__SS__!.getEntity(id), bars: window.__SS__!.getState().render.healthBars }), id), null, 2));
});
