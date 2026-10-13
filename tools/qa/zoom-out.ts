import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { compositions } from '../../src/levels/compositions';
import { levelTwoLayouts } from '../../src/levels/L2/layout';
import { levelThreeLayouts } from '../../src/levels/L3/layout';
import { levelFourLayouts } from '../../src/levels/L4/layout';
import { levelFiveLayouts } from '../../src/levels/L5/layout';
import { levelSevenLayouts } from '../../src/levels/L7/layout';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { SceneSession, origin, stopServer, type Backend } from '../scenelab/session';

/** Real campaign zoom audit. Run captures under e2e-lock; --timing under quiet-run. */
// Build first: native timing measures the production bundle, with the real HUD.
const timing = process.argv.includes('--timing');
if (timing) process.env.SCENE_SERVER ??= 'preview';
const output = 'test-results/zoom-out-15';
mkdirSync(output, { recursive: true });
const failures: string[] = [];
const backends: Backend[] = process.env.ZOOM_BACKEND ? [process.env.ZOOM_BACKEND as Backend] : ['webgl2', 'webgpu'];
const tiers = process.env.ZOOM_TIER ? [process.env.ZOOM_TIER as 'high' | 'low'] : ['high', 'low'] as const;
const levels = (process.env.ZOOM_LEVELS ?? 'L1,L2,L3,L4,L5,L6,L7,L8').split(',');
try {
  for (const backend of backends) for (const tier of tiers) {
    const resultFile = `${output}/${timing ? 'timing' : 'captures'}-${backend}-${tier}.json`;
    const previous = existsSync(resultFile) ? JSON.parse(readFileSync(resultFile, 'utf8')) as { name: string }[] : [];
    const results: unknown[] = previous.filter(row => !levels.some(level => row.name.startsWith(`${level}-`)));
    const session = new SceneSession({ backend, tier, nativeFrameTiming: true, viewport: { width: 1600, height: 900 } });
    try {
      await session.open();
      for (const level of levels) {
        const composition = compositions[level];
        const base = composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8')) as DistrictLayout);
        const layouts = level === 'L2' ? levelTwoLayouts(base, null) : level === 'L3' ? levelThreeLayouts(base) : level === 'L4' ? levelFourLayouts(base) : level === 'L5' ? levelFiveLayouts(base) : level === 'L7' ? levelSevenLayouts(base) : base;
        const anchors = Object.fromEntries(composition.districts.flatMap(d => Object.entries(layouts.find(l => l.district === d.id)!.anchors).map(([name, a]) => [name, [a.position[0] + d.origin[0], a.position[1], a.position[2] + d.origin[1]]])));
        const cells: { frame: number; jpeg: Buffer }[] = [];
        const errorStart = session.errors.length;
        await session.page.goto(`${origin}/?test=1&ui=1&profile=1&level=${level}&${backend === 'webgl2' ? 'renderer=webgl&' : ''}quality=${tier}&audio=muted&dpr=1&seed=2`);
        await session.page.waitForFunction(() => !!window.__SS__, null, { timeout: 120000 });
        await session.page.evaluate('globalThis.__name = (fn) => fn');
        await session.page.evaluate(async ({ level, tier }) => {
          const a = window.__SS__!; await a.ready; a.pause(); a.settings.set({ quality: tier });
          const progression = ['L2','L3','L4','L5','L6','L8'].includes(level) ? `${level}-default` as 'L2-default' : undefined;
          await a.loadLevel(level, { seed: 2, progression });
          if (a.missions.state()?.phase === 'briefing') a.missions.begin();
          a.cheats.god(true); a.pause();
          // The convoy owns its camera; the first freely playable L4 spot is arrival.
          if (level === 'L4') { a.cheats.completeObjective('ride'); await a.step(120); }
        }, { level, tier });
        await session.page.mouse.move(800, 450);
        for (let i = 0; i < 6; i++) await session.page.mouse.wheel(0, 120);
        await session.page.evaluate(() => window.__SS__!.step(90));
        for (const spot of ['start', 'fight', 'finale']) {
          if (spot !== 'start') await session.page.evaluate(async ({ level, spot, anchors }) => {
            const a = window.__SS__!, final = spot === 'finale';
            const finish = async (ids: string[]) => { for (const id of ids) { if (a.missions.state()?.steps[id]?.status === 'completed') continue; a.cheats.completeObjective(id); await a.step(1); } };
            const move = async (x: number, z: number) => { a.missions.teleport('player', { x, z }); a.camera.follow(); await a.step(120); };
            const anchor = async (name: string, dx = 0) => {
              const at = anchors[name];
              if (!at) throw new Error(`Missing audit anchor ${level}/${name}`);
              await move(at[0] + dx, at[2]);
            };
            const approachFight = async () => {
              // Walk into an existing encounter; never stage the courier inside an animal's body.
              for (let second = 0; second < 20; second++) {
                const state = a.getState(), player = state.player!.transform;
                const threats = state.entities.filter(e => e.faction === 'infected' && e.health.current > 0 && !e.hidden && !e.infected?.hidden);
                threats.sort((b, c) => Math.hypot(b.transform.x - player.x, b.transform.z - player.z) - Math.hypot(c.transform.x - player.x, c.transform.z - player.z));
                const target = threats[0]?.transform; if (!target || Math.hypot(target.x - player.x, target.z - player.z) < 8) break;
                a.input.set({ moveTarget: { x: target.x + 5, z: target.z } }); await a.step(60);
              }
              a.input.clear(); await a.step(60);
            };
            switch (level) {
              case 'L1': if (!final) { await finish(['pickup', 'deliver', 'escape']); await a.step(1200); await anchor('garage-door'); } else { await finish(['escape', 'weapon']); await anchor('fire-bay-door', -3); } break;
              case 'L2': if (!final) { await finish(['axe', 'calm', 'board', 'ride']); await anchor('l2-watch'); await a.step(600); } else { await finish(['doors']); await anchor('l2-gate', -5); } break;
              case 'L3': if (!final) { await finish(['armory']); await anchor('l3-yard'); await a.step(1500); } else { await finish(['defend']); await move(191, -2.6); await a.step(180); } break;
              case 'L4': if (!final) { await finish(['ride', 'quartermaster']); await anchor('l4-plaza'); await a.step(7200); } else { await finish(['hold']); await anchor('l4-cellar-door', -3); await a.step(300); } break;
              case 'L5': if (!final) { await finish(['emerge']); await a.step(660); await anchor('l5-plaza'); } else { await finish(['look']); await anchor('metro-entrance', -5); } break;
              case 'L6': if (!final) { await a.step(9000); await anchor('maintenance-a'); } else { await finish(['shelter', 'stop']); await anchor('exit-platform', -5); await a.step(600); } break;
              case 'L7': await anchor(final ? 'l7-corridor-west' : 'l7-alley'); await a.step(600); if (!final) await approachFight(); break;
              case 'L8': if (!final) { await a.step(9000); await anchor('animal-elephant', 6); await approachFight(); } else { await anchor('exit', -8); await a.step(600); } break;
            }
          }, { level, spot, anchors });
          await session.page.mouse.move(800, 450);
          for (let i = 0; i < 6; i++) await session.page.mouse.wheel(0, 120);
          await session.page.evaluate(async () => { const a = window.__SS__!; await a.step(90); await a.screenshotReady(); });
          const state = await session.page.evaluate(() => { const a = window.__SS__!; const s = a.getState(); return { level: s.scenario, camera: s.render.camera, mission: a.missions.state(), perf: a.perf(), player: s.player?.transform, l7: s.l7, l8: s.l8 }; });
          const name = `${level}-${tier}-${backend}-${spot}`;
          if (state.level !== level || state.perf.backend !== (backend === 'webgl2' ? 'webgl' : 'webgpu')) throw new Error(`${name}: wrong level/backend ${state.level}/${state.perf.backend}`);
          if (Math.abs(state.camera.zoom - 1.5) > .001) throw new Error(`${name}: maximum zoom was not reached (${state.camera.zoom})`);
          const screenshot = await session.page.screenshot({ path: `${output}/${name}.png` });
          // A rejected WebGPU submission can leave only DOM HUD and health bars.
          // Counters still report draws, so require visible scenery as well.
          const png = PNG.sync.read(screenshot), colors = new Map<string, number>();
          let pixels = 0;
          for (let y = Math.floor(png.height * .2); y < png.height * .85; y += 8) for (let x = Math.floor(png.width * .1); x < png.width * .9; x += 8) {
            const i = (y * png.width + x) * 4, key = `${png.data[i] >> 2},${png.data[i + 1] >> 2},${png.data[i + 2] >> 2}`;
            colors.set(key, (colors.get(key) ?? 0) + 1); pixels++;
          }
          const backgroundShare = Math.max(...colors.values()) / pixels;
          if (backgroundShare > .97) failures.push(`${name}: scenery missing (${(backgroundShare * 100).toFixed(1)}% flat background)`);
          cells.push({ frame: cells.length, jpeg: await session.page.screenshot({ type: 'jpeg', quality: 85 }) });
          let samples: { samples: number; frameP95: number; draws: number; triangles: number; level: string | null; tier: unknown; ticks: number; renderedFrames: number } | null = null;
          if (timing) samples = await session.page.evaluate(async () => {
            const a = window.__SS__!, frames: number[] = []; let previous = 0, draws = 0, triangles = 0;
            a.bot.stop(); a.resume(); const start = performance.now(), tick = a.tick(), rendered = a.perf().renderedFrames;
            while (performance.now() - start < 8000) {
              const now = await new Promise<number>(requestAnimationFrame), p = a.perf();
              if (previous && performance.now() - start > 2000) { frames.push(now - previous); draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles); }
              previous = now;
            }
            a.pause(); frames.sort((a,b) => a-b);
            return { samples: frames.length, frameP95: frames[Math.ceil(frames.length * .95) - 1], draws, triangles, level: a.getState().scenario, tier: a.perf().quality, ticks: a.tick() - tick, renderedFrames: a.perf().renderedFrames - rendered };
          });
          if (state.perf.quality.tier !== tier) failures.push(`${name}: wrong quality tier`);
          if (samples && (samples.samples < 100 || samples.ticks < 240 || samples.renderedFrames < 100 || samples.frameP95 > (tier === 'high' ? 16.7 : 33.3) || samples.draws > (tier === 'high' ? 600 : 300) || samples.triangles > (tier === 'high' ? 1500000 : 500000) || samples.level !== level)) failures.push(`${name}: E18 budget failed`);
          if (session.errors.length > errorStart) failures.push(`${name}: browser errors`);
          results.push({ name, ...state, backgroundShare, samples, errors: session.errors.slice(errorStart) });
          writeFileSync(resultFile, JSON.stringify(results, null, 2));
          console.log(`${name}: zoom=${state.camera.zoom.toFixed(3)} radius=${state.camera.radius.toFixed(1)} draws=${state.perf.drawCalls} tris=${state.perf.triangles} ${samples ? JSON.stringify(samples) : ''}`);
        }
        await session.makeSheet(cells, `${output}/${level}-${tier}-${backend}-sheet.jpg`, 640, 600);
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }

if (failures.length) throw new Error(failures.join('\n'));
