/** L7 diagnostic profiles and deterministic image/population controls.
 * Production preview only; quiet-run.sh -> e2e-lock.sh, one browser at a time.
 * SCENE_DIST selects the preserved baseline. Acceptance tests stay unchanged.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';

const out = process.env.L7_AUDIT_OUT ?? 'test-results/l7-perf/audit';
const profile = process.env.L7_AUDIT_PROFILE === '1';
mkdirSync(out, { recursive: true });
try {
  for (const backend of (process.env.L7_AUDIT_BACKEND ? [process.env.L7_AUDIT_BACKEND as 'webgl2' | 'webgpu'] : ['webgl2', 'webgpu'] as const)) {
    for (const tier of (profile ? ['low'] as const : ['high', 'low'] as const)) {
      const session = new SceneSession({ backend, tier, nativeFrameTiming: profile, phone: tier === 'low', seed: 29,
        viewport: tier === 'low' ? { width: 390, height: 844 } : { width: 1600, height: 900 },
        query: { loadProfile: '2', profile: '1' } });
      try {
        await session.open();
        // tsx's function-name helper is needed by functions serialized by Playwright.
        await session.page.evaluate('globalThis.__name = (fn) => fn');
        const cdp = await session.page.context().newCDPSession(session.page);
        if (profile) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        for (const scenario of ['horde', 'rocket'] as const) {
          const label = `${scenario}-${backend}-${tier}`;
          // cpuProfile installs wrappers once per Game. A new document gives
          // the next workload its own crowd/NPC wrappers after level disposal.
          if (profile && scenario === 'rocket') {
            await session.page.reload();
            await session.page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
            await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
            await session.page.evaluate('globalThis.__name = (fn) => fn');
          }
          await session.page.evaluate(async ({ scenario, tier }) => {
            const a = window.__SS__!;
            a.settings.set({ quality: tier });
            if (scenario === 'horde') {
              await a.loadLevel('L7', { seed: 29, progression: 'L7-default' }); a.pause();
              a.setLoadout(['weapon.bat'], ['weapon.rocket-launcher']); await a.step(2);
              a.teleport('player', { x: -48, z: 46 });
              a.getState().l7!.roster.forEach((r, i) => a.teleport(r.id, { x: -45 + Math.floor(i / 3) * 1.2, z: 46 + (i % 3 - 1) * 1.2 }));
              a.camera.cinematic({ position: [-22, 24, 68], target: [-48, 0, 46] }, true);
            } else {
              await a.loadScenario(tier === 'high' ? 'perf-horde-200' : 'perf-horde-100', { seed: 29 }); a.pause();
              a.camera.preset('perf-horde');
            }
            a.cheats.god(true); a.settings.set({ slowMotion: false }); a.debug.figureJoints(false);
            await a.screenshotReady();
          }, { scenario, tier });
          if (profile) {
            await session.page.evaluate(async () => {
              const a = window.__SS__!; a.resume();
              const start = performance.now(); while (performance.now() - start < 3000) await new Promise(requestAnimationFrame);
              a.pause(); a.debug.cpuProfile();
            });
            await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
            const result = await session.page.evaluate(async ({ scenario, tier }) => {
              const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
              const builds = a.perf().nodeBuilds, samples: unknown[] = [];
              let previous = 0, blastAt = 0, probeAt = 0, blastCpu = 0, spawnCpu = 0;
              a.resume(); const start = performance.now();
              while (performance.now() - start < 8000) {
                const now = await new Promise<number>(requestAnimationFrame), p = a.perf();
                samples.push({ ms: previous ? now - previous : 0, tick: a.tick(), sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs, blastCpu, spawnCpu, builds: p.nodeBuilds - builds, costs: a.debug.cpuProfile() }); previous = now;
                blastCpu = spawnCpu = 0;
                if (now - blastAt >= 1250) {
                  const target = scenario === 'horde' ? { x: -64, z: 46 } : p.infected?.firstLiveId ? a.getEntity(p.infected.firstLiveId)!.transform : { x: 10, z: 0 };
                  const blastStart = performance.now(); a.explosions.blast('explosion.rocket', target); blastCpu = performance.now() - blastStart; blastAt = now;
                }
                if (scenario === 'rocket' && now - probeAt >= 100) {
                  probeAt = now; const ai = a.perf().infected!, missing = Math.min((tier === 'high' ? 200 : 100) - ai.liveCount, ai.available);
                  const spawnStart = performance.now();
                  for (let i = 0; i < missing; i++) a.spawn('infected.runner', { x: 8 + i % 10 * .5, z: -2 + Math.floor(i / 10) * .25 });
                  spawnCpu = performance.now() - spawnStart;
                }
              }
              a.pause();
              // Separate paused GPU draws after the CPU window: query/readback
              // overhead is never part of acceptance or CPU frame samples.
              const renderBackend = game.view.renderer.backend as unknown as { trackTimestamp: boolean };
              const tracked = renderBackend.trackTimestamp, gpuMs: number[] = [];
              renderBackend.trackTimestamp = true;
              try {
                for (let i = 0; i < 12; i++) {
                  game.view.renderer.nextNodeFrame(); game.view.update(1);
                  const ms = await game.view.renderer.resolveTimestampsAsync('render');
                  if (ms !== undefined) gpuMs.push(ms);
                }
              } finally { renderBackend.trackTimestamp = tracked; }
              return { label: scenario, samples, gpuMs, perf: a.perf(), renderer: game.view.renderer.diagnostics() };
            }, { scenario, tier });
            writeFileSync(`${out}/${label}.cpuprofile`, JSON.stringify((await cdp.send('Profiler.stop')).profile));
            writeFileSync(`${out}/${label}.json`, JSON.stringify(result));
            console.log(`${label}: profile saved`);
          } else {
            for (const moment of ['before', 'blast', 'settled'] as const) {
              const census = await session.page.evaluate(async ({ moment, scenario }) => {
                const a = window.__SS__!;
                if (moment === 'before') await a.step(180);
                else if (moment === 'blast') { a.explosions.blast('explosion.rocket', scenario === 'horde' ? { x: -64, z: 46 } : { x: 10, z: 0 }); await a.step(8); }
                else await a.step(120);
                await a.screenshotReady();
                return { tick: a.tick(), perf: a.perf(), figures: a.crowdFigures(), entities: a.query({}).map(e => ({ id: e.id, archetype: e.archetype, health: e.health, transform: e.transform, corpse: e.corpse })) };
              }, { moment, scenario });
              await session.page.locator('canvas').screenshot({ path: `${out}/${label}-${moment}.png` });
              writeFileSync(`${out}/${label}-${moment}.json`, JSON.stringify(census));
              console.log(`${label}-${moment}: tick ${census.tick}`);
            }
          }
          if (session.errors.length) throw Error(session.errors.join('\n'));
        }
        await cdp.detach();
      } finally { await session.close(); }
    }
  }
} finally { stopServer(); }
