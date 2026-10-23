/** Q-124/Q-125: exercise the real frozen-corpse band and HP billboard lifecycle. One headless browser under e2e-lock. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, type Backend } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
const out = 'test-results/fixes-13k/corpse-runtime'; mkdirSync(out, { recursive: true });
const results: unknown[] = [];
try {
  for (const backend of ['webgl2', 'webgpu'] as Backend[]) for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 } });
    try {
      await session.open(); await session.page.evaluate('globalThis.__name = fn => fn');
      const spec: SceneSpec = { name: 'corpse-near-band', seed: 7, ground: 'asphalt', size: 60, time: 'L4', dof: false,
        actors: [{ id: 'courier', kind: 'courier', at: [-12, 0] }, { id: 'body', kind: 'infected', archetype: 'infected.firefighter', at: [0, 0], look: { model: 'inf.common-worker' }, state: { corpse: true } }],
        camera: { mode: 'game', target: [0, 0], zoom: 1 } };
      await session.load(spec); await session.step(2);
      const bands = [];
      for (const [x, expected] of [[-12, 'lod2'], [-7, 'lod1'], [-9, 'lod1'], [-11, 'lod2'], [-7, 'lod1']] as const) {
        const sample = await session.page.evaluate(async x => {
          const a = window.__SS__!; a.teleport(1, { x, z: 0 }); await a.step(1); await a.screenshotReady();
          const bodies = a.query({}).filter(e => e.corpse), e = bodies[0];
          return { x, id: e?.id, bodies: bodies.length, transform: e?.transform, figure: a.getState().render.crowd?.figures.find(f => f.id === e?.id), nodeBuilds: a.perf().nodeBuilds };
        }, x);
        assert.equal(sample.bodies, 1); assert.equal(sample.figure?.lod, tier === 'low' ? 'lod2' : expected); bands.push(sample);
      }
      for (const sample of bands) { assert.equal(sample.id, bands[0].id); assert.deepEqual(sample.transform, bands[0].transform); }
      await session.page.screenshot({ path: `${out}/${backend}-${tier}-near.jpg`, type: 'jpeg', quality: 88 });
      await session.load(readSpec('tests/scenes/catalog/alpha-hit-corpse-base.json'));
      const bars = []; let deathFrame: number | undefined;
      for (let frame = 0; frame <= 240; frame++) {
        if (frame) await session.step(1);
        const sample = await session.page.evaluate(frame => {
          const a = window.__SS__!, e = a.query({}).find(e => e.archetype === 'infected.alpha')!;
          return { frame, id: e.id, hp: e.health.current, dead: e.infected!.state === 'dead', recoverAt: e.infected!.recoverAt, corpse: !!e.corpse, bar: a.getState().render.healthBars?.bars.find(b => b.id === e.id) ?? null };
        }, frame);
        bars.push(sample);
        if (sample.hp <= 0) {
          assert.equal(sample.bar, null, `No HP bar on the first zero-HP frame (${frame}) or later`);
          if (deathFrame === undefined) { deathFrame = frame; await session.page.screenshot({ path: `${out}/${backend}-${tier}-first-zero-hp.jpg`, type: 'jpeg', quality: 88 }); }
        }
      }
      assert.ok(bars.some(b => b.hp > 0 && b.bar), 'Living Alpha bar must draw'); assert.ok(deathFrame !== undefined, 'Real shotgun strikes must down the Alpha');
      assert.deepEqual(session.errors, []);
      results.push({ backend, tier, bands, deathFrame, bars, errors: session.errors });
      writeFileSync(`${out}/evidence.json`, JSON.stringify(results, null, 2));
      console.log(`${backend} ${tier}: settled bands ${bands.map(b => b.figure?.lod).join('/')}, one retained body; HP bar gone at first zero-HP frame ${deathFrame}`);
    } finally { await session.close(); }
  }
} finally { stopServer(); }
