/** Dense permanent-body review. Run under e2e-lock, or quiet-run with --timing. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import { regularInfectedModels } from '../../src/data/crowdAppearance';

const out = process.env.CORPSE_OUT ?? 'test-results/l10-corpses';
mkdirSync(out, { recursive: true });
const timing = process.argv.includes('--timing');
const rows: unknown[] = [];
try {
  for (const backend of (process.env.CORPSE_BACKENDS ?? 'webgl2,webgpu').split(',') as ('webgl2' | 'webgpu')[]) {
    for (const tier of (process.env.CORPSE_TIERS ?? (timing ? 'low' : 'low,high')).split(',') as ('low' | 'high')[]) {
      const session = new SceneSession({ backend, tier, nativeFrameTiming: timing, query: { ...(timing ? { debug: 'true' } : {}), ...Object.fromEntries(new URLSearchParams(process.env.CORPSE_QUERY ?? '')) }, viewport: { width: 1280, height: 720 } });
      try {
        await session.open();
        await session.page.evaluate('globalThis.__name = fn => fn');

        for (const level of (process.env.CORPSE_LEVELS ?? (timing ? 'L10' : 'L10,L4,L7,L8')).split(',')) {
          if (tier === 'high' && ['L7', 'L8'].includes(level)) continue;
          const setup = await session.page.evaluate(async ({ level, tier, models }) => {
            const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
            a.settings.set({ quality: tier });
            await a.loadLevel(level, { seed: 32, ...(level === 'L10' ? { checkpoint: 'cure-disperse-ready' } : {}) });
            a.pause(); a.cheats.god(true);
            game.view.settings({ cameraShake: false, cheapDof: false }); a.debug.figureJoints(false);
            if (level !== 'L10') { a.missions.begin(); if (level === 'L4') a.missions.completeObjective('ride'); }
            if (level === 'L10') {
              a.teleport(1, { x: 4002, z: -27 });
              a.input.set({ interact: true }); await a.step(1); a.input.clear();
              // The shipped assault supplies the bodies; leave its persistent boss alive.
              for (let wave = 0; wave < 12; wave++) {
                await a.step(450);
                for (const e of game.world.entities.iterate()) if (e.infected && !e.infected.pursuit && e.health.current > 0) { e.health.current = 0; e.infected.recoverAt = -1; }
                await a.step(150);
              }
            }
            {
              // Deterministic identical body field on each real level: shared infected path,
              // seven shipped looks, no population/count changes to the implementation.
              const p = a.getEntity(1)!.transform;
              for (let wave = 0; wave < 4; wave++) {
                for (const e of [...game.world.infected!.active]) if (!e.infected!.pursuit) {
                  e.health.current = 0; e.infected!.state = 'dead'; e.infected!.deadAt = game.world.tick - 150; e.infected!.recoverAt = -1;
                  game.world.infected!.settle(e);
                }
                for (let i = 0; i < 49; i++) {
                  const n = wave * 49 + i, x = p.x - 13 + n % 14 * 2, z = p.z - 14 + Math.floor(n / 14) * 2;
                  const id = a.spawn('infected.runner', { x, z }, { variant: models[i % models.length], offNav: true, yaw: (i * 2.399963 + wave) % (Math.PI * 2) });
                  const e = game.world.entities.get(id)!; e.health.current = 0; e.infected!.state = 'dead'; e.infected!.deadAt = game.world.tick - 150;
                  game.world.infected!.settle(e);
                }
                for (const e of game.world.entities.iterate()) if (e.infected && !e.infected.pursuit) { e.health.current = 0; e.infected.recoverAt = -1; }
                await a.step(150);
              }
            }
            const bodies = a.query({}).filter(e => e.corpse);
            if (!bodies.length) throw Error('No permanent bodies');
            const p = a.getEntity(1)!.transform;
            return { level, tick: a.tick(), player: p, corpses: bodies.length, bodies: bodies.map(e => ({ id: e.id, model: e.infected?.model, at: e.transform })) };
          }, { level, tier, models: [...regularInfectedModels] });
          for (const zoom of (timing || ['L7', 'L8'].includes(level) ? [1] : [.5, 1, 1.5])) {
            const state = await session.page.evaluate(async zoom => {
              const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game, rig = game.view.view;
              const hero = game.world.entities.get(1)!.transform;

              rig.inspectionPose = null; rig.reset(hero); rig.zoom(Math.log(zoom / rig.getState().targetZoom), true); rig.update(hero, 0);
              await a.step(1); await a.screenshotReady();
              const meshes: { name: string; instances: number; triangles: number }[] = [];
              game.view.scene.traverse(o => { const m = o as import('three').InstancedMesh; if ((m.name.startsWith('corpses:') || m.name.startsWith('corpse-headwear:')) && m.count) meshes.push({ name: m.name, instances: m.count, triangles: (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3 }); });
              return { backend: a.perf().backend, quality: a.getState().render.quality, camera: a.getState().render.camera, perf: a.perf(), meshes, corpses: a.query({}).filter(e => e.corpse).length };
            }, zoom);
            assert.equal(state.backend, backend === 'webgl2' ? 'webgl' : backend);
            assert.equal(state.quality, tier); assert.ok(Math.abs(state.camera.zoom - zoom) < .001);
            assert.ok(state.meshes.length > 0, 'Frozen bodies must be drawn');
            const name = `${level}-${backend}-${tier}-z${zoom}`;
            await session.page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 90 });
            const profileSession = process.env.CORPSE_PROFILE ? await session.page.context().newCDPSession(session.page) : null;
            if (profileSession) { await profileSession.send('Profiler.enable'); await profileSession.send('Profiler.setSamplingInterval', { interval: 500 }); await profileSession.send('Profiler.start'); }
            const samples = [];
            if (timing) for (let repeat = 0; repeat < 3; repeat++) samples.push(await session.page.evaluate(async () => {
              const a = window.__SS__!, frames: number[] = [], render: number[] = [], update: number[] = [];
              // Keep the corpse field identical through every sample. Paused game
              // renders continuously; inspection also exercises the normal view update.
              a.inspect.enable(true, { courier: 'unchanged' }); a.inspect.timeScale(0);
              let previous = 0; const start = performance.now();
              while (performance.now() - start < 6000) {
                const now = await new Promise<number>(r => requestAnimationFrame(r)), p = a.perf();
                if (previous && now - start > 1000) { frames.push(now - previous); render.push(p.renderCpuMs); update.push(p.updateCpuMs); }
                previous = now;
              }
              const q = (v: number[], p: number) => v.sort((a,b) => a-b)[Math.ceil(v.length * p) - 1];
              return { frames: frames.length, frameP50: q(frames, .5), frameP95: q(frames, .95), renderP95: q(render, .95), updateP95: q(update, .95), perf: a.perf() };
            }));
            if (profileSession) { const { profile } = await profileSession.send('Profiler.stop'); writeFileSync(`${out}/${name}.cpuprofile`, JSON.stringify(profile)); await profileSession.detach(); }
            rows.push({ name, setup, state, samples, errors: session.errors });
            writeFileSync(`${out}/evidence.json`, JSON.stringify(rows, (key, value) => ['profile', 'profileAssets', 'loadTiming', 'nodeBuildMaterials'].includes(key) ? undefined : value, 2));
            console.log(`${name}: ${state.corpses} corpses, ${state.meshes.length} pages${timing ? ` ${JSON.stringify(samples.map(s => s.frameP95))} ms p95` : ''}`);
          }
        }
        assert.deepEqual(session.errors, []);
      } finally { await session.close(); }
    }
  }
} finally { stopServer(); }
