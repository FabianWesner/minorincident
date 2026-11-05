/** Matched L5 population/load/frame census. Run each build under tools/perf/quiet-run.sh. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { origin, SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import { poolUrl } from '../browser-pool/client';
import { dodgeWalkKeys, markerWalkKeys } from './input';

const requested = process.argv[2];
assert(requested === 'prod' || requested === 'candidate' || requested === 'pair');
const selectedTier = process.argv[3]; assert(!selectedTier || selectedTier === 'low' || selectedTier === 'high');
assert(requested !== 'pair' || selectedTier, 'a paired run requires one tier to stay within the reservation cap');
const tiers: ('low' | 'high')[] = selectedTier ? [selectedTier as 'low' | 'high'] : ['low', 'high'];
const variants: ('prod' | 'candidate')[] = requested === 'pair' ? ['prod', 'candidate'] : [requested];
const out = 'test-results/l5-density'; mkdirSync(`${out}/captures`, { recursive: true });
// A queued capture's dev server must never silently become a timing run's preview server.
let occupied = false;
try { occupied = (await fetch(origin)).ok; } catch { /* reserved port is free */ }
assert(!occupied, 'reserved scene port is occupied; finish the other capture before timing');
try { for (const variant of variants) {
execFileSync(process.execPath, ['tools/playtest/l5-density-build.mjs', variant], { stdio: 'inherit' });
for (const tier of tiers) {
  const session = new SceneSession({ backend: 'webgpu', tier, query: { test: 'poses', testApi: '1', ui: '1', loadProfile: '2', crowdProbe: 'drawn' } });
  try {
    await session.open(); await session.page.evaluate('window.__name = f => f');
    const load = await session.page.evaluate(async tier => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
      a.settings.set({ quality: tier, muted: true });
      const start = performance.now(); await a.loadLevel('L5', { seed: 1 }); const wallMs = performance.now() - start;
      a.pause(); const builds = { ...a.perf().nodeBuildMaterials };
      a.missions.begin(); game.ui.show(null);
      document.documentElement.setAttribute('data-scene-hud', ''); document.querySelector('.hud')!.setAttribute('data-scene-hud', '');
      a.missions.completeObjective('emerge'); await a.step(1); // consume the authored exit teleport before placing the benchmark start
      a.teleport(1, { x: -8, z: 18 }); a.camera.follow(); a.camera.zoom(1.5);
      const rack = game.world.combat!.runner.loadout.state;
      game.world.combat!.setLoadout(rack.LEFT.rack.map(s => s.id), ['weapon.shotgun', ...rack.RIGHT.rack.map(s => s.id)]);
      game.world.combat!.runner.loadout.state.selectedSide = 'RIGHT';
      await a.screenshotReady();
      // Prepare navigation outside the timed interval; the measured loop only follows this tape with WASD.
      const nav = game.world.infected!.nav.forPlayer(.55), route = [];
      let from = nav.nearestCell(-8, 18, .55);
      for (const [x, z] of [[-26, -2.7], [-40, -20], [-46, -37.5], [-17, -24], [2, 14], [-8, 18]]) {
        const cells: number[] = [];
        if (!nav.reachPath(from, { x, z }, cells)) throw new Error('unreachable benchmark street');
        if (!cells.length) throw new Error('empty benchmark leg');
        route.push(cells.map(cell => ({ x: nav.x(cell), z: nav.z(cell) })));
        from = cells.at(-1)!;
      }
      (window as unknown as { __densityTape: typeof route }).__densityTape = route;
      return { wallMs, timing: game.perf().loadTiming, phases: performance.getEntriesByType('measure').filter(e => /^(view:|level:)/.test(e.name)).map(e => ({ name: e.name, ms: e.duration })), crowdPreparation: game.perf().crowdPreparation,
        builds, backend: a.getState().render.backend, quality: a.getState().render.quality,
        route: route.map(leg => leg.at(-1)!) };
    }, tier);
    assert.equal(load.backend, 'webgpu'); assert.equal(load.quality, tier);
    for (const zoom of [1.5, .5]) {
      await session.page.evaluate(async zoom => { const a = window.__SS__!; a.camera.zoom(zoom); await a.screenshotReady(); }, zoom);
      await session.page.screenshot({ path: `${out}/captures/${variant}-${tier}-z${zoom}-density.jpg`, type: 'jpeg', quality: 72 });
    }
    await session.page.evaluate(async () => { window.__SS__!.camera.zoom(1.5); await window.__SS__!.screenshotReady(); });
    await session.page.evaluate(() => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
      const census = (second: number) => {
        const live = game.world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected!.hidden);
        const drawn = new Set(game.view.crowdFigures().filter(f => f.drawn).map(f => f.id));
        return { second, tick: a.tick(), alive: live.length, drawn: live.filter(e => drawn.has(e.id)).length,
          corpses: [...game.world.entities.iterate()].filter(e => e.infected && e.health.current <= 0).map(e => e.id),
          permanentCorpses: [...game.world.entities.iterate()].filter(e => e.infected && e.corpse).map(e => e.id),
          player: { ...game.world.entities.get(1)!.transform }, hp: game.world.entities.get(1)!.health.current };
      };
      const state = { frames: [] as number[], spikes: [] as unknown[], observationMaxMs: 0, samples: [census(0)], start: performance.now(), done: false, deaths: 0 };
      (window as unknown as { __densityPerf: typeof state }).__densityPerf = state;
      game.world.events.on('player.died', () => state.deaths++);
      let previous = performance.now();
      const frame = (now: number) => {
        const ms = now - previous; state.frames.push(ms); previous = now;
        if (ms > 25) state.spikes.push({ second: (now - state.start) / 1000, ms, tick: a.tick(), simMs: game.simMs, simTickMs: game.simTickMs, simTicks: game.simTicks,
          viewUpdateMs: game.view.updateCpuMs, renderMs: game.view.renderCpuMs, uiMs: game.ui.updateMs, alive: game.world.infected!.director.count,
          player: { x: game.world.entities.get(1)!.transform.x, z: game.world.entities.get(1)!.transform.z } });
        const elapsed = (now - state.start) / 1000;
        if (state.samples.length === 1 && elapsed >= 60) state.samples.push(census(60));
        if (elapsed >= 180) { state.samples.push(census(180)); state.done = true; a.pause(); }
        else requestAnimationFrame(frame);
      };
      a.resume(); requestAnimationFrame(frame);
    });
    let movement: string[] = [], firing = false, routeIndex = 0, passed = 0, pulse = 0;
    let movedAt = Date.now(), position = { x: Infinity, z: Infinity };
    const started = Date.now(), conditions: { second: number; busy: unknown[]; load: number[] }[] = []; let nextConditions = 0;
    while (Date.now() - started < 195_000) {
      if (process.env.MI_BROWSER_POOL_EXCLUSIVE && Date.now() >= nextConditions) {
        const response = await fetch(`${poolUrl()}/exclusive/${process.env.MI_BROWSER_POOL_EXCLUSIVE}?quiet=1`);
        const status = await response.json() as { conditions: { busy: unknown[]; load: number[] } };
        conditions.push({ second: (Date.now() - started) / 1000, busy: status.conditions.busy, load: status.conditions.load }); nextConditions = Date.now() + 10000;
        if (status.conditions.busy.length) break;
      }
      const observation = await session.page.evaluate(routeIndex => {
        const observeStart = performance.now();
        const state = (window as unknown as { __densityPerf: { done: boolean; observationMaxMs: number } }).__densityPerf;
        const game = (window.__SCENE__ as unknown as { game: Game }).game, player = game.world.entities.get(1)!;
        const root = window as unknown as { __densityTape: { x: number; z: number }[][]; __densityLeg?: number; __densityIndex?: number };
        const leg = root.__densityTape[routeIndex], goal = leg.at(-1)!;
        if (root.__densityLeg !== routeIndex) { root.__densityLeg = routeIndex; root.__densityIndex = 0; }
        const nav = game.world.infected!.nav.forPlayer(.55);
        let index = root.__densityIndex!;
        while (index < leg.length - 1 && Math.hypot(player.transform.x - leg[index].x, player.transform.z - leg[index].z) < .7) index++;
        for (let i = Math.min(leg.length - 1, index + 20); i > index; i--) {
          if (nav.visible(player.transform, leg[i], .55)) { index = i; break; }
        }
        root.__densityIndex = index;
        const next = leg[index];
        const from = window.__SS__!.input.project(player.transform, 'player'), to = window.__SS__!.input.project(next, 'player');
        const drawn = new Set(game.view.crowdFigures().filter(f => f.drawn).map(f => f.id));
        const target = game.world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && drawn.has(e.id) && game.world.infected!.nav.visible(player.transform, e.transform, .1))
          .sort((a, b) => Math.hypot(a.transform.x - player.transform.x, a.transform.z - player.transform.z) - Math.hypot(b.transform.x - player.transform.x, b.transform.z - player.transform.z))[0];
        const p = target && game.view.project(target.transform.x, target.transform.y + .6, target.transform.z);
        state.observationMaxMs = Math.max(state.observationMaxMs, performance.now() - observeStart);
        return { position: { x: player.transform.x, z: player.transform.z }, done: state.done, dx: to.x - from.x, dy: to.y - from.y, d: Math.hypot(player.transform.x - goal.x, player.transform.z - goal.z), aim: p && p[2] >= -1 && p[2] <= 1 ? [(p[0] + 1) * innerWidth / 2, (1 - p[1]) * innerHeight / 2] : null };
      }, routeIndex);
      if (observation.done) break;
      if (observation.d < 2.5) { routeIndex = (routeIndex + 1) % load.route.length; passed++; }
      if (Math.hypot(observation.position.x - position.x, observation.position.z - position.z) > .6) { movedAt = Date.now(); position = observation.position; }
      const keys = Date.now() - movedAt > 3000 ? dodgeWalkKeys(observation.dx, observation.dy, 1 + Math.floor((Date.now() - movedAt) / 1600) % 3) : markerWalkKeys(observation.dx, observation.dy, (pulse++ % 8) / 8);
      for (const key of movement) if (!keys.includes(key)) await session.page.keyboard.up(key);
      for (const key of keys) if (!movement.includes(key)) await session.page.keyboard.down(key);
      movement = keys;
      const aim = observation.aim;
      if (aim && aim[0] > 250 && aim[0] < 1100 && aim[1] > 80 && aim[1] < 580) {
        await session.page.mouse.move(aim[0], aim[1]); if (!firing) { await session.page.mouse.down(); firing = true; }
      } else if (firing) { await session.page.mouse.up(); firing = false; }
      await new Promise(r => setTimeout(r, 150));
    }
    for (const key of movement) await session.page.keyboard.up(key); if (firing) await session.page.mouse.up();
    const result = await session.page.evaluate(loaded => {
      const state = (window as unknown as { __densityPerf: { done: boolean; frames: number[]; spikes: unknown[]; observationMaxMs: number; samples: { permanentCorpses: number[] }[]; deaths: number } }).__densityPerf;
      const frames = state.frames.sort((a, b) => a - b), a = window.__SS__!, after = a.perf();
      a.pause();
      return { done: state.done, spikes: state.spikes, observationMaxMs: state.observationMaxMs, samples: state.samples, deaths: state.deaths, missingCorpses: state.samples[1]?.permanentCorpses.filter(id => !state.samples.at(-1)!.permanentCorpses.includes(id)), frame: { count: frames.length, max: Number(frames.at(-1)?.toFixed(3)), p95: Number(frames[Math.floor(frames.length * .95)]?.toFixed(3)), p99: Number(frames[Math.floor(frames.length * .99)]?.toFixed(3)) },
        buildsSinceLoad: Object.entries(after.nodeBuildMaterials).filter(([key, n]) => n !== loaded[key]), perf: { drawCalls: after.drawCalls, triangles: after.triangles, nodeBuilds: after.nodeBuilds } };
    }, load.builds);
    writeFileSync(`${out}/${variant}-${tier}-performance.json`, JSON.stringify({ variant, tier, scenario: 'street-circuit-v3', waypointsReached: passed, route: load.route, load: { wallMs: load.wallMs, timing: load.timing, phases: load.phases, crowdPreparation: load.crowdPreparation, backend: load.backend, quality: load.quality, materialKeys: Object.keys(load.builds).length }, ...result, conditions, errors: session.errors }, null, 2));
    console.log(JSON.stringify({ variant, tier, loadMs: load.wallMs, ...result }));
    assert(conditions.every(row => row.busy.length === 0), 'foreign build/test/browser activity contaminated the quiet measurement');
    assert(result.done); assert(passed >= 4, 'visit at least four street waypoints'); assert.equal(result.deaths, 0); assert.deepEqual(result.missingCorpses, []); assert.deepEqual(result.buildsSinceLoad, []); assert.deepEqual(session.errors, []);
  } finally { await session.close(); }
} stopServer(); } } finally { stopServer(); }
if (requested === 'pair') {
  for (const tier of tiers) {
    const prod = JSON.parse(readFileSync(`${out}/prod-${tier}-performance.json`, 'utf8'));
    const candidate = JSON.parse(readFileSync(`${out}/candidate-${tier}-performance.json`, 'utf8'));
    assert(prod.scenario === 'street-circuit-v3' && candidate.scenario === prod.scenario);
    const comparison = { tier, loadDeltaMs: candidate.load.wallMs - prod.load.wallMs, prodMaxMs: prod.frame.max, candidateMaxMs: candidate.frame.max,
      loadPass: candidate.load.wallMs <= prod.load.wallMs + 500, framePass: candidate.frame.max <= prod.frame.max };
    writeFileSync(`${out}/${tier}-comparison.json`, JSON.stringify(comparison, null, 2)); console.log(JSON.stringify(comparison));
    assert(comparison.loadPass, 'L5 load must be at most PROD + 0.5 seconds');
    assert(comparison.framePass, 'maximum play frame must not be worse than PROD');
  }
}
