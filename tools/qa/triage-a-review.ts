/** Pooled render diagnostics for unresolved shared triage items; never writes campaign saves. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
import { runSpec } from '../scenelab/run';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const mode = process.argv[2] ?? 'blood';
const backend = process.argv.includes('--webgpu') ? 'webgpu' : 'webgl2';
const tier = process.argv.includes('--low') ? 'low' : 'high';
const out = resolve(`docs/reports/triage-a/review-${mode}-${backend}-${tier}`);
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend, tier, ...(mode === 'phone' ? { phone: true, viewport: { width: 844, height: 390 }, query: { ui: '1', debug: 'true' } } : {}) });
try {
  await session.open();
  if (mode === 'reload') {
    const geared = readSpec('tests/scenes/catalog/seethrough-gear-four.json');
    const gate = readSpec('tests/scenes/catalog/seethrough-door-gate.json');
    const result = await session.page.evaluate(async ({ geared, gate }) => {
      const lab = window.__SCENE__!, api = window.__SS__!;
      await lab.load(geared); await lab.ready();
      const before = api.getState().render.character!.gearTier;
      await lab.load(gate); await lab.step(250); await lab.ready();
      return { before, after: api.getState().render.character!.gearTier, draws: (await lab.metrics()).perf.drawCalls.max, backend: api.perf().backend };
    }, { geared, gate });
    await session.screenshot(`${out}/reloaded-gate.png`);
    writeFileSync(`${out}/evidence.json`, JSON.stringify({ ...result, originalBudget: 33, errors: session.errors }, null, 2));
    assert.equal(result.before, 4); assert.equal(result.after, 0);
    assert.ok(result.draws !== null && result.draws <= 33, JSON.stringify(result));
  } else if (mode === 'phone') {
    await session.page.evaluate(async () => {
      const a = window.__SS__!;
      await a.loadLevel('L1', { seed: 1 }); a.missions.begin(); a.pause();
      document.documentElement.setAttribute('data-scene-hud', '');
      document.querySelectorAll('.hud,#hud').forEach(e => e.setAttribute('data-scene-hud', ''));
      await a.screenshotReady();
    });
    const receipt = await session.page.evaluate(() => {
      const home = document.querySelector('[data-testid="home-button"]')!, portrait = document.querySelector('[data-testid="survivor-portrait"]')!;
      const h = home.getBoundingClientRect(), p = portrait.getBoundingClientRect();
      return { home: h.toJSON(), portrait: p.toJSON(), overlap: Math.max(0, Math.min(h.right, p.right) - Math.max(h.left, p.left)) * Math.max(0, Math.min(h.bottom, p.bottom) - Math.max(h.top, p.top)), classes: document.body.className };
    });
    await session.screenshot(`${out}/landscape.png`);
    writeFileSync(`${out}/evidence.json`, JSON.stringify({ ...receipt, errors: session.errors }, null, 2));
    assert.equal(receipt.overlap, 0);
  } else if (mode === 'shotgun') {
    const spec: SceneSpec = { name: 'shotgun-fall', seed: 1, ground: 'asphalt', time: 'L5', dof: false, size: 30,
      actors: [{ id: 'courier', kind: 'courier', at: [-3, 0], loadout: ['weapon.shotgun', 'weapon.fire-axe'], state: { attack: 'victim', seconds: 1, side: 'LEFT', inPlace: true } }, { id: 'victim', kind: 'infected', at: [0, 0], archetype: 'infected.runner', state: 'idle' }],
      camera: { mode: 'close', target: [0, .7, 0], radius: 10, azimuth: 135 }, frames: 120, sheet: 5, shots: [1, 10, 20, 40, 80, 120], trace: true, expect: { consoleErrors: 0 } };
    writeFileSync(`${out}/fixture.json`, JSON.stringify(spec, null, 2));
    const result = await runSpec(session, spec, { out, sheet: 5, shots: spec.shots });
    assert.ok(result.pass, JSON.stringify(result.failed));
  } else if (mode === 'environment') {
    const results = [];
    for (const name of ['stunning-cut-l3-supermarket', 'stunning-cut-l5-pharmacy', 'l5-po-cellar-return', 'l5-po-metro-ingress', 'l4-convoy-gate-stop']) {
      const spec = readSpec(`tests/scenes/catalog/${name}.json`);
      results.push(await runSpec(session, spec, { out: `${out}/${name}`, shots: spec.shots ?? [spec.frames ?? 60], sheet: spec.sheet ?? 30 }));
    }
    writeFileSync(`${out}/summary.json`, JSON.stringify(results.map(r => ({ pass: r.pass, failed: r.failed, files: r.files, sheet: r.sheet })), null, 2));
  } else if (mode === 'rocket') {
    for (const time of ['L6', 'L10-night'] as const) {
      const spec = readSpec('tests/scenes/catalog/qa-late-rocket-alpha.json');
      spec.name = `rocket-${time}`; spec.time = time;
      spec.actors![1].archetype = 'infected.runner';
      spec.script = [{ frame: 5, actor: 'courier', do: { attack: 'front', seconds: .5 } }];
      spec.frames = 180; spec.shots = [10, 60, 120, 180]; spec.sheet = 15;
      writeFileSync(`${out}/${time}-fixture.json`, JSON.stringify(spec, null, 2));
      const result = await runSpec(session, spec, { out: `${out}/${time}`, frames: 180, shots: spec.shots, sheet: 15 });
      assert.ok(result.pass, JSON.stringify(result.failed));
    }
  } else if (mode === 'blood') {
    const base = readSpec('tests/scenes/catalog/polish-blood-ground.json');
    for (const time of ['L6', 'L8-zoo', 'L10-night'] as const) {
      const spec: SceneSpec = { ...base, name: `blood-${time}`, time, frames: 180, shots: [11, 60, 120, 180], sheet: 15,
        script: [{ frame: 10, actor: 'victim', do: { hit: { amount: 400, heavy: true } } }] };
      writeFileSync(`${out}/${time}-fixture.json`, JSON.stringify(spec, null, 2));
      const r = await runSpec(session, spec, { out: `${out}/${time}`, frames: 180, shots: [11, 60, 120, 180], sheet: 15 });
      assert.ok(r.pass, JSON.stringify(r.failed));
    }
  } else throw new Error(`Unknown diagnostic: ${mode}`);
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }
