// r28-vqa: start a QA checkpoint fixture and play it by real keyboard/mouse input in ONE headless browser.
//   E2E_PORT=4891 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/r28-vqa-fixture-play.ts <origin> <fixture> --out <dir>
//     [--quality low|high] [--zoom 1.5] [--backend webgpu|webgl] [--seconds 300] [--shot 6] [--god] [--weapon weapon.army-mg]
//     [--route x,z;x,z;...] [--follow-marker] [--hold-e] [--tap-e-when <regex on tracker>]
// --measure infected.gorilla,infected.zebra: save final paused-frame body-mask metrics and PNG.
// --burst <m>: 6 quick frames when a drawn enemy within m metres attacks (r38-vqa).
// --watch <js>: evaluated (a=__SS__, g=game) and logged every 3 s; pair it with --setup to install a probe.
// --dwell <s>: stand still for s seconds at each reached route point (with --hold-e, holds E on a prompt there).
// --skip-credits-after <s>: click the real 'Skip credits' button after s seconds of credits.
// --tap-e-when: tap E (down/up) once a second while the tracker matches, e.g. 'Release the cure' (the L10 release has no prompt).
// Setup is the fixture (tests/fixtures/saves/qa) only; after it every action is a key press or mouse move/click.
// Movement: WASD toward the next --route point (screen-relative, as the player sees it), then toward the objective marker
// (--follow-marker) or the nearest enemy. Combat: mouse over the nearest drawn enemy's feet + attack while it is in range.
// Logs (log.jsonl): objective/tracker text, HUD bars (APC armor), enemies (kind, hp), frames > 100 ms with tick.
import { mkdirSync, appendFileSync, mkdtempSync, existsSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir, loadavg } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { launchProfile } from '../browser-pool/client';
import { readFixture } from './fixture-io';
import { loadFixtureInPage } from './load-fixture';
import { look, type Eyes } from '../playtest/eyes';
import { measureFlatSilhouette } from '../scenelab/run';
import type { SceneSession } from '../scenelab/session';
import { weaponKey } from '../../src/data/weaponKeys';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  measure: { type: 'string' }, out: { type: 'string' }, quality: { type: 'string', default: 'low' }, zoom: { type: 'string', default: '1.5' }, backend: { type: 'string', default: 'webgpu' },
  seconds: { type: 'string', default: '300' }, shot: { type: 'string', default: '6' }, god: { type: 'boolean', default: false }, weapon: { type: 'string', default: 'weapon.army-mg' },
  route: { type: 'string' }, 'follow-marker': { type: 'boolean', default: false }, 'hold-e': { type: 'boolean', default: false }, 'tap-e-when': { type: 'string' }, 'skip-credits-after': { type: 'string' }, dwell: { type: 'string', default: '0' }, reach: { type: 'string', default: '2.5' }, block: { type: 'string', default: '5' }, 'no-kite': { type: 'boolean', default: false }, range: { type: 'string', default: '22' }, setup: { type: 'string' }, trace: { type: 'boolean', default: false }, 'trace-scheduling': { type: 'boolean', default: false }, 'trace-window': { type: 'boolean', default: false }, 'no-captures': { type: 'boolean', default: false },
  'dodge-bus': { type: 'boolean', default: false }, handbrake: { type: 'string', default: 'Space' }, burst: { type: 'string' }, prefer: { type: 'string' }, watch: { type: 'string' }, 'route-when': { type: 'string' }, 'idle-when': { type: 'string' }, 'no-hatch-fire': { type: 'boolean', default: false }, 'no-fire': { type: 'boolean', default: false },
} });
const [origin, name] = positionals;
// `level:L7:corridor` loads a level at a mission checkpoint through the test API instead of a fixture.
const direct = name?.startsWith('level:') ? name.split(':') : null;
const path = direct ? 'direct' : ['', '.json.gz', '.json.br'].map(ext => resolve(existsSync(name) ? name : `tests/fixtures/saves/qa/${name}${ext}`)).find(existsSync);
if (!origin || !path) throw new Error('usage: r28-vqa-fixture-play.ts <origin> <fixture> --out <dir>');
const out = resolve(values.out!); mkdirSync(out, { recursive: true });
if ((values.trace || values['trace-scheduling'] || values['trace-window']) && (out === process.cwd() || out.startsWith(`${process.cwd()}/`))) throw new Error('--trace requires --out outside the worktree so raw traces cannot be committed');
const log = (o: object) => appendFileSync(`${out}/log.jsonl`, JSON.stringify({ wall: new Date().toISOString().slice(11, 19), epochMs: Date.now(), hostLoad: loadavg(), ...o }) + '\n');
const route = (values.route ?? '').split(';').filter(Boolean).map(p => { const [x, z] = p.split(',').map(Number); return { x, z }; });
const zoom = Number(values.zoom), range = Number(values.range);
const fixture = direct ? null : readFixture(path);
const context = await launchProfile(mkdtempSync(`${tmpdir()}/r28vqa-`), { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'], viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const capture = async (options: NonNullable<Parameters<typeof page.screenshot>[0]>) => {
  if (values['no-captures']) return;
  const started = Date.now(); log({ capture: 'start', path: options.path });
  await page.screenshot(options);
  log({ capture: 'end', path: options.path, durationMs: Date.now() - started });
};
const trace = values.trace || values['trace-scheduling'] || values['trace-window'] ? await context.newCDPSession(page) : null;
const traceCompleted = trace ? new Promise<{ stream?: string; dataLossOccurred: boolean }>(resolve => trace.once('Tracing.tracingComplete', event => resolve(event))) : null;
let traceStarted = false, traceStopped = false;
await page.addInitScript({ content: 'window.__name = (f) => f;' }); // tsx keepNames helper inside evaluate callbacks
const errors: string[] = []; page.on('pageerror', e => { errors.push(String(e).slice(0, 200)); log({ pageError: String(e).slice(0, 300), ...(errors.length <= 3 ? { stack: String((e as Error).stack ?? '').slice(0, 1500) } : {}) }); }); // r38-vqa: stack of the first 3 page errors
try {
  await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&preload=0&loadProfile=2&${values.backend === 'webgpu' ? '' : 'renderer=webgl&'}dpr=1&audio=muted&quality=${values.quality}`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 180000 });
  await page.evaluate(async q => { await window.__SS__!.ready; window.__SS__!.debug.figureJoints(true); window.__SS__!.settings.set({ quality: q as 'low' }); }, values.quality!);
  const loadStarted = Date.now();
  const state = fixture ? await loadFixtureInPage(page, fixture) : await page.evaluate(async ([lvl, cp]) => { const a = window.__SS__!; await a.loadLevel(lvl, { seed: 1, checkpoint: cp || undefined }); a.pause(); await a.step(60); const p = a.getEntity(1)!; return { level: lvl, checkpoint: a.missions.state()?.checkpoint, player: { x: p.transform.x, z: p.transform.z } }; }, [direct![1], direct![2] ?? ''] as const);
  log({ loadWallMs: Date.now() - loadStarted, loadTiming: await page.evaluate(() => window.__SS__!.perf().loadTiming) });
  const backend = await page.evaluate(() => window.__SS__!.getState().render.backend);
  log({ fixture: fixture?.label ?? name, state, backend, quality: values.quality, zoom });
  // Explicit fixture setup (logged), e.g. lower a boss's HP so real shots finish it: --setup "<js using a=__SS__, g=game>".
  if (values.setup) log({ setup: values.setup, result: await page.evaluate(js => { const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: unknown }).game; return String(new Function('a', 'g', js)(a, g)); }, values.setup) });
  if (values.god) { await page.evaluate(() => window.__SS__!.cheats.god(true)); log({ setup: 'god-mode' }); }
  if (trace) {
    await trace.send('Tracing.start', { traceConfig: { recordMode: values['trace-window'] ? 'recordContinuously' : 'recordAsMuchAsPossible', ...(values['trace-window'] ? { traceBufferSizeInKb: 65536 } : {}), excludedCategories: ['*'], includedCategories: ['devtools.timeline', 'blink.user_timing', ...(values['trace-scheduling'] || values['trace-window'] ? ['toplevel', 'gpu'] : [])] }, transferMode: 'ReturnAsStream' });
    traceStarted = true;
  }
  await page.evaluate(z => {
    const a = window.__SS__!; a.camera.follow(); a.camera.zoom(z);
    const w = window as unknown as { __r28Frames: { tick: number; ms: number; elapsedMs: number; perf?: ReturnType<typeof a.perf> }[]; __r28LongFrames: { tick: number; ms: number; elapsedMs: number }[]; __r28FrameTimes: number[]; __r28PlayStarted: number };
    w.__r28Frames = []; w.__r28LongFrames = []; w.__r28FrameTimes = []; w.__r28PlayStarted = performance.now();
    performance.mark('fixture-play-start');
    let last = w.__r28PlayStarted;
    const loop = (now: number) => {
      const ms = now - last; last = now;
      if (now - w.__r28PlayStarted >= 3000) w.__r28FrameTimes.push(ms);
      if (ms > 100) {
        const event = { tick: a.tick(), ms: +ms.toFixed(1), elapsedMs: Math.round(now - w.__r28PlayStarted) };
        performance.mark('fixture-long-frame', { detail: event });
        w.__r28LongFrames.push(event); w.__r28Frames.push({ ...event, perf: a.perf() });
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    a.resume();
  }, zoom);
  await page.mouse.click(640, 360);
  const key = weaponKey(values.weapon!); if (key) await page.keyboard.press(`Digit${key}`);
  const held = new Set<string>();
  const press = async (keys: string[]) => {
    for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  const dirKeys = (e: Eyes, to: { x: number; z: number }, azimuth: number, away = false, stop = 1.2): string[] => {
    const p = e.player!; let dx = to.x - p.x, dz = to.z - p.z; if (away) { dx = -dx; dz = -dz; }
    const right = Math.cos(azimuth) * dx - Math.sin(azimuth) * dz, down = Math.sin(azimuth) * dx + Math.cos(azimuth) * dz, len = Math.hypot(right, down);
    if (len < stop) return [];
    const k: string[] = [];
    if (Math.abs(right) / len > .34) k.push(right > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(down) / len > .34) k.push(down > 0 ? 'KeyS' : 'KeyW');
    return k;
  };
  const start = Date.now(), seconds = Number(values.seconds), shotEvery = Number(values.shot) * 1000;
  let lastBurst = 0, lastEvent = 0, dwellUntil = 0, skipped = false, lastEnd = 0, lastTap = 0, lastShot = 0, lastLog = 0, ri = 0, lastText = '', shotN = 0, best = Infinity, bestAt = Date.now();
  while (Date.now() - start < seconds * 1000) {
    const e = await page.evaluate(look);
    // Optional read-only probes request a capture at a special-move stage transition.
    const stageShot = await page.evaluate(() => {
      const w = window as unknown as { __s42Shot?: { tick: number; id: number; move: string; stage: string } };
      const requested = w.__s42Shot; delete w.__s42Shot; return requested;
    });
    if (stageShot) {
      const label = `${stageShot.move}-${stageShot.stage}`.replace(/[^a-zA-Z0-9.-]/g, '_');
      log({ stageShot, captureTick: e.tick });
      await capture({ path: `${out}/stage-${stageShot.id}-t${stageShot.tick}-${label}.jpg`, type: 'jpeg', quality: 80 });
    }
    if (trace && values['trace-window'] && !traceStopped && await page.evaluate(() => (window as unknown as { __r28LongFrames: { ms: number; elapsedMs: number }[] }).__r28LongFrames.some(f => f.ms > 250 && f.elapsedMs >= 3000))) {
      traceStopped = true; await trace.send('Tracing.end'); log({ traceStoppedOnHitch: true, tick: e.tick });
    }
    const extra = await page.evaluate(() => {
      const t = document.body.innerText; const m = t.match(/APC (armor [^\n]*|barely functional)/);
      const a = window.__SS__!, s = a.missions.state();
      return { apcBar: m ? m[0] : null, azimuth: (window.__SCENE__ as unknown as { game: { view: { view: { azimuth: number } } } }).game.view.view.azimuth, checkpoint: s?.checkpoint ?? null, phase: s?.phase ?? null };
    });
    // L10 ending: epilogue phase/clock, camera height, cinematic HUD class, campaign screen heading (logged every 2 s, also without a player).
    if (Date.now() - lastEnd > 2000) {
      lastEnd = Date.now();
      const end = await page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: { view: { camera: { position: { x: number; y: number; z: number } } } } }).game, s = window.__SS__!.missions.state();
        const camp = document.querySelector<HTMLElement>("#campaign-title");
        return s?.epilogue ? { phase: s.epilogue.phase, phaseTicks: s.epilogue.phaseTicks, epTicks: s.counters['epilogue-ticks'], camY: Math.round(g.view.camera.position.y), cinematicUi: document.body.classList.contains('cinematic-ui'), uiScreen: document.body.dataset.uiScreen, campaign: document.body.dataset.campaign ?? null, heading: camp && !(camp.closest(".campaign-ui") as HTMLElement | null)?.hidden ? camp.textContent : null, skip: !!document.querySelector('[data-testid="ending-credits-back"]'), endingView: (g.view as unknown as { endingView?: { readyShots?: number; errors?: string[] } }).endingView ? { ready: (g.view as unknown as { endingView: { readyShots: number } }).endingView.readyShots, errors: (g.view as unknown as { endingView: { errors: string[] } }).endingView.errors.slice(0, 3) } : null } : null;
      }).catch(err => ({ err: String(err).slice(0, 120) }));
      if (end) log({ ending: end, tick: e.tick });
      const skipAfter = Number(values['skip-credits-after'] ?? NaN);
      if (end && 'phase' in end && end.phase === 'credits' && end.phaseTicks >= skipAfter * 60 && !skipped) {
        skipped = true; await page.getByTestId('ending-credits-back').click(); log({ clicked: 'Skip credits', phaseTicks: end.phaseTicks, tick: e.tick });
      }
    }
    if (!e.player || (e.player && (await page.evaluate(() => !!window.__SS__!.missions.state()?.epilogue && window.__SS__!.missions.state()!.epilogue!.phase !== 'playable').catch(() => false)))) {
      if (Date.now() - lastShot > shotEvery) { lastShot = Date.now(); await capture({ path: `${out}/s${String(shotN++).padStart(3, '0')}-t${e.tick}.jpg`, type: 'jpeg', quality: 70 }); }
      await page.waitForTimeout(250); continue;
    }
    if (e.panel.visible && e.panel.button) { log({ panel: e.panel, tick: e.tick }); await page.getByTestId('mission-button').click({ timeout: 3000 }).catch(() => undefined); }
    const text = `${e.objective} | ${e.tracker}`;
    if (text !== lastText) { lastText = text; log({ tick: e.tick, objective: e.objective, tracker: e.tracker, subtitle: e.subtitle, prompt: e.prompt, apcBar: extra.apcBar, checkpoint: extra.checkpoint, phase: extra.phase }); }
    const foes = e.enemies.filter(b => b.drawn && !b.corpse && b.hp > 0).sort((a, b) => a.d - b.d);
    // r35-vqa: --prefer <regex on kind/archetype>: aim at a matching enemy in range first (an L8 boss instead of a runner pressed to the far side of the fence).
    const target = (values.prefer ? foes.find(b => b.d < range && new RegExp(values.prefer!).test(String(b.archetype ?? b.kind))) : undefined) ?? foes.find(b => b.d < range);
    let keys: string[] = [];
    // r35-vqa: --route-when <regex on objective>: the route waits until the objective matches (e.g. after the L5 cellar).
    const routeOn = !values['route-when'] || new RegExp(values['route-when']).test(e.objective ?? '');
    while (routeOn && ri < route.length && Math.hypot(route[ri].x - e.player.x, route[ri].z - e.player.z) < (e.driving ? 8 : Number(values.reach))) { log({ reached: route[ri], tick: e.tick }); ri++; best = Infinity; bestAt = Date.now(); dwellUntil = Date.now() + Number(values.dwell) * 1000; }
    if (routeOn && ri < route.length) {
      const d = Math.hypot(route[ri].x - e.player.x, route[ri].z - e.player.z);
      if (d < best - .5) { best = d; bestAt = Date.now(); }
      else if (Date.now() - bestAt > Number(values.block) * 1000) { log({ routeBlocked: route[ri], d: +d.toFixed(1), tick: e.tick }); ri++; best = Infinity; bestAt = Date.now(); }
    }
    if (Date.now() < dwellUntil) keys = [];
    else if (routeOn && ri < route.length) keys = dirKeys(e, route[ri], extra.azimuth, false, .3);
    else if (target && target.d < 6 && !values['no-kite']) keys = dirKeys(e, target, extra.azimuth, true);
    else if (values['follow-marker'] && e.marker && e.marker.anchor) {
      const m = await page.evaluate(() => { const pin = document.querySelector<HTMLElement>('[data-testid="minimap-objective"]'); return pin && !pin.hidden ? { x: Number(pin.dataset.worldX), z: Number(pin.dataset.worldZ) } : null; });
      if (m && Number.isFinite(m.x)) keys = dirKeys(e, m, extra.azimuth);
    } else if (target && target.d > 12) keys = dirKeys(e, target, extra.azimuth);
    // r31-drivekeys / r32-l9fun: a driven vehicle takes classic car keys (W gas, A/D steer toward the goal, K handbrake to
    // throw boarders off), not screen-relative WASD.
    if (e.driving) {
      const goal = ri < route.length ? route[ri] : values['follow-marker'] ? await page.evaluate(() => { const pin = document.querySelector<HTMLElement>('[data-testid="minimap-objective"]'); return pin && !pin.hidden ? { x: Number(pin.dataset.worldX), z: Number(pin.dataset.worldZ) } : null; }) : null;
      keys = [];
      if (goal && Number.isFinite(goal.x)) {
        const want = -Math.atan2(goal.z - e.driving.z, goal.x - e.driving.x), delta = Math.atan2(Math.sin(want - e.driving.yaw), Math.cos(want - e.driving.yaw));
        keys.push('KeyW'); if (delta > .06) keys.push('KeyA'); else if (delta < -.06) keys.push('KeyD');
      }
      if (values['dodge-bus'] && /School bus lining up/.test(e.objective ?? '')) keys = ['KeyW', 'KeyD'];
      const air = await page.evaluate(() => { const w = (window.__SCENE__ as unknown as { game: { world: unknown } }).game.world as { vehicles: { active: number | null; cars: Map<number, { physics: { speed: number }; entity: { transform: { y: number }; vehicle: { attached: number[] } } }> }; missions?: { l9?: { driving: { state: { setPieces?: { alphas: { phase: string }[] } } } } } }; const car = w.vehicles.active == null ? undefined : w.vehicles.cars.get(w.vehicles.active); return { y: car?.entity.transform.y ?? 0, speed: +(car?.physics.speed ?? 0).toFixed(1), boarders: car?.entity.vehicle.attached.length ?? 0, fight: (w.missions?.l9?.driving.state.setPieces?.alphas ?? []).filter(a => ['windup', 'air', 'hull', 'throw'].includes(a.phase)).map(a => a.phase) }; });
      if (air.boarders && Date.now() % 1500 < 400) keys.push(values.handbrake!); // r35-vqa: Space is the driving handbrake since 258f211b (K still works); --handbrake KeyK to test K
      // Event shots: the APC in the air off a ramp, and every leaper/thrower action, at most one per 1.2 s.
      if ((air.y > 2.2 || air.fight.length) && Date.now() - lastEvent > 1200) { lastEvent = Date.now(); log({ eventShot: shotN, tick: e.tick, apcY: +air.y.toFixed(2), apcSpeed: air.speed, keys, fight: air.fight, boarders: air.boarders }); await capture({ path: `${out}/s${String(shotN++).padStart(3, '0')}-t${e.tick}-${air.y > 2.2 ? 'air' : air.fight.join('+')}.jpg`, type: 'jpeg', quality: 70 }); }
    }
    // r35-vqa: --idle-when <regex on tracker>: let go of every key (no move, no fire) while it matches, e.g. the L9 crawl ring.
    if (values['idle-when'] && new RegExp(values['idle-when']).test(`${e.objective} | ${e.tracker}`)) { await press([]); if (Date.now() - lastShot > shotEvery) { lastShot = Date.now(); await capture({ path: `${out}/s${String(shotN++).padStart(3, '0')}-t${e.tick}-idle.jpg`, type: 'jpeg', quality: 70 }); } if (Date.now() - lastLog > 3000) { lastLog = Date.now(); log({ idle: true, tick: e.tick, objective: e.objective, tracker: e.tracker, player: { x: +e.player.x.toFixed(1), z: +e.player.z.toFixed(1), hp: Math.round(e.player.hp) } }); } await page.waitForTimeout(100); continue; }
    if (values['hold-e'] && e.prompt) keys.push('KeyE');
    // While driving Space is the horn/boost (K the handbrake): only fire on foot.
    if (target && !e.driving && !values['no-fire']) { await page.mouse.move(target.aim.x, target.aim.y); keys.push('Space'); }
    // r33-vqa: at the L9 rail-stall hatch the courier fights from the hull: select the weapon (keys do not take while
    // driving, retry here) and fire with the left mouse button at the nearest drawn enemy.
    // r35-vqa: the first weapon key can land while the briefing panel is still open; retry on foot until the wanted weapon is held.
    if (!e.driving && e.player.current !== values.weapon && e.player.weapons?.includes(values.weapon!) && Date.now() - lastTap > 3000) { lastTap = Date.now(); const k = weaponKey(values.weapon!); if (k) { await page.keyboard.press(`Digit${k}`); log({ weaponKey: k, tick: e.tick, had: e.player.current }); } }
    const hatch = !!e.driving && /Engine stalled/.test(e.objective ?? '');
    if (hatch && !values['no-hatch-fire']) {
      const want = weaponKey(values.weapon!); if (want && e.player.current !== values.weapon && Date.now() - lastTap > 1500) { lastTap = Date.now(); await page.keyboard.press(`Digit${want}`); log({ hatchKey: want, tick: e.tick, rack: e.player.weapons, empty: e.player.emptyWeapons, had: e.player.current, ctx: await page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: { input: { drivingContext: boolean; mountedGunContext: boolean }; world: { mountedGun?: { mounted: boolean }; missions?: { l9?: { driving: { hatch: boolean } } } } } }).game; return { driving: g.input.drivingContext, mounted: g.input.mountedGunContext, hatch: g.world.missions?.l9?.driving.hatch, worldMounted: g.world.mountedGun?.mounted }; }) }); }
      if (target) { await page.mouse.move(target.aim.x, target.aim.y); await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up(); }
    }
    await press(keys);
    if (values['tap-e-when'] && new RegExp(values['tap-e-when']).test(e.tracker ?? '') && Date.now() - lastTap > 1000) {
      lastTap = Date.now(); if (!held.has('KeyE')) { await page.keyboard.down('KeyE'); await page.waitForTimeout(80); await page.keyboard.up('KeyE'); log({ tapE: e.tracker, tick: e.tick }); }
    }
    if (Date.now() - lastLog > 3000) {
      lastLog = Date.now();
      // r39-l10nan: --watch "<js using a=__SS__, g=game>": logged with every 3-s line (e.g. a render probe the --setup installed).
      if (values.watch) log({ watch: await page.evaluate(js => { const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: unknown }).game; return new Function('a', 'g', js)(a, g) as unknown; }, values.watch).catch(err => String(err).slice(0, 200)), tick: e.tick });
      log({ tick: e.tick, player: { x: +e.player.x.toFixed(1), z: +e.player.z.toFixed(1), hp: Math.round(e.player.hp), weapon: e.player.current, riding: e.player.riding }, driving: e.driving, apcBar: extra.apcBar, checkpoint: extra.checkpoint,
        py: await page.evaluate(() => { const t = window.__SS__!.getEntity(1)?.transform; return t ? String(t.y) : null; }), barks: await page.evaluate(() => (document.body.innerText.match(/They're inside!|Reloading!|Behind us!/g) ?? []).join(',')), enemies: foes.slice(0, 6).map(b => ({ kind: b.archetype ?? b.kind, hp: Math.round(b.hp), max: b.max, d: +b.d.toFixed(1), state: b.state })), allies: e.allies.filter(a => a.drawn).length,
        frames: await page.evaluate(() => (window as unknown as { __r28Frames: unknown[] }).__r28Frames.splice(0)),
        mega: await page.evaluate(() => { const w = (window.__SCENE__ as unknown as { game: { world: { megaPursuit?: { entity(): { health: { current: number; max: number }; transform: { x: number; z: number }; infected?: Record<string, unknown>; combat?: { staggerUntil?: number } } | undefined } } } }).game.world; const m = w.megaPursuit?.entity(); if (!m) return null; const b = m.infected ?? {}; return { hp: Math.round(m.health.current), x: +m.transform.x.toFixed(1), z: +m.transform.z.toFixed(1), phase: b.megaPhase, weak: b.megaWeakTicks, armourBroken: b.megaArmourBroken, special: (b as { specialAttack?: { move?: string } }).specialAttack?.move ?? null, stagger: m.combat?.staggerUntil, gateSpent: !!window.__SS__!.missions.state()?.states['gate-spent'], megaId: (m as unknown as { id: number }).id, megaLod: window.__SS__!.crowdFigures().find(f => f.id === (m as unknown as { id: number }).id)?.lod ?? null, drawnFigures: window.__SS__!.crowdFigures().filter(f => f.drawn).length }; }).catch(() => null) });
    }
    // r38-vqa: --burst <m>: when a drawn enemy within m metres is attacking, take 6 quick frames (~150 ms apart, keys held)
    // so strikes, recoils and foot contacts are visible; at most one burst per 6 s. Frame names end in -b<k>.
    if (values.burst && !e.driving && Date.now() - lastBurst > 6000) {
      const near = foes.find(b => b.d < Number(values.burst) && b.attacking);
      if (near) {
        lastBurst = Date.now(); const n0 = shotN++;
        log({ burst: n0, tick: e.tick, foe: { kind: near.archetype ?? near.kind, d: +near.d.toFixed(1), state: near.state, speed: +near.speed.toFixed(1), hp: Math.round(near.hp) } });
        for (let k = 0; k < 6; k++) { const t = await page.evaluate(() => window.__SS__!.tick()); await page.screenshot({ path: `${out}/s${String(n0).padStart(3, '0')}-t${t}-b${k}.jpg`, type: 'jpeg', quality: 75 }); await page.waitForTimeout(60); }
      }
    }
    if (Date.now() - lastShot > shotEvery) { lastShot = Date.now(); await capture({ path: `${out}/s${String(shotN++).padStart(3, '0')}-t${e.tick}.jpg`, type: 'jpeg', quality: 70 }); }
    await page.waitForTimeout(100);
  }
  await press([]);
  const performanceSummary = await page.evaluate(() => {
    const w = window as unknown as { __r28FrameTimes: number[]; __r28LongFrames: { tick: number; ms: number; elapsedMs: number }[] };
    const times = w.__r28FrameTimes.slice().sort((a, b) => a - b);
    const percentile = (p: number) => times.length ? +times[Math.max(0, Math.ceil(times.length * p) - 1)].toFixed(1) : null;
    return { excludedInitialMs: 3000, samples: times.length, maxMs: times.length ? +times[times.length - 1].toFixed(1) : null, p99Ms: percentile(.99), over250: w.__r28LongFrames.filter(f => f.elapsedMs >= 3000 && f.ms > 250) };
  });
  if (values.measure) {
    await page.evaluate(() => window.__SS__!.pause());
    const targets = await page.evaluate(species => {
      const g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
      const drawn = new Set(g.view.crowdFigures().filter(f => f.drawn).map(f => f.id));
      return g.world.infected!.active.filter(e => drawn.has(e.id) && species.includes(e.archetype) && e.health.current > 0 && !e.hidden && !e.infected?.hidden).map(e => ({ id: `entity:${e.id}`, archetype: e.archetype }));
    }, values.measure.split(','));
    const samples = [];
    for (const target of targets) samples.push(...await measureFlatSilhouette({ page } as SceneSession, [target.id], target.archetype));
    if (!samples.length || samples.some(s => !s.pixels)) throw new Error('Requested fixture figures have no visible mask pixels');
    writeFileSync(`${out}/figure-metrics.json`, JSON.stringify({ targets, samples }, null, 2));
    await capture({ path: `${out}/measured.png` });
  }
  log({ end: true, frames: await page.evaluate(() => (window as unknown as { __r28Frames: unknown[] }).__r28Frames.splice(0)), performanceSummary, errors });
  if (trace && traceStarted) {
    if (!traceStopped) await trace.send('Tracing.end');
    const { stream, dataLossOccurred } = await traceCompleted!;
    if (!stream) throw new Error('Chromium trace completed without a readable stream');
    let bytes = 0, eof = false;
    const file = openSync(`${out}/trace.json`, 'w');
    try {
      while (!eof) {
        const chunk = await trace.send('IO.read', { handle: stream });
        const data = Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8');
        writeFileSync(file, data); bytes += data.length; eof = chunk.eof;
      }
    } finally { closeSync(file); }
    await trace.send('IO.close', { handle: stream });
    log({ trace: `${out}/trace.json`, bytes, dataLossOccurred, rollingWindow: !!values['trace-window'], stoppedOnHitch: traceStopped });
  }
} finally { await context.close(); }
