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
const rocket = process.argv.includes('--rocket');
const phone = process.argv.includes('--phone');
const maxZoom = rocket ? 2 : 1.5;
if (timing) process.env.SCENE_SERVER ??= 'preview';
const output = rocket ? 'test-results/ui-radar-zoom' : 'test-results/zoom-out-15';
mkdirSync(output, { recursive: true });
const failures: string[] = [];
const backends: Backend[] = process.env.ZOOM_BACKEND ? [process.env.ZOOM_BACKEND as Backend] : ['webgl2', 'webgpu'];
const tiers = process.env.ZOOM_TIER ? [process.env.ZOOM_TIER as 'high' | 'low'] : ['high', 'low'] as const;
const levels = (process.env.ZOOM_LEVELS ?? (rocket ? 'L7,L8,L10' : 'L1,L2,L3,L4,L5,L6,L7,L8')).split(',');
try {
  for (const backend of backends) for (const tier of tiers) {
    const resultFile = `${output}/${timing ? 'timing' : phone ? 'phone' : 'captures'}-${backend}-${tier}.json`;
    const previous = existsSync(resultFile) ? JSON.parse(readFileSync(resultFile, 'utf8')) as { name: string }[] : [];
    const results: unknown[] = previous.filter(row => !levels.some(level => row.name.startsWith(`${level}-`)));
    const session = new SceneSession({ backend, tier, nativeFrameTiming: timing, phone, viewport: phone ? { width: 390, height: 844 } : { width: 1600, height: 900 } });
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
        await session.page.evaluate(async ({ level, tier, rocket }) => {
          const a = window.__SS__!; await a.ready; a.pause(); a.settings.set({ quality: tier });
          const progression = ['L2','L3','L4','L5','L6','L8'].includes(level) ? `${level}-default` as 'L2-default' : undefined;
          await a.loadLevel(level, { seed: 2, progression, ...(rocket && level === 'L10' ? { checkpoint: 'cure-corridor' } : {}) });
          if (a.missions.state()?.phase === 'briefing') a.missions.begin();
          a.cheats.god(true); a.pause();
          if (rocket && level === 'L10') {
            // Authored checkpoints preserve the acquired arsenal and valid campaign saves.
            const hand = a.getState().player!.weapons!.RIGHT, index = hand.rack.findIndex(slot => slot.id === 'weapon.rocket-launcher');
            if (index < 0) throw new Error('Cure corridor checkpoint lacks rockets');
            a.input.set({ selectedSlot: { side: 'RIGHT', index } }); await a.step(1); a.input.clear();
          } else if (rocket) { a.setLoadout(['weapon.rocket-launcher'], ['weapon.fire-axe']); await a.step(1); }
          // The convoy owns its camera; the first freely playable L4 spot is arrival.
          if (level === 'L4') { a.cheats.completeObjective('ride'); await a.step(120); }
        }, { level, tier, rocket });
        await session.page.mouse.move(phone ? 195 : 800, phone ? 422 : 450);
        for (let i = 0; i < 6; i++) await session.page.mouse.wheel(0, 120);
        await session.page.evaluate(() => window.__SS__!.step(90));
        for (const spot of rocket && level === 'L10' ? ['start', 'fight', 'finale', 'epilogue'] : ['start', 'fight', 'finale']) {
          if (spot !== 'start') await session.page.evaluate(async ({ level, spot, anchors, rocket }) => {
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
            if (rocket && level === 'L10' && spot === 'epilogue') {
              // Match the existing E32 ending fixture, including its late camera pull.
              await a.step(6000); a.cheats.killAll(); await a.step(2);
              a.input.set({ interact: true }); await a.step(1); a.input.clear(); await a.step(1);
              if (!a.missions.state()?.states['cure-released']) throw new Error('Cure was not released');
              await move(4002, -9);
              await a.step(Math.max(0, 8700 - a.missions.state()!.cureFront!.elapsed));
              return;
            }
            switch (level) {
              case 'L1': if (!final) { await finish(['pickup', 'deliver', 'escape']); await a.step(1200); await anchor('garage-door'); } else { await finish(['escape', 'weapon']); await anchor('fire-bay-door', -3); } break;
              case 'L2': if (!final) { await finish(['axe', 'calm', 'board', 'ride']); await anchor('l2-watch'); await a.step(600); } else { await finish(['doors']); await anchor('l2-gate', -5); } break;
              case 'L3': if (!final) { await finish(['armory']); await anchor('l3-yard'); await a.step(1500); } else { await finish(['defend']); await move(191, -2.6); await a.step(180); } break;
              case 'L4': if (!final) { await finish(['ride', 'quartermaster']); await anchor('l4-plaza'); await a.step(7200); } else { await finish(['hold']); await anchor('l4-cellar-door', -3); await a.step(300); } break;
              case 'L5': if (!final) { await finish(['emerge']); await a.step(660); await anchor('l5-plaza'); } else { await finish(['look']); await anchor('metro-entrance', -5); } break;
              case 'L6': if (!final) { await a.step(9000); await anchor('maintenance-a'); } else { await finish(['shelter', 'stop']); await anchor('exit-platform', -5); await a.step(600); } break;
              case 'L7':
                if (final) await anchor('l7-corridor-east', -24); // Beside the horde, 16 m clear of bus boarding.
                else await anchor('l7-alley');
                await a.step(600); if (!final) await approachFight(); break;
              case 'L10':
                if (final) {
                  await a.loadLevel('L10', { seed: 2, checkpoint: 'cure-disperse-ready' }); a.pause(); a.cheats.god(true);
                  const hand = a.getState().player!.weapons!.RIGHT, index = hand.rack.findIndex(slot => slot.id === 'weapon.rocket-launcher');
                  if (index < 0) throw new Error('Cure assault checkpoint lacks rockets');
                  a.input.set({ selectedSlot: { side: 'RIGHT', index } }); await a.step(1); a.input.clear();
                  await anchor('cure-console'); await a.step(5400);
                  a.input.set({ interact: true }); await a.step(1); a.input.clear();
                } else await anchor('corridor-breach');
                await a.step(600); break;
              case 'L8': if (!final) { await a.step(9000); await anchor('animal-elephant', 6); await approachFight(); } else { await anchor('exit', -8); await a.step(600); } break;
            }
          }, { level, spot, anchors, rocket });
          await session.page.mouse.move(phone ? 195 : 800, phone ? 422 : 450);
          for (let i = 0; i < 6; i++) await session.page.mouse.wheel(0, 120);
          await session.page.evaluate(async () => { const a = window.__SS__!; await a.step(90); await a.screenshotReady(); });
          const state = await session.page.evaluate(() => { const a = window.__SS__!; const s = a.getState(); return { level: s.scenario, camera: s.render.camera, mission: a.missions.state(), perf: a.perf(), player: s.player?.transform, weapons: s.player?.weapons, l7: s.l7, l8: s.l8 }; });
          const name = `${level}-${tier}-${backend}-${spot}${phone ? '-phone' : ''}`;
          if (rocket && state.mission?.phase !== 'playing') throw new Error(`${name}: expected gameplay, got ${state.mission?.phase}`);
          const equipped = state.weapons?.[state.weapons.selectedSide];
          if (rocket && equipped?.rack[equipped.index]?.id !== 'weapon.rocket-launcher') throw new Error(`${name}: rocket is not equipped`);
          if (state.level !== level || state.perf.backend !== (backend === 'webgl2' ? 'webgl' : 'webgpu')) throw new Error(`${name}: wrong level/backend ${state.level}/${state.perf.backend}`);
          if (Math.abs(state.camera.zoom - maxZoom) > .001) throw new Error(`${name}: maximum zoom was not reached (${state.camera.zoom})`);
          if (rocket) {
            const layout = await session.page.evaluate(() => {
              const rect = (selector: string) => { const e = document.querySelector<HTMLElement>(selector)!; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom, hidden: e.hidden }; };
              return { map: rect('.hud-map'), badge: rect('[data-testid=weather-icon]'), objective: rect('.hud-tracker'), survivors: document.querySelectorAll('.hud-pin-follower:not([hidden])').length };
            });
            if (layout.badge.y < layout.map.bottom + 2 || !layout.objective.hidden && layout.objective.y < layout.badge.bottom + 2 || Math.abs(layout.badge.x + layout.badge.width / 2 - layout.map.x - layout.map.width / 2) > 1) failures.push(`${name}: radar/badge/objective overlap or badge not centred: ${JSON.stringify(layout)}`);
            if (level === 'L7' && spot === 'start' && !layout.survivors) failures.push(`${name}: missing survivor pins`);
            writeFileSync(`${output}/${name}-layout.json`, JSON.stringify(layout, null, 2));
          }
          if (rocket && (state.perf.drawCalls > (tier === 'high' ? 600 : 300) || state.perf.triangles > (tier === 'high' ? 1500000 : 500000))) failures.push(`${name}: E18 capture counters failed`);
          if (rocket && state.perf.terrain && (state.perf.terrain.queued || state.perf.terrain.loading)) failures.push(`${name}: terrain did not finish loading`);
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
          let samples: { samples: number; frameP95: number; draws: number; triangles: number; level: string | null; tier: unknown; phase: string | undefined; shots: number; ticks: number; renderedFrames: number } | null = null;
          if (timing) samples = await session.page.evaluate(async rocket => {
            const a = window.__SS__!, frames: number[] = []; let previous = 0, draws = 0, triangles = 0;
            a.bot.stop();
            if (rocket) {
              const state = a.getState(), player = state.player!.transform;
              let x = 1, z = 0, distance = 30;
              for (const e of state.entities) if (e.faction === 'infected' && e.health.current > 0 && !e.hidden && !e.infected?.hidden) {
                const d = Math.hypot(e.transform.x - player.x, e.transform.z - player.z);
                if (d < distance && d > .1) { distance = d; x = (e.transform.x - player.x) / d; z = (e.transform.z - player.z) / d; }
              }
              a.input.set({ aim: { x, z }, aimSource: 'keyboard', left: { down: false, held: state.player!.weapons!.selectedSide === 'LEFT', up: false }, right: { down: false, held: state.player!.weapons!.selectedSide === 'RIGHT', up: false } });
            }
            a.resume(); const start = performance.now(), tick = a.tick(), rendered = a.perf().renderedFrames;
            while (performance.now() - start < 8000) {
              const now = await new Promise<number>(requestAnimationFrame), p = a.perf();
              if (previous && performance.now() - start > 2000) { frames.push(now - previous); draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles); }
              previous = now;
            }
            a.pause(); a.input.clear(); frames.sort((a,b) => a-b);
            return { samples: frames.length, frameP95: frames[Math.ceil(frames.length * .95) - 1], draws, triangles, level: a.getState().scenario, phase: a.missions.state()?.phase, shots: a.events(tick).filter(e => e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.rocket-launcher').length, tier: a.perf().quality, ticks: a.tick() - tick, renderedFrames: a.perf().renderedFrames - rendered };
          }, rocket);
          if (rocket && spot !== 'epilogue' && samples && samples.shots < 3) failures.push(`${name}: rocket firing did not advance`);
          if (state.perf.quality.tier !== tier) failures.push(`${name}: wrong quality tier`);
          if (samples && (samples.samples < 100 || samples.ticks < 240 || samples.renderedFrames < 100 || samples.frameP95 > (tier === 'high' ? 16.7 : 33.3) || samples.draws > (tier === 'high' ? 600 : 300) || samples.triangles > (tier === 'high' ? 1500000 : 500000) || samples.level !== level || rocket && samples.phase !== 'playing')) failures.push(`${name}: E18 budget failed`);
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
