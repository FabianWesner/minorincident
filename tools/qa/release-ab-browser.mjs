/** Paired release evidence through the shared headless pool. Servers are caller-owned. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { launchBrowser } from '../browser-pool/client.ts';
import { prepareStop, readyFrame, tour } from './ab-tour.ts';
import { newCampaign, preset } from '../../src/sim/progression/Campaign.ts';
import { crossing } from '../../src/levels/L9/district.ts';
import { cure } from '../../src/levels/L10/district.ts';
import { weaponKey } from '../../src/data/weaponKeys.ts';

const [mode = 'scenes', selection = 'L1,L2,L3,L4,L5,L6,L7,L8,L9,L10', backend = 'webgpu'] = process.argv.slice(2);
const tier = process.env.RELEASE_QUALITY === 'high' ? 'high' : 'low';
const seconds = Number(process.env.RELEASE_SECONDS ?? 30);
if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 120) throw new Error('RELEASE_SECONDS must be in (0, 120]');
const perfOnly = process.env.RELEASE_PERF_ONLY === '1';
const diagnostic = process.env.RELEASE_CPU_PROFILE === '1';
const out = resolve(process.env.RELEASE_OUT ?? 'test-results/release-ab-1101', mode, backend);
mkdirSync(out, { recursive: true });
const levels = selection.split(','), receipt = resolve(out, `${selection.replaceAll(',', '-')}.json`);
const rows = existsSync(receipt) ? JSON.parse(readFileSync(receipt, 'utf8')) : [];
const failed = rows.filter(r => r.failure || r.errors.length);
if (failed.length) {
  mkdirSync(resolve(out, 'attempts'), { recursive: true });
  writeFileSync(resolve(out, 'attempts', `${selection.replaceAll(',', '-')}-${Date.now()}.json`), JSON.stringify(failed, null, 2));
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].failure || rows[i].errors.length) rows.splice(i, 1);
}
const physical = process.env.RELEASE_PHYSICAL === '1';
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', ...(backend === 'webgpu' ? ['--enable-unsafe-webgpu'] : [])] });
const sources = [['prod', 'http://127.0.0.1:4902'], ['candidate', process.env.RELEASE_CANDIDATE_ORIGIN ?? 'http://127.0.0.1:4901']].filter(([side]) => !process.env.RELEASE_SIDES || process.env.RELEASE_SIDES.split(',').includes(side));
if (!sources.length) throw new Error('RELEASE_SIDES must include prod or candidate');
const checkpoint = { L1: 'accident', L2: 'doors', L3: 'armory', L4: 'turn', L5: 'outside', L6: 'abandon', L7: 'rocket', L8: 'breach', L10: 'cure-crash' };
async function open(origin) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); page.setDefaultTimeout(120_000);
  const errors = []; page.on('pageerror', e => errors.push(e.stack ?? e.message));
  await page.addInitScript('window.__name = fn => fn');
  await page.goto(`${origin}/?test=${mode === 'strips' ? 'poses' : '1'}&testApi=1&scenelab=1&profile=1&preload=0&dpr=1&quality=${tier}&controls=wasd&audio=muted&seed=1${backend === 'webgl2' ? '&renderer=webgl' : ''}`);
  await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
  await page.evaluate(async () => { await window.__SS__.ready; window.__SS__.pause(); });
  const hardware = await page.evaluate(async () => { const adapter = await navigator.gpu?.requestAdapter(); if (!adapter) return null; const i = adapter.info; return { vendor: i.vendor, architecture: i.architecture, device: i.device, description: i.description, isFallbackAdapter: i.isFallbackAdapter }; });
  return { context, page, errors, hardware };
}
async function setup(page, stop) {
  const save = stop.level === 'L1' ? newCampaign() : preset(`${stop.level}-default`); save.settings.quality = tier;
  const target = stop.checkpoint && cure.anchors[stop.checkpoint];
  const region = cure.regions.findIndex(r => r.checkpoint === stop.checkpoint);
  const walkRoute = stop.level === 'L10' && target ? [...cure.regions.slice(0, region < 0 ? cure.regions.length : region).flatMap(r => r.route), target].map(p => [...p]) : undefined;
  return page.evaluate(prepareStop, { stop, seed: 1, save, zoom: 1.5, tier, driveRoute: crossing.routes.find(r => r.id === 'road').points, walkRoute });
}
async function snapshot(page) {
  return page.evaluate(() => {
    const a = window.__SS__, g = window.__SCENE__.game, w = g.world, state = a.missions.state();
    // Sampling must not clone the entire world/render snapshot inside a native
    // frame window. Retired entities make those copies grow during the assault.
    const live = [...w.entities.iterate()].filter(e => e.infected && e.health.current > 0 && !e.hidden && !e.infected.hidden);
    const liveIds = new Set(live.map(e => e.id));
    const drawn = a.crowdFigures().filter(f => f.drawn && liveIds.has(f.id));
    const marker = state?.marker, anchor = marker ? w.missions.def.anchors[marker] : null;
    const perf = a.perf(), player = w.entities.get(1);
    return { scenario: w.scenario, loading: g.loading, tick: a.tick(), backend: perf.backend, quality: g.view.quality, player: player ? { ...player.transform } : undefined, alive: live.length, alphas: live.filter(e => e.archetype === 'infected.alpha').length, drawn: drawn.length, drawnIds: drawn.map(f => f.id), marker, anchor, worldMarker: g.view.marker ? { visible: g.view.marker.visible, at: g.view.marker.position.toArray() } : null, searchRings: g.view.survivorRings?.children.filter(e => e.visible).length ?? 0, objective: document.querySelector('[data-testid=objective-text]')?.textContent, phase: state?.phase, completed: state?.completedObjectives, state, nodeBuildMaterials: perf.nodeBuildMaterials };
  });
}
function saveRows() { writeFileSync(receipt, JSON.stringify(rows, null, 2)); }
async function scene(stop) {
  for (const [side, origin] of sources) {
    if (rows.some(r => r.side === side && r.stop?.id === stop.id && !r.failure && !r.errors.length)) continue;
    const s = await open(origin), row = { side, stop, backend, hardware: s.hardware, errors: s.errors };
    try {
      if (stop.custom === 'passengers') {
        const carried = JSON.parse(readFileSync(resolve('docs/reports/final-e2e/fresh/fresh-22-completion.json'), 'utf8')).campaign;
        carried.settings.quality = 'low';
        row.proof = await s.page.evaluate(async save => {
          const a = window.__SS__, g = window.__SCENE__.game;
          await g.continueCampaign(save, 9); a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5); g.ui.show(null);
          const w = g.world, car = w.entities.get(w.missions.l9.state.carId), occupants = save.transport.occupants;
          const missing = occupants.filter(e => !w.entities.get(e.id)).map(e => e.id);
          if (missing.length) throw new Error(`Carried occupants missing: ${missing.join(',')}`);
          return { target: null, scenario: w.scenario, tick: w.tick, transportCount: occupants.length, occupants: occupants.map(source => { const e = w.entities.get(source.id); return { id: e.id, archetype: e.archetype, passengerOf: e.passengerOf, hidden: e.hidden, hp: e.health.current }; }), passengers: structuredClone(car.vehicle.passengers), driver: car.vehicle.driver, carId: car.id };
        }, carried);
      } else row.proof = await setup(s.page, stop);
      if (stop.custom === 'board' || stop.custom === 'doors') {
        await s.page.evaluate(async kind => {
          const a = window.__SS__, g = window.__SCENE__.game; a.bot.start('complete');
          for (let i = 0; i < 150 && !(kind === 'board' ? a.missions.state().l2.seated : ['doors', 'collapse'].includes(a.missions.state().l2.phase)); i++) await a.step(120);
          a.bot.stop(); a.input.clear(); g.view.snapCamera();
        }, stop.custom);
      }
      if (stop.custom === 'headlamp') {
        for (let i = 0; i < 80; i++) {
          const move = await s.page.evaluate(() => {
            const g = window.__SCENE__.game, p = g.world.entities.get(1).transform, lamp = [...g.world.entities.iterate()].find(e => e.archetype === 'pickup.headlamp');
            if (!lamp) throw new Error('Native headlamp missing');
            const dx = lamp.transform.x - p.x, dz = lamp.transform.z - p.z, angle = g.view.view.azimuth, x = Math.cos(angle) * dx - Math.sin(angle) * dz, z = Math.sin(angle) * dx + Math.cos(angle) * dz, d = Math.hypot(x, z) || 1;
            return { near: d < 1.3, keys: [Math.abs(x) / d > .35 ? x > 0 ? 'KeyD' : 'KeyA' : '', Math.abs(z) / d > .35 ? z > 0 ? 'KeyS' : 'KeyW' : ''].filter(Boolean) };
          });
          if (move.near) break;
          for (const key of move.keys) await s.page.keyboard.down(key);
          await s.page.evaluate(() => window.__SS__.step(6));
          for (const key of move.keys) await s.page.keyboard.up(key);
        }
        await s.page.keyboard.down('KeyE'); await s.page.evaluate(() => window.__SS__.step(36)); await s.page.keyboard.up('KeyE');
        row.headlamp = await s.page.evaluate(() => ({ items: window.__SS__.missions.state().items, flashlight: window.__SS__.missions.state().l6.flashlight }));
        if (!row.headlamp.flashlight) throw new Error('Physical headlamp pickup did not enable flashlight');
      }
      row.frame = await s.page.evaluate(readyFrame, { target: row.proof.target, zoom: 1.5, ticks: 0, stopId: stop.id });
      row.snapshot = await snapshot(s.page);
      row.image = `${stop.id}-${side}.jpg`;
      await s.page.screenshot({ path: resolve(out, row.image), type: 'jpeg', quality: 80 });
    } catch (e) { row.failure = String(e); }
    finally { await s.context.close(); rows.push(row); saveRows(); console.log(JSON.stringify({ mode, side, stop: stop.id, failure: row.failure, tick: row.snapshot?.tick, alive: row.snapshot?.alive, drawn: row.snapshot?.drawn })); }
  }
}
async function strip(level) {
  for (const [side, origin] of sources) {
    if (rows.some(r => r.side === side && r.level === level && (r.tier ?? 'low') === tier && !r.failure && !r.errors.length)) continue;
    const s = await open(origin), row = { side, level, backend, tier, seconds, diagnostic, terminalInputWithheld: perfOnly && ['L1', 'L8'].includes(level), hardware: s.hardware, measuredAt: new Date().toISOString(), control: physical && level !== 'L9' ? 'physical WASD + mouse aim, native bot navigation; first 15s no shooting' : 'native complete bot, ordinary InputFrames', samples: [], images: [], errors: s.errors };
    let cdp;
    const held = new Set();
    try {
      const nativeBeat = ['L2', 'L4', 'L6', 'L7', 'L8'].includes(level);
      const stop = level === 'L10' ? { ...tour.find(s => s.id === 'l10-finale') } : { id: `${level.toLowerCase()}-route`, level, checkpoint: nativeBeat ? undefined : checkpoint[level] };
      const captureId = level === 'L10' ? 'finale' : nativeBeat ? 'native' : checkpoint[level] ?? 'start';
      row.proof = await setup(s.page, stop);
      if (nativeBeat) {
        row.nativeBeat = await s.page.evaluate(async level => {
          const a = window.__SS__; a.bot.start('complete');
          const reached = () => { const m = a.missions.state(), g = window.__SCENE__.game; return level === 'L2' ? m.l2.doorsOpenAt > 0 : level === 'L4' ? m.l4.turnAt > 0 : level === 'L6' ? m.l6.phase === 'retreat' : level === 'L7' ? g.world.l7Encounters.state.started : g.world.missions.l8.state.breachedAt > 0; };
          for (let i = 0; i < 150 && !reached(); i++) await a.step(120);
          a.bot.stop(); a.input.clear();
          if (!reached()) throw new Error(`${level} native beat was not reached`);
          await a.step(1); await a.screenshotReady();
          return { tick: a.tick(), state: a.missions.state() };
        }, level);
      }
      await s.page.evaluate(({ physical, tier, retainLevel }) => {
        const a = window.__SS__, g = window.__SCENE__.game;
        a.settings.set({ quality: tier, vfx: true, cameraShake: false, cheapDof: g.world.districts?.composition.id === 'L1' }); a.camera.follow(); a.camera.zoom(1.5); a.debug.figureJoints(false);
        a.bot.start('complete'); window.__releasePlanner = g.driver;
        // Keep a full gameplay minute in short levels without timing the next
        // level's loading work. Native movement/combat otherwise stays intact.
        if (retainLevel && (g.world.scenario === 'L1' || g.world.scenario === 'L8')) {
          const sample = g.driver.sample.bind(g.driver);
          g.driver.sample = () => {
            const frame = sample(), w = g.world;
            if (w.scenario === 'L8') {
              frame.interact = false;
              const p = w.entities.get(1).transform, door = w.missions.l8.door();
              if (Math.hypot(p.x - door.x, p.z - door.z) < 16) frame.move = { x: 0, z: 0 };
            }
            if (w.scenario === 'L1' && w.missions.state.steps.firestation?.status === 'active') {
              const p = w.entities.get(1).transform, end = w.missions.def.anchors['fire-bay-trigger'];
              if (Math.hypot(p.x - end.x, p.z - end.z) < 14) frame.move = { x: 0, z: 0 };
            }
            return frame;
          };
        }
        if (physical && g.world.scenario !== 'L9') g.driver = null;
      }, { physical, tier, retainLevel: perfOnly });
      await s.page.evaluate(async () => { await window.__SS__.screenshotReady(); });
      if (diagnostic) {
        cdp = await s.context.newCDPSession(s.page); await cdp.send('Profiler.enable');
        row.performanceStartedAt = await s.page.evaluate(() => performance.now()); await cdp.send('Profiler.start');
      }
      await s.page.evaluate(diagnostic => {
        const a = window.__SS__, g = window.__SCENE__.game, w = g.world;
        const r = window.__release = { startedAt: performance.now(), tick: w.tick, level: w.scenario, nonGameplayFrames: 0, frames: [], chargeFrames: [], cpuFrames: [], layoutCalls: [], navCalls: [], frozenBakes: [], builds: [], events: [], inputs: [], running: true };
        let last = performance.now();
        const sample = now => { if (!r.running) return; if (g.loading || g.world.scenario !== r.level || !['playing', 'cinematic'].includes(g.world.missions?.state.phase)) r.nonGameplayFrames++; r.frames.push(now - last); if (r.level === 'L10') r.chargeFrames.push({ at: now - r.startedAt, tick: w.tick, charge: w.missions.state.counters['charge-ticks'] ?? 0 }); if (diagnostic) r.cpuFrames.push({ at: now - r.startedAt, tick: w.tick, sim: g.simMs, update: g.view.updateCpuMs, render: g.view.renderCpuMs }); last = now; requestAnimationFrame(sample); }; requestAnimationFrame(sample);
        const onBuild = g.view.renderer.debug.onNodeBuilderCreated;
        g.view.renderer.debug.onNodeBuilderCreated = (builder, object) => { onBuild?.(builder, object); const entry = { at: performance.now() - r.startedAt, tick: w.tick, material: object.material.name, loading: g.loading }; r.builds.push(entry); if (diagnostic) { const build = builder.build; builder.build = function (...args) { const start = performance.now(); try { return build.apply(this, args); } finally { entry.ms = performance.now() - start; } }; } };
        for (const event of ['infected.attack', 'combat.attack', 'combat.hit', 'combat.kill', 'explosion']) w.events.on(event, e => r.events.push(structuredClone(e)));
        const tap = g.input.tap; g.input.tap = (frame, scheme) => { tap?.(frame, scheme); if (r.inputs.length < 3600) r.inputs.push({ tick: w.tick, move: { ...frame.move }, aim: { ...frame.aim }, aimPoint: frame.aimPoint, mouseAttack: frame.mouseAttack }); };
        if (g.driver) { const sample = g.driver.sample.bind(g.driver); g.driver.sample = () => { const frame = sample(); if (r.inputs.length < 3600) r.inputs.push({ tick: w.tick, frame: structuredClone(frame) }); return frame; }; }
        if (diagnostic && r.level === 'L8') {
          const corpses = g.view.crowd?.staticCorpses;
          if (corpses) {
            const prototype = Object.getPrototypeOf(corpses), begin = prototype.begin;
            prototype.begin = function (get, resting, focus, state) {
              return begin.call(this, get, resting && (body => {
                const start = performance.now(), result = resting(body), ms = performance.now() - start;
                if (ms > .5) r.layoutCalls.push({ at: start - r.startedAt, tick: w.tick, id: body.id, ms, blastFlight: !!body.corpseBlast, source: { ...body.transform }, result: { x: result.x, y: result.y, z: result.z, yaw: result.yaw }, focus: { ...focus } });
                return result;
              }), focus, state);
            };
          }
        }
        if (diagnostic && r.level === 'L10') {
          const corpses = g.view.crowd?.staticCorpses;
          if (corpses) {
            const prototype = Object.getPrototypeOf(corpses), bake = prototype.frozenPose;
            prototype.frozenPose = function (source, material, clip, frame, hiddenParts, hidesHair = false) {
              const key = `${source.uuid}/${material.uuid}/${frame}/${hiddenParts.join(',')}/${hidesHair}`;
              const missing = !this.frozen.has(key), bareWarm = this.frozen.has(`${source.uuid}/${material.uuid}/${frame}//false`), warmOtherMaterial = missing && [...this.frozen.keys()].some(k => k.startsWith(`${source.uuid}/`) && k.endsWith(`/${frame}/${hiddenParts.join(',')}/${hidesHair}`)), start = performance.now();
              const result = bake.call(this, source, material, clip, frame, hiddenParts, hidesHair);
              if (missing) r.frozenBakes.push({ at: start - r.startedAt, ms: performance.now() - start, tick: w.tick, frame, hiddenParts, hidesHair, bareWarm, warmOtherMaterial, vertices: source.getAttribute('position').count });
              return result;
            };
          }
          const prototype = Object.getPrototypeOf(w.infected.nav), reach = prototype.reachPath;
          prototype.reachPath = function (from, target, result, budget = Infinity) {
            const start = performance.now(), memo = this.reachMemo;
            const ok = reach.call(this, from, target, result, budget);
            if (budget === Infinity) r.navCalls.push({ at: start - r.startedAt, ms: performance.now() - start, tick: w.tick, from, x: target.x, z: target.z, path: result.length, cells: this.blocked.length, memoFrom: memo?.from, memoX: memo?.x, memoZ: memo?.z });
            return ok;
          };
        }
        a.resume();
      }, diagnostic);
      const start = Date.now(); let nextShot = 0;
      while (Date.now() - start < seconds * 1000 + 100) {
        const elapsed = Date.now() - start;
        if (physical && level !== 'L9') {
          const command = await s.page.evaluate(() => {
            const a = window.__SS__, g = window.__SCENE__.game, w = g.world, p = w.entities.get(1).transform, f = window.__releasePlanner.sample();
            const angle = g.view.view.azimuth, right = Math.cos(angle) * f.move.x - Math.sin(angle) * f.move.z, down = Math.sin(angle) * f.move.x + Math.cos(angle) * f.move.z;
            const keys = [Math.abs(right) > .25 ? right > 0 ? 'KeyD' : 'KeyA' : '', Math.abs(down) > .25 ? down > 0 ? 'KeyS' : 'KeyW' : ''].filter(Boolean);
            const enemies = w.infected.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected.hidden).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z));
            const point = enemies[0]?.transform ?? f.aimPoint ?? { x: p.x + 5, z: p.z }, cursor = a.input.project(point, 'destination');
            const entry = f.selectedSlot ? p && w.entities.get(1).weapons?.[f.selectedSlot.side].rack[f.selectedSlot.index]?.id : null;
            return { keys, interact: f.interact, firing: !!(f.left.held || f.right.held), weapon: entry, cursor: { x: Math.max(80, Math.min(1200, cursor.x)), y: Math.max(110, Math.min(570, cursor.y)) } };
          });
          for (const key of [...held]) if (!command.keys.includes(key)) { await s.page.keyboard.up(key); held.delete(key); }
          for (const key of command.keys) if (!held.has(key)) { await s.page.keyboard.down(key); held.add(key); }
          await s.page.mouse.move(command.cursor.x, command.cursor.y);
          if (command.interact) await s.page.keyboard.press('KeyE');
          const key = weaponKey(command.weapon); if (key) await s.page.keyboard.press(`Digit${key}`);
          if (elapsed >= 15000 && command.firing) { await s.page.keyboard.down('ShiftLeft'); await s.page.mouse.down(); }
          else { await s.page.mouse.up(); await s.page.keyboard.up('ShiftLeft'); }
        }
        if (elapsed >= nextShot && nextShot < seconds * 1000) {
          row.samples.push({ wallSeconds: elapsed / 1000, ...(await snapshot(s.page)) });
          const name = `${level}-${captureId}-${side}-${Math.round(elapsed / 1000)}s.jpg`;
          if (!perfOnly) { await s.page.screenshot({ path: resolve(out, name), type: 'jpeg', quality: 75 }); row.images.push(name); } nextShot += 6000;
        }
        await s.page.waitForTimeout(100);
      }
      for (const key of held) await s.page.keyboard.up(key); held.clear(); await s.page.mouse.up(); await s.page.keyboard.up('ShiftLeft');
      row.performance = await s.page.evaluate(() => { const r = window.__release; r.running = false; return { ...r, durationMs: performance.now() - r.startedAt, endTick: window.__SS__.tick(), maxMs: Math.max(0, ...r.frames), p95Ms: [...r.frames].sort((a,b)=>a-b)[Math.ceil(r.frames.length * .95)-1] }; });
      if (perfOnly && row.performance.nonGameplayFrames) throw new Error(`Sample crossed a loading/level/result boundary (${row.performance.nonGameplayFrames} frames)`);
      row.samples.push({ wallSeconds: row.performance.durationMs / 1000, ...(await snapshot(s.page)) });
      const name = `${level}-${captureId}-${side}-${seconds}s.jpg`; if (!perfOnly) { await s.page.screenshot({ path: resolve(out, name), type: 'jpeg', quality: 75 }); row.images.push(name); }
    } catch (e) { row.failure = String(e); }
    finally { if (cdp) { const { profile } = await cdp.send('Profiler.stop'); writeFileSync(resolve(out, `${level}-${side}.cpuprofile.gz`), gzipSync(JSON.stringify({ ...profile, performanceStartedAt: row.performanceStartedAt }))); await cdp.detach(); } await s.context.close(); rows.push(row); saveRows(); console.log(JSON.stringify({ mode, side, level, failure: row.failure, maxMs: row.performance?.maxMs, samples: row.samples.length, attacks: row.performance?.events.filter(e => e.type === 'infected.attack' && e.targetId === 1).length })); }
  }
}
try {
  if (mode === 'strips') for (const level of levels) await strip(level);
  else {
    const selected = tour.filter(s => levels.includes(s.level) && !['l1-bike-rack', 'l1-park', 'l1-glasses', 'l1-firestation', 'l2-ride-start', 'l3-ramp-west', 'l3-ramp-east', 'l4-tank-enter', 'l4-tank-hold', 'l5-start', 'l6-start', 'l7-start', 'l8-start', 'l9-gate', 'l10-start'].includes(s.id));
    if (levels.includes('L2')) selected.splice(selected.findIndex(s => s.level === 'L3'), 0, { id: 'l2-fire-engine-entry', level: 'L2', custom: 'board' }, { id: 'l2-rescue-doors', level: 'L2', custom: 'doors' });
    if (levels.includes('L4')) selected.push({ id: 'l4-quartermaster-reception', level: 'L4', checkpoint: 'arrival', anchor: 'l4-quartermaster' });
    if (levels.includes('L1')) selected.push({ id: 'l1-depot-closed', level: 'L1', setup: 'depot-return', wait: 300 }, { id: 'l1-lab-closed', level: 'L1', setup: 'lab-return', wait: 300 });
    if (levels.includes('L6')) selected.push({ id: 'l6-shelter', level: 'L6' }, { id: 'l6-headlamp', level: 'L6', custom: 'headlamp' });
    if (levels.includes('L9')) selected.push({ id: 'l9-passengers', level: 'L9', custom: 'passengers' });
    for (const stop of selected.filter(s => !process.env.RELEASE_STOPS || process.env.RELEASE_STOPS.split(',').includes(s.id))) await scene(stop);
  }
} finally { await browser.close(); }
if (rows.some(r => r.failure || r.errors.length)) process.exitCode = 1;
