/** Known L5 route: read-only navigation observations; all gameplay uses physical WASD/mouse/E. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { launchProfile } from '../browser-pool/client';
import { dodgeWalkKeys, markerWalkKeys } from './input';
import type { Game } from '../../src/Game';
import type { L5State } from '../../src/sim/missions/types';

type Completion = { state: L5State; tick: number; hp: number; gateOpen: boolean; deaths: number; health: Record<number, number>; builds: Record<string, number>; events: unknown[] };

const out = 'test-results/playtest/l5-density-route', port = process.env.E2E_PORT ?? '4875', origin = `http://127.0.0.1:${port}`;
mkdirSync(`${out}/profile`, { recursive: true });
writeFileSync(`${out}/input.jsonl`, '');
const source = readFileSync('test-results/l5-density/l4-save.json');
const storage = JSON.parse(source.toString()); for (const row of storage.origins) row.origin = origin;
writeFileSync(`${out}/profile/pool-storage.json`, JSON.stringify(storage));
writeFileSync(`${out}/source.json`, JSON.stringify({ source: 'test-results/l5-density/l4-save.json', sha256: createHash('sha256').update(source).digest('hex') }));
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 120; i++) { try { if ((await fetch(origin)).ok) break; } catch { /* boot */ } await wait(250); }
let context: Awaited<ReturnType<typeof launchProfile>> | undefined;
try {
  context = await launchProfile(`${out}/profile`, { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'], viewport: { width: 1280, height: 720 } });
  const page = await context.newPage(); await page.addInitScript('window.__name = f => f');
  await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&quality=low&audio=muted&dpr=1&loadProfile=2`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120000 }); await page.evaluate(async () => { await window.__SS__!.ready; });
  await page.getByTestId('start-game').click(); await page.getByTestId('level-L5').click();
  await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-testid=level-transition]')?.hidden === true, null, { timeout: 120000 });
  if (await page.getByTestId('mission-button').isVisible()) await page.getByTestId('mission-button').click();
  const loaded = await page.evaluate(() => {
    window.__SS__!.camera.zoom(1.5);
    const root = window as unknown as { __densityRouteDeaths: number; __densityRouteCompletion?: Completion }; root.__densityRouteDeaths = 0;
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    game.world.events.on('player.died', () => root.__densityRouteDeaths++);
    game.world.events.on('level.completed', event => {
      if (event.type !== 'level.completed' || event.id !== 'L5') return;
      const mission = game.world.missions!, state = mission.state.l5!;
      root.__densityRouteCompletion = { state: structuredClone(state), tick: game.world.tick, hp: game.world.entities.get(1)!.health.current,
        gateOpen: mission.state.gates['l5-metro-shutter'], deaths: root.__densityRouteDeaths,
        health: Object.fromEntries(state.survivors.map(r => [r.id, game.world.entities.get(r.id)!.health.current])),
        builds: game.perf().nodeBuildMaterials, events: [...window.__SS__!.events(), event].filter(e => ['level.completed', 'player.died', 'l5.found'].includes(e.type)) };
    });
    return window.__SS__!.perf().nodeBuildMaterials;
  });
  const started = Date.now(); let held: string[] = [], firing = false, weapon = '', lastE = 0, previous = '', sample = 0, captures = 0, movedAt = Date.now(), position = { x: Infinity, z: Infinity }, result;
  const press = async (keys: string[]) => { for (const k of held) if (!keys.includes(k)) await page.keyboard.up(k); for (const k of keys) if (!held.includes(k)) await page.keyboard.down(k); held = keys; };
  while (Date.now() - started < 540000) {
    const seen = await page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world, a = window.__SS__!, m = w.missions!, s = m.state.l5;
      const completion = (window as unknown as { __densityRouteCompletion?: Completion }).__densityRouteCompletion;
      if (completion) return { done: true, level: w.scenario, completion };
      const player = w.entities.get(1)!, p = player.transform;
      if (!s || w.scenario !== 'L5') return { done: true, level: w.scenario };
      const survivors = s.survivors.map(r => ({ key: r.key, status: r.status, hp: w.entities.get(r.id)?.health.current, at: w.entities.get(r.id)!.transform }));
      const shotgun = w.combat!.runner.loadout.activeEntries().some(e => e.id === 'weapon.shotgun');
      const hidden = s.survivors.filter(r => r.status === 'hidden').sort((a, b) => {
        const x = m.def.anchors[`l5-ring-${a.key}`], y = m.def.anchors[`l5-ring-${b.key}`]; return Math.hypot(x.x - p.x, x.z - p.z) - Math.hypot(y.x - p.x, y.z - p.z);
      });
      const lagging = survivors.filter(r => r.status === 'following' && (r.hp ?? 0) > 0).sort((a, b) => Math.hypot(b.at.x - p.x, b.at.z - p.z) - Math.hypot(a.at.x - p.x, a.at.z - p.z))[0];
      const catchUp = lagging && Math.hypot(lagging.at.x - p.x, lagging.at.z - p.z) > 8;
      const goal = catchUp ? 'catch-up' : !shotgun && s.phase === 'cellar' ? 'l5-shotgun' : s.phase === 'cellar' ? 'l5-brace' : hidden.length ? `l5-ring-${hidden[0].key}` : 'l5-metro-in';
      const target = catchUp ? lagging.at : m.def.anchors[goal], d = Math.hypot(target.x - p.x, target.z - p.z), next = { x: p.x, z: p.z };
      w.infected!.nav.steer(p, target, { path: [], goal: -1, pathIndex: 0 }, .45, next, Infinity, true);
      const from = a.input.project(p, 'player'), to = a.input.project({ x: next.x, z: next.z }, 'player');
      const drawn = new Set(game.view.crowdFigures().filter(f => f.drawn).map(f => f.id));
      const humans = [p, ...survivors.filter(r => r.status === 'following').map(r => r.at)];
      const threats = w.infected!.active.filter(e => e.health.current > 0 && drawn.has(e.id) && !e.hidden && w.infected!.nav.visible(p, e.transform, .1)).map(e => {
        const q = game.view.project(e.transform.x, e.transform.y + .6, e.transform.z), x = (q[0] + 1) * innerWidth / 2, y = (1 - q[1]) * innerHeight / 2;
        return { id: e.id, x, y, dx: x - from.x, dy: y - from.y, d: Math.hypot(e.transform.x - p.x, e.transform.z - p.z), humanD: Math.min(...humans.map(h => Math.hypot(h.x - e.transform.x, h.z - e.transform.z))), visible: q[2] >= -1 && q[2] <= 1 && x > 250 && x < 1100 && y > 70 && y < 585 };
      }).filter(e => e.visible && e.d < 18).sort((a, b) => a.humanD - b.humanD);
      return { done: m.state.phase === 'progression', level: w.scenario, tick: w.tick, goal, d, dx: to.x - from.x, dy: to.y - from.y,
        position: { x: p.x, z: p.z }, hp: player.health.current, phase: s.phase, found: s.found, survivors, shotgun, selectedAction: w.combat!.runner.loadout.current(w.combat!.runner.loadout.state.selectedSide).id, threat: threats[0],
        metroAt: s.metroAt, shutterAt: s.shutterAt, doneAt: s.doneAt, gateOpen: m.state.gates['l5-metro-shutter'],
        deaths: (window as unknown as { __densityRouteDeaths: number }).__densityRouteDeaths,
        lag: Math.max(0, ...survivors.filter(r => r.status === 'following' && (r.hp ?? 0) > 0).map(r => Math.hypot(r.at.x - p.x, r.at.z - p.z))),
        events: a.events().filter(e => ['level.completed', 'player.died', 'l5.found'].includes(e.type)), builds: a.perf().nodeBuildMaterials };
    });
    if (seen.completion) {
      const c = seen.completion;
      result = { ...result, done: true, level: 'L5', nextLevel: seen.level, tick: c.tick, hp: c.hp, found: c.state.found, phase: c.state.phase,
        gateOpen: c.gateOpen, metroAt: c.state.metroAt, shutterAt: c.state.shutterAt, doneAt: c.state.doneAt, deaths: c.deaths, builds: c.builds, events: c.events,
        survivors: c.state.survivors.map(r => ({ key: r.key, status: r.status, hp: c.health[r.id] })) };
      break;
    }
    result = seen;
    const status = `${seen.phase}:${seen.found}:${seen.goal}`;
    if (status !== previous) { previous = status; console.log(JSON.stringify({ ...seen, builds: undefined })); await page.screenshot({ path: `${out}/stage-${seen.found ?? 'end'}-${seen.phase}.jpg`, type: 'jpeg', quality: 65 }); }
    if (seen.done) break;
    const p = seen.position!;
    if (Math.hypot(p.x - position.x, p.z - position.z) > .6) { movedAt = Date.now(); position = p; }
    const atGoal = seen.d! < (seen.goal === 'l5-metro-in' ? .55 : 1.2), blocked = Date.now() - movedAt > 3000;
    const keys = seen.threat && seen.threat.d < 2.5 ? dodgeWalkKeys(-seen.threat.dx, -seen.threat.dy) : atGoal || (seen.threat?.humanD ?? Infinity) < 8 || !seen.hp ? [] : blocked ? dodgeWalkKeys(seen.dx!, seen.dy!, 1 + Math.floor((Date.now() - movedAt) / 1600) % 3) : markerWalkKeys(seen.dx!, seen.dy!, (sample++ % 8) / 8);
    await press(keys);
    if (atGoal && seen.goal !== 'catch-up' && seen.phase !== 'metro' && Date.now() - lastE > 600) { await page.keyboard.press('KeyE'); lastE = Date.now(); }
    const threat = seen.threat;
    if (threat) {
      const closeShotgun = seen.shotgun && threat.d < 9; const key = closeShotgun ? 'Digit6' : 'Digit5'; if (seen.selectedAction !== (closeShotgun ? 'weapon.shotgun' : 'weapon.army-mg')) { await page.keyboard.press(key); weapon = key; }
      await page.mouse.move(threat.x, threat.y); if (!firing) { await page.mouse.down(); firing = true; }
    } else if (firing) { await page.mouse.up(); firing = false; }
    appendFileSync(`${out}/input.jsonl`, JSON.stringify({ tick: seen.tick, keys, aim: threat && [threat.x, threat.y], weapon, goal: seen.goal, d: seen.d, hp: seen.hp }) + '\n');
    if (++captures % 20 === 0) await page.screenshot({ path: `${out}/latest.jpg`, type: 'jpeg', quality: 55 });
    await wait(120);
  }
  await press([]); if (firing) await page.mouse.up();
  const buildsSinceLoad = Object.entries(result?.builds ?? {}).filter(([key, n]) => n !== loaded[key]);
  writeFileSync(`${out}/result.json`, JSON.stringify({ elapsedS: (Date.now() - started) / 1000, ...result, buildsSinceLoad }, null, 2));
  await page.screenshot({ path: `${out}/final.jpg`, type: 'jpeg', quality: 75 });
  assert(result?.done && result.found === 5, 'reach Metro after finding all five, without skips');
  assert.equal(result.deaths, 0, 'no player death on the route');
  assert(result.survivors?.some((r: { status: string; hp?: number }) => r.status === 'sheltered' && (r.hp ?? 0) > 0), 'escort does not wipe out');
} finally { await context?.close(); server.kill(); }
