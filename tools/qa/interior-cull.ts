import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { l5Survivors } from '../../src/data/l5';
import { SceneSession, stopServer } from '../scenelab/session';

/** Native A/B of identical loaded levels/cameras; run through quiet-run after a production build. */
const baseline = process.env.INTERIOR_BASELINE === '1';
const out = process.env.INTERIOR_OUT ?? 'test-results/interior-cull/perf';
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/measurements.json`, '[]\n');
const rows: unknown[] = [];
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ tier, backend: 'webgl2', nativeFrameTiming: true });
    try {
      await session.open();
      for (const level of ['L4', 'L5'] as const) {
        await session.page.evaluate(async ({ level, tier }) => {
          const api = window.__SS__!; await api.loadLevel(level, { seed: 1, progression: `${level}-default` });
          api.pause(); api.missions.begin(); api.cheats.god(true); api.settings.set({ quality: tier, cameraShake: false });
          if (level === 'L4') api.cheats.completeObjective('ride');
          else { api.cheats.completeObjective('emerge'); await api.step(660); }
          await api.step(30);
        }, { level, tier });
        if (level === 'L5') for (const survivor of l5Survivors.slice(0, 4)) await session.page.evaluate(async at => {
          const api = window.__SS__!; api.teleport(api.query({ kind: 'player' })[0].id, { x: at[0], z: at[1] }); await api.step(100);
        }, [...survivor.ringAt]);
        for (const [spot, at] of [['po', [83.75, 38.84]], ['street', [-13.7, -22.5]]] as const) {
          await session.page.evaluate(async ([x, z]) => {
            const api = window.__SS__!; api.teleport(api.query({ kind: 'player' })[0].id, { x, z }); api.camera.follow();
            const canvas = document.querySelector('canvas')!;
            for (let i = 0; i < 3; i++) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
            await api.step(90); await api.screenshotReady();
          }, [...at]);
          const samples = [];
          for (const disabled of baseline ? [true] : process.env.INTERIOR_AB === '1' ? [true, false] : [false]) {
            await session.page.evaluate(async disabled => { const api = window.__SS__!; api.settings.set({ interiorCullOff: disabled }); await api.step(2); await api.screenshotReady(); }, disabled);
            const sample = await session.page.evaluate(async () => {
              const api = window.__SS__!, costs = [];
              for (let i = 0; i < 60; i++) { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); await api.step(1); costs.push(api.getState().render.districts!.interiors?.cpuMs ?? 0); }
              const p = api.perf(), state = api.getState();
              const submitted = Object.values(p.profile ?? {}).reduce((sum, part) => ({ drawCalls: sum.drawCalls + part.drawCalls, triangles: sum.triangles + part.triangles }), { drawCalls: 0, triangles: 0 });
              if (submitted.drawCalls < 2) throw new Error('Scene draw counters were not sampled on a fresh renderer frame');
              return { ...submitted, finalPass: { drawCalls: p.drawCalls, triangles: p.triangles }, profile: p.profile, backend: p.backend, interiors: state.render.districts!.interiors, cpuMs: costs, camera: state.render.camera, player: api.query({ kind: 'player' })[0].transform, mission: api.missions.state()?.l5 };
            });
            if (!baseline) {
              assert(sample.drawCalls <= (tier === 'high' ? 600 : 300), 'E18 draw budget');
              assert(sample.triangles <= (tier === 'high' ? 1_500_000 : 500_000), 'E18 triangle budget');
              // Chromium's non-isolated timer resolves to 0.1 ms; discard binary float noise only.
              assert(Math.round(Math.max(...sample.cpuMs) * 1000) / 1000 <= .1, 'interior update exceeds 0.1 ms');
            }
            assert.equal(session.errors.length, 0, 'browser console errors');
            samples.push({ disabled, ...sample });
            await session.screenshot(`${out}/${level}-${spot}-${tier}-${disabled ? 'before' : 'after'}.png`);
          }
          const row = { level, spot, tier, samples }; rows.push(row);
          writeFileSync(`${out}/measurements.json`, JSON.stringify(rows, null, 2));
          console.log(JSON.stringify({ level, spot, tier, baseline, drawCalls: samples.at(-1)!.drawCalls, triangles: samples.at(-1)!.triangles, cpuMaxMs: Math.max(...samples.at(-1)!.cpuMs) }));
        }
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
