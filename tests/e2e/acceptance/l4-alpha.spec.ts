import { mkdirSync, writeFileSync } from 'node:fs';
import { readSpec } from '../../../tools/scenelab/session';
import { infectedSpecialMoves } from '../../../src/data/infected';
import type { SceneSpec } from '../../../src/debug/scenelab/spec';
import { boot, expect, test } from '../fixtures';

const backend = process.env.ALPHA_ACCEPTANCE_BACKEND === 'webgpu' ? 'webgpu' : 'webgl';
test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] } });
for (const tier of ['high', 'low'] as const) for (const move of ['charge', 'ground-slam', 'grab-throw', 'roar'] as const) {
  test(`T-E22-12-special-${move}-${tier} @E22-AC12 @E07-AC05 @E07-AC06 boundary, cooldown repeat and checkpoint captures ${backend}`, async ({ page }) => {
    test.setTimeout(300_000);
    const out = `test-results/ac-close/alpha/${backend}-${tier}-${move}`;
    mkdirSync(out, { recursive: true });
    const named = `tests/scenes/alpha-${move === 'charge' || move === 'ground-slam' ? 's2' : 's3'}/qa-alpha-${move}.json`;
    const spec = readSpec(named);
    const timing = infectedSpecialMoves[`alpha.${move}`];
    const fixture: SceneSpec = { ...spec, script: [], actors: spec.actors!.map(actor => {
      if (move === 'charge' && actor.id === 'outside') return { ...actor, at: [4, 1.001] };
      if (move === 'ground-slam' && actor.id === 'inside') return { ...actor, at: [0, 4] };
      if (move === 'ground-slam' && actor.id === 'outside') return { ...actor, at: [0, -4.001] };
      if (move === 'grab-throw' && actor.id === 'body') return { ...actor, at: [-2, 0] };
      if (move === 'roar' && actor.id === 'regular') return { ...actor, at: [18, 0] };
      if (move === 'roar' && actor.id === 'outside') return { ...actor, at: [-18.001, 0] };
      return actor;
    }) };
    await boot(page, `/?test=1&scenelab&renderer=${backend}&quality=${tier}&audio=muted&dpr=1`);
    const setup = await page.evaluate(async ({ fixture, move }) => {
      const lab = window.__SCENE__!, a = window.__SS__!;
      await lab.load(fixture);
      const game = (lab as unknown as { game: import('../../../src/Game').Game }).game, w = game.world;
      // Pin the radius probes, as in alpha-physical/support.test.ts, so their
      // boundary position is not changed by panic, separation or awareness.
      w.inspectionGhost = true;
      for (const actor of lab.actors.values()) {
        const e = w.entities.get(actor.entity)!;
        if (e.civilian) { e.civilian.state = 'annoyed'; e.civilian.until = 100_000; }
        if (e.infected && actor.id !== 'alpha' && actor.id !== 'body') e.combat!.staggerUntil = 100_000;
      }
      if (move === 'grab-throw') lab.command('body', { corpse: true });
      if (move !== 'roar') a.cheats.god(false);
      const m = w.loadMission({ id: 'alpha-acceptance', briefing: 'Alpha acceptance', anchors: { wait: { x: 0, z: 0, radius: 1 } }, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: ['cooldown'], cinematics: {}, onStart: [], onComplete: [], finish: ['wait'], steps: [{ id: 'wait', type: 'custom', text: 'Observe', anchor: 'wait', start: { kind: 'start' }, complete: { kind: 'timer', seconds: 10_000 }, fail: [] }] });
      m.begin();
      const source = lab.actors.get('alpha')!.entity, target = a.getEntity(1)!.transform;
      const started = w.infected!.startSpecial(source, `alpha.${move}`, { id: 1, x: target.x, z: target.z }, { x: 0, z: 0, radius: 0, dx: 1, dz: 0 });
      await a.screenshotReady();
      return { started, source, first: a.getEntity(source)!.infected!.specialAttack!, backend: a.perf().backend, tier: a.perf().quality.tier };
    }, { fixture, move });
    expect(setup.started).toBe(true); expect(setup.backend).toBe(backend); expect(setup.tier).toBe(tier);
    const captures: object[] = [];
    const capture = async (stage: string) => {
      await page.evaluate(() => window.__SS__!.screenshotReady());
      const state = await page.evaluate(() => {
        const a = window.__SS__!, lab = window.__SCENE__!;
        return { tick: a.tick(), actors: [...lab.actors].map(([name, actor]) => ({ name, entity: a.getEntity(actor.entity) })), markers: a.getState().render.vfx?.telegraphs, events: a.events(), perf: a.perf() };
      });
      await page.screenshot({ path: `${out}/${stage}.png` }); captures.push({ stage, ...state }); return state;
    };
    await capture('start');
    await page.evaluate(n => window.__SCENE__!.step(n), timing.windup - 1);
    const before = await capture('before-active');
    expect(before.actors.find(a => a.name === 'alpha')!.entity!.infected!.specialAttack!.stage).toBe('telegraph');
    expect(before.events.filter(e => e.type === 'combat.hit' && e.attackId === setup.first.attackId)).toHaveLength(0);
    await page.evaluate(() => window.__SCENE__!.step(1));
    const active = await capture('active');
    expect(active.events.some(e => e.type === 'infected.special' && e.attackId === setup.first.attackId && e.stage === 'active')).toBe(true);
    if (move === 'roar') {
      await page.evaluate(() => {
        const lab = window.__SCENE__!, game = (lab as unknown as { game: import('../../../src/Game').Game }).game;
        game.world.entities.get(lab.actors.get('regular')!.entity)!.combat!.staggerUntil = 0;
      });
      await page.evaluate(() => window.__SCENE__!.step(150)); await capture('converging');
    }
    // Capture full physical impact / roar expiry while retaining each original
    // named scene. Exact boundaries are also asserted in the shared sim suite.
    await page.evaluate(n => window.__SCENE__!.step(n), move === 'roar' ? 150 : move === 'charge' ? 116 : 100);
    const resolved = await capture('resolved');
    const entity = (name: string) => resolved.actors.find(a => a.name === name)!.entity!;
    const hit = (name: string) => resolved.events.some(e => e.type === 'combat.hit' && e.attackId === setup.first.attackId && e.targetId === entity(name).id);
    if (move === 'charge' || move === 'ground-slam') { expect(hit('inside')).toBe(true); expect(hit('outside')).toBe(false); }
    if (move === 'grab-throw') { expect(entity('body').corpse).toBe(true); expect(entity('body').corpseThrown).toBe(true); expect(hit('courier')).toBe(true); }
    if (move === 'roar') {
      const id = entity('regular').id, outside = entity('outside').id;
      expect(resolved.events.some(e => e.type === 'infected.roar-buff' && e.targetId === id && e.stage === 'active')).toBe(true);
      expect(resolved.events.some(e => e.type === 'infected.roar-buff' && e.targetId === outside)).toBe(false);
      expect(entity('regular').infected!.roar).toBeUndefined();
    }
    const saved = await page.evaluate(({ source, move }) => {
      const a = window.__SS__!, lab = window.__SCENE__!, game = (lab as unknown as { game: import('../../../src/Game').Game }).game;
      const e = game.world.entities.get(source)!;
      game.world.infected!.cancelSpecial(source); e.infected!.state = 'idle'; e.infected!.cooldown = 0;
      a.missions.checkpoint('cooldown');
      return { remaining: e.infected!.specialCooldowns![`alpha.${move}`]! - a.tick(), tick: a.tick() };
    }, { source: setup.source, move });
    await capture('cooldown-saved');
    await page.evaluate(async () => { await window.__SCENE__!.step(20); window.__SS__!.missions.restore('cooldown'); await window.__SS__!.screenshotReady(); });
    const restored = await capture('cooldown-restored');
    const restoredSource = restored.actors.find(a => a.name === 'alpha')!.entity!;
    expect(restoredSource.infected!.specialCooldowns![`alpha.${move}`]! - restored.tick).toBe(saved.remaining);
    const repeat = await page.evaluate(async ({ source, move, windup }) => {
      const a = window.__SS__!, lab = window.__SCENE__!, game = (lab as unknown as { game: import('../../../src/Game').Game }).game, w = game.world;
      const expiry = w.entities.get(source)!.infected!.specialCooldowns![`alpha.${move}`]!;
      await lab.step(expiry - windup - 1 - a.tick());
      const e = w.entities.get(source)!; w.infected!.cancelSpecial(source); e.infected!.state = 'idle'; e.infected!.cooldown = 0;
      if (move === 'grab-throw') { const body = w.entities.get(lab.actors.get('body')!.entity)!; Object.assign(body.transform, { x: e.transform.x + 1, z: e.transform.z + 1, y: .7 }); w.spatial.set(body.id, body.transform.x, body.transform.z); }
      const p = a.getEntity(1)!.transform, target = { id: 1, x: p.x, z: p.z }, area = { x: e.transform.x, z: e.transform.z, radius: 0, dx: 1, dz: 0 };
      const early = w.infected!.startSpecial(source, `alpha.${move}`, target, area);
      await lab.step(1);
      const allowed = w.infected!.startSpecial(source, `alpha.${move}`, target, area), next = structuredClone(e.infected!.specialAttack);
      await lab.step(windup);
      return { early, allowed, expiry, next, events: a.events() };
    }, { source: setup.source, move, windup: timing.windup });
    expect(repeat.early).toBe(false); expect(repeat.allowed).toBe(true);
    expect(repeat.next!.activeTick).toBe(repeat.expiry); expect(repeat.next!.attackId).toBeGreaterThan(setup.first.attackId);
    expect(repeat.events.some(e => e.type === 'infected.special' && e.attackId === repeat.next!.attackId && e.stage === 'active')).toBe(true);
    await capture('second-active');
    if (move === 'grab-throw') {
      const outside = await page.evaluate(async fixture => {
        const a = window.__SS__!, lab = window.__SCENE__!;
        await lab.load({ ...fixture, actors: fixture.actors!.map(actor => actor.id === 'body' ? { ...actor, at: [-1.999, 0] } : actor) }); lab.command('body', { corpse: true });
        const game = (lab as unknown as { game: import('../../../src/Game').Game }).game, w = game.world;
        w.inspectionGhost = true;
        const source = w.entities.get(lab.actors.get('alpha')!.entity)!, body = w.entities.get(lab.actors.get('body')!.entity)!;
        lab.command('alpha', { special: 'alpha.grab-throw', target: 'courier' });
        const distance = Math.hypot(source.transform.x - body.transform.x, source.transform.z - body.transform.z);
        await a.screenshotReady(); return { distance, body: body.id };
      }, fixture);
      await capture('pickup-outside-before');
      await page.evaluate(() => window.__SCENE__!.step(48));
      const cancelled = await capture('pickup-outside-cancelled');
      expect(outside.distance).toBeGreaterThan(2);
      expect(cancelled.events.some(e => e.type === 'infected.prop-thrown')).toBe(false);
      expect(cancelled.actors.find(a => a.name === 'body')!.entity!.id).toBe(outside.body);
      expect(cancelled.actors.find(a => a.name === 'body')!.entity!.corpse).toBe(true);
    }
    writeFileSync(`${out}/proof.json`, JSON.stringify({ named, move, tier, backend, timing, setup, saved, repeat, captures }, null, 2));
  });
}
