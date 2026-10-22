import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

for (const [width, height] of [[1280, 720], [390, 844], [844, 390]] as const) test.describe(`Alpha support ${width}`, () => {
  test.use({ viewport: { width, height } });
  for (const move of ['grab-throw', 'roar'] as const) test(`T-E07-06-${move}-browser @E07-AC05 @E07-AC06 @E29-AC07 @E30-AC10 @E32-AC09 real scene wiring retains telegraph until activation`, async ({ page }) => {
  test.setTimeout(120_000);
  const spec = JSON.parse(readFileSync(`tests/scenes/alpha-s3/qa-alpha-${move}.json`, 'utf8')) as SceneSpec;
  await page.goto('/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&profile=1&dpr=1');
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  await page.evaluate(async s => { await window.__SS__!.ready; await window.__SCENE__!.load(s); window.__SS__!.settings.set({ flashReduction: true, gore: 'Off' }); await window.__SCENE__!.step(57); await window.__SCENE__!.ready(); }, spec);
  const before = await page.evaluate(() => {
    const api = window.__SS__!, lab = window.__SCENE__!, id = lab.actors.get('alpha')!.entity;
    return { id, state: api.getState(), events: api.events() };
  });
  const out = 'test-results/epics/E07/native-alpha'; mkdirSync(out, { recursive: true });
  await page.locator('canvas').screenshot({ path: `${out}/${move}-${width}-warning.png` });
  writeFileSync(`${out}/${move}-${width}-warning.json`, JSON.stringify(before, null, 2));
  const tell = before.events.find(e => e.type === 'telegraph' && e.sourceId === before.id && e.move === `alpha.${move}`);
  expect(tell).toMatchObject({ duration: .8 });
  const a = before.state.entities.find(e => e.id === before.id)!.infected!.specialAttack!;
  expect(a.stage).toBe('telegraph'); expect(a.activeTick - a.startTick).toBe(48);
  expect(before.state.render.vfx?.telegraphs.some(t => t.attackId === a.attackId)).toBe(true);
  await page.evaluate(async () => { await window.__SCENE__!.step(1); await window.__SCENE__!.ready(); });
  const after = await page.evaluate(() => window.__SS__!.getState());
  await page.locator('canvas').screenshot({ path: `${out}/${move}-${width}-active.png` });
  writeFileSync(`${out}/${move}-${width}-active.json`, JSON.stringify(after, null, 2));
  expect(after.render.vfx?.telegraphs.some(t => t.attackId === a.attackId)).toBe(false);
  const resolved = after.entities.find(e => e.id === before.id)!.infected!.specialAttack!;
  if (move === 'grab-throw') {
    expect(resolved.projectile).toBeDefined();
    await page.evaluate(async () => { await window.__SCENE__!.step(40); await window.__SCENE__!.ready(); });
    const impact = await page.evaluate(() => ({ state: window.__SS__!.getState(), events: window.__SS__!.events() }));
    await page.locator('canvas').screenshot({ path: `${out}/${move}-${width}-impact.png` });
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
});

test('T-E07-06-all-specials-browser @E07-AC05 @E07-AC06 @E29-AC07 @E30-AC10 @E32-AC09 one Alpha activates all four moves in the merged Scene Lab', async ({ page }) => {
  test.setTimeout(120_000);
  const spec = JSON.parse(readFileSync('tests/scenes/alpha-s3/qa-alpha-all-specials.json', 'utf8')) as SceneSpec;
  await page.goto('/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&profile=1&dpr=1');
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  const observed = await page.evaluate(async s => {
    await window.__SS__!.ready; await window.__SCENE__!.load(s);
    const lab = window.__SCENE__!, api = window.__SS__!, id = lab.actors.get('alpha')!.entity, samples = [];
    let frame = 0;
    for (const at of [190, 250, 260, 266, 267, 280, 300, 314, 322, 330, 350, 378, 440, 500, 548, 900]) {
      await lab.step(at - frame); frame = at;
      const body = lab.actors.get('body')?.entity;
      samples.push({ frame, tick: api.tick(), source: structuredClone(api.getEntity(id)), player: structuredClone(api.getEntity(1)), body: body ? structuredClone(api.getEntity(body)) : null });
    }
    await lab.ready();
    return { id, bodyId: lab.actors.get('body')!.entity, samples, events: api.events() };
  }, spec);
  mkdirSync('test-results/epics/E07', { recursive: true });
  writeFileSync('test-results/epics/E07/alpha-merged.json', JSON.stringify(observed, null, 2));
  const activations = observed.events.flatMap(e => e.type === 'infected.special' && e.sourceId === observed.id && e.stage === 'active' ? [e.move] : []);
  expect(new Set(activations)).toEqual(new Set(['alpha.charge', 'alpha.ground-slam', 'alpha.grab-throw', 'alpha.roar']));
  expect(observed.events.some(e => e.type === 'infected.prop-thrown' && e.sourceId === observed.id && e.propId === observed.bodyId)).toBe(true);
  expect(observed.events.some(e => e.type === 'infected.roar-buff' && e.sourceId === observed.id && e.stage === 'active')).toBe(true);
  // Before protection, all three authored impacts deal their full damage.
  const hits = observed.events.flatMap(e => e.type === 'combat.hit' && e.tick < 350 && e.sourceId === observed.id && e.targetId === 1 && ['alpha.charge', 'alpha.ground-slam', 'infected.alpha.grab-throw'].includes(e.actionId) ? [e.amount] : []);
  expect(hits).toEqual([30, 25, 30]);
  expect(observed.samples.find(s => s.frame === 350)!.player!.health.current).toBe(15);
});
