import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

for (const move of ['grab-throw', 'roar'] as const) test(`T-E07-06-${move}-browser @E07-AC05 @E07-AC06 real scene wiring retains telegraph until activation`, async ({ page }) => {
  test.setTimeout(120_000);
  const spec = JSON.parse(readFileSync(`tests/scenes/alpha-s3/qa-alpha-${move}.json`, 'utf8')) as SceneSpec;
  await page.goto('/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&profile=1&dpr=1');
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  await page.evaluate(async s => { await window.__SS__!.ready; await window.__SCENE__!.load(s); window.__SS__!.settings.set({ flashReduction: true, gore: 'Off' }); await window.__SCENE__!.step(57); await window.__SCENE__!.ready(); }, spec);
  const before = await page.evaluate(() => {
    const api = window.__SS__!, lab = window.__SCENE__!, id = lab.actors.get('alpha')!.entity;
    return { id, state: api.getState(), events: api.events() };
  });
  const tell = before.events.find(e => e.type === 'telegraph' && e.sourceId === before.id && e.move === `alpha.${move}`);
  expect(tell).toMatchObject({ duration: .8 });
  const a = before.state.entities.find(e => e.id === before.id)!.infected!.specialAttack!;
  expect(a.stage).toBe('telegraph'); expect(a.activeTick - a.startTick).toBe(48);
  expect(before.state.render.vfx?.telegraphs.some(t => t.attackId === a.attackId)).toBe(true);
  await page.evaluate(async () => { await window.__SCENE__!.step(1); await window.__SCENE__!.ready(); });
  const after = await page.evaluate(() => window.__SS__!.getState());
  expect(after.render.vfx?.telegraphs.some(t => t.attackId === a.attackId)).toBe(false);
  const resolved = after.entities.find(e => e.id === before.id)!.infected!.specialAttack!;
  if (move === 'grab-throw') {
    expect(resolved.projectile).toBeDefined();
    await page.evaluate(async () => { await window.__SCENE__!.step(40); await window.__SCENE__!.ready(); });
    const impact = await page.evaluate(() => ({ state: window.__SS__!.getState(), events: window.__SS__!.events() }));
    expect(impact.state.player!.health.current).toBe(70);
    expect(impact.events.filter(e => e.type === 'infected.attack' && e.attackId === a.attackId)).toHaveLength(1);
    expect(impact.state.entities.find(e => e.id === resolved.projectile!.objectId)).toMatchObject({ corpse: true, corpseThrown: true });
  } else {
    expect(resolved.stage).toBe('recovery');
    const regularId = await page.evaluate(() => window.__SCENE__!.actors.get('regular')!.entity);
    expect(after.entities.find(e => e.id === regularId)!.infected!.roar).toMatchObject({ x: 0, z: 0, until: after.tick + 300 });
    // Expiry is a sim-clock assertion; per-tick captures belong to the Mac Scene Lab run.
    await page.evaluate(async () => { await window.__SS__!.step(300); });
    const expired = await page.evaluate(() => window.__SS__!.getState());
    expect(expired.entities.find(e => e.id === regularId)!.infected!.roar).toBeUndefined();
  }
});

test('T-E07-06-all-specials-browser @E07-AC05 @E07-AC06 one Alpha activates all four moves in the merged Scene Lab', async ({ page }) => {
  test.setTimeout(120_000);
  const spec = JSON.parse(readFileSync('tests/scenes/alpha-s3/qa-alpha-all-specials.json', 'utf8')) as SceneSpec;
  await page.goto('/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&profile=1&dpr=1');
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  const observed = await page.evaluate(async s => {
    await window.__SS__!.ready; await window.__SCENE__!.load(s);
    await window.__SCENE__!.step(900); await window.__SCENE__!.ready();
    return { id: window.__SCENE__!.actors.get('alpha')!.entity, events: window.__SS__!.events() };
  }, spec);
  const activations = observed.events.flatMap(e => e.type === 'infected.special' && e.sourceId === observed.id && e.stage === 'active' ? [e.move] : []);
  expect(new Set(activations)).toEqual(new Set(['alpha.charge', 'alpha.ground-slam', 'alpha.grab-throw', 'alpha.roar']));
  expect(observed.events.some(e => e.type === 'infected.prop-thrown' && e.sourceId === observed.id)).toBe(true);
  expect(observed.events.some(e => e.type === 'infected.roar-buff' && e.sourceId === observed.id && e.stage === 'active')).toBe(true);
});
