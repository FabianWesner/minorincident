// r28-vqa: start a QA checkpoint fixture and play it by real keyboard/mouse input in ONE headless browser.
//   E2E_PORT=4891 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/r28-vqa-fixture-play.ts <origin> <fixture> --out <dir>
//     [--quality low|high] [--zoom 1.5] [--backend webgpu|webgl] [--seconds 300] [--shot 6] [--god] [--weapon weapon.army-mg]
//     [--route x,z;x,z;...] [--follow-marker] [--hold-e] [--tap-e-when <regex on tracker>]
// --dwell <s>: stand still for s seconds at each reached route point (with --hold-e, holds E on a prompt there).
// --skip-credits-after <s>: click the real 'Skip credits' button after s seconds of credits.
// --tap-e-when: tap E (down/up) once a second while the tracker matches, e.g. 'Release the cure' (the L10 release has no prompt).
// Setup is the fixture (tests/fixtures/saves/qa) only; after it every action is a key press or mouse move/click.
// Movement: WASD toward the next --route point (screen-relative, as the player sees it), then toward the objective marker
// (--follow-marker) or the nearest enemy. Combat: mouse over the nearest drawn enemy's feet + attack while it is in range.
// Logs (log.jsonl): objective/tracker text, HUD bars (APC armor), enemies (kind, hp), frames > 100 ms with tick.
import { mkdirSync, appendFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { launchProfile } from '../browser-pool/client';
import { readFixture } from './fixture-io';
import { loadFixtureInPage } from './load-fixture';
import { look, type Eyes } from '../playtest/eyes';
import { weaponKey } from '../../src/data/weaponKeys';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  out: { type: 'string' }, quality: { type: 'string', default: 'low' }, zoom: { type: 'string', default: '1.5' }, backend: { type: 'string', default: 'webgpu' },
  seconds: { type: 'string', default: '300' }, shot: { type: 'string', default: '6' }, god: { type: 'boolean', default: false }, weapon: { type: 'string', default: 'weapon.army-mg' },
  route: { type: 'string' }, 'follow-marker': { type: 'boolean', default: false }, 'hold-e': { type: 'boolean', default: false }, 'tap-e-when': { type: 'string' }, 'skip-credits-after': { type: 'string' }, dwell: { type: 'string', default: '0' }, 'no-kite': { type: 'boolean', default: false }, range: { type: 'string', default: '22' }, setup: { type: 'string' },
} });
const [origin, name] = positionals;
// `level:L7:corridor` loads a level at a mission checkpoint through the test API instead of a fixture.
const direct = name?.startsWith('level:') ? name.split(':') : null;
const path = direct ? 'direct' : ['', '.json.gz', '.json.br'].map(ext => resolve(existsSync(name) ? name : `tests/fixtures/saves/qa/${name}${ext}`)).find(existsSync);
if (!origin || !path) throw new Error('usage: r28-vqa-fixture-play.ts <origin> <fixture> --out <dir>');
const out = resolve(values.out!); mkdirSync(out, { recursive: true });
const log = (o: object) => appendFileSync(`${out}/log.jsonl`, JSON.stringify({ wall: new Date().toISOString().slice(11, 19), ...o }) + '\n');
const route = (values.route ?? '').split(';').filter(Boolean).map(p => { const [x, z] = p.split(',').map(Number); return { x, z }; });
const zoom = Number(values.zoom), range = Number(values.range);
const fixture = direct ? null : readFixture(path);
const context = await launchProfile(mkdtempSync(`${tmpdir()}/r28vqa-`), { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'], viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await page.addInitScript({ content: 'window.__name = (f) => f;' }); // tsx keepNames helper inside evaluate callbacks
const errors: string[] = []; page.on('pageerror', e => { errors.push(String(e).slice(0, 200)); log({ pageError: String(e).slice(0, 300) }); });
try {
  await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&${values.backend === 'webgpu' ? '' : 'renderer=webgl&'}dpr=1&audio=muted&quality=${values.quality}`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 180000 });
  await page.evaluate(async q => { await window.__SS__!.ready; window.__SS__!.debug.figureJoints(true); window.__SS__!.settings.set({ quality: q as 'low' }); }, values.quality!);
  const state = fixture ? await loadFixtureInPage(page, fixture) : await page.evaluate(async ([lvl, cp]) => { const a = window.__SS__!; await a.loadLevel(lvl, { seed: 1, checkpoint: cp || undefined }); a.pause(); await a.step(60); const p = a.getEntity(1)!; return { level: lvl, checkpoint: a.missions.state()?.checkpoint, player: { x: p.transform.x, z: p.transform.z } }; }, [direct![1], direct![2] ?? ''] as const);
  const backend = await page.evaluate(() => window.__SS__!.getState().render.backend);
  log({ fixture: fixture?.label ?? name, state, backend, quality: values.quality, zoom });
  // Explicit fixture setup (logged), e.g. lower a boss's HP so real shots finish it: --setup "<js using a=__SS__, g=game>".
  if (values.setup) log({ setup: values.setup, result: await page.evaluate(js => { const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: unknown }).game; return String(new Function('a', 'g', js)(a, g)); }, values.setup) });
  if (values.god) { await page.evaluate(() => window.__SS__!.cheats.god(true)); log({ setup: 'god-mode' }); }
  await page.evaluate(z => {
    const a = window.__SS__!; a.camera.follow(); a.camera.zoom(z);
    const w = window as unknown as { __r28Frames: { tick: number; ms: number }[] }; w.__r28Frames = [];
    let last = performance.now();
    const loop = (now: number) => { const ms = now - last; last = now; if (ms > 100) w.__r28Frames.push({ tick: a.tick(), ms: Math.round(ms) }); requestAnimationFrame(loop); };
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
  const dirKeys = (e: Eyes, to: { x: number; z: number }, azimuth: number, away = false): string[] => {
    const p = e.player!; let dx = to.x - p.x, dz = to.z - p.z; if (away) { dx = -dx; dz = -dz; }
    const right = Math.cos(azimuth) * dx - Math.sin(azimuth) * dz, down = Math.sin(azimuth) * dx + Math.cos(azimuth) * dz, len = Math.hypot(right, down);
    if (len < 1.2) return [];
    const k: string[] = [];
    if (Math.abs(right) / len > .34) k.push(right > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(down) / len > .34) k.push(down > 0 ? 'KeyS' : 'KeyW');
    return k;
  };
  const start = Date.now(), seconds = Number(values.seconds), shotEvery = Number(values.shot) * 1000;
  let dwellUntil = 0, skipped = false, lastEnd = 0, lastTap = 0, lastShot = 0, lastLog = 0, ri = 0, lastText = '', shotN = 0, best = Infinity, bestAt = Date.now();
  while (Date.now() - start < seconds * 1000) {
    const e = await page.evaluate(look);
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
      if (Date.now() - lastShot > shotEvery) { lastShot = Date.now(); await page.screenshot({ path: `${out}/s${String(shotN++).padStart(3, '0')}-t${e.tick}.jpg`, type: 'jpeg', quality: 70 }); }
      await page.waitForTimeout(250); continue;
    }
    if (e.panel.visible && e.panel.button) { log({ panel: e.panel, tick: e.tick }); await page.getByTestId(e.panel.button).click().catch(() => undefined); }
    const text = `${e.objective} | ${e.tracker}`;
    if (text !== lastText) { lastText = text; log({ tick: e.tick, objective: e.objective, tracker: e.tracker, subtitle: e.subtitle, prompt: e.prompt, apcBar: extra.apcBar, checkpoint: extra.checkpoint, phase: extra.phase }); }
    const foes = e.enemies.filter(b => b.drawn && !b.corpse && b.hp > 0).sort((a, b) => a.d - b.d);
    const target = foes.find(b => b.d < range);
    let keys: string[] = [];
    while (ri < route.length && Math.hypot(route[ri].x - e.player.x, route[ri].z - e.player.z) < 2.5) { log({ reached: route[ri], tick: e.tick }); ri++; dwellUntil = Date.now() + Number(values.dwell) * 1000; }
    if (ri < route.length) {
      const d = Math.hypot(route[ri].x - e.player.x, route[ri].z - e.player.z);
      if (d < best - .5) { best = d; bestAt = Date.now(); }
      else if (Date.now() - bestAt > 5000) { log({ routeBlocked: route[ri], d: +d.toFixed(1), tick: e.tick }); ri++; best = Infinity; bestAt = Date.now(); }
    }
    if (Date.now() < dwellUntil) keys = [];
    else if (ri < route.length) keys = dirKeys(e, route[ri], extra.azimuth);
    else if (target && target.d < 6 && !values['no-kite']) keys = dirKeys(e, target, extra.azimuth, true);
    else if (values['follow-marker'] && e.marker && e.marker.anchor) {
      const m = await page.evaluate(() => { const pin = document.querySelector<HTMLElement>('[data-testid="minimap-objective"]'); return pin && !pin.hidden ? { x: Number(pin.dataset.worldX), z: Number(pin.dataset.worldZ) } : null; });
      if (m && Number.isFinite(m.x)) keys = dirKeys(e, m, extra.azimuth);
    } else if (target && target.d > 12) keys = dirKeys(e, target, extra.azimuth);
    if (values['hold-e'] && e.prompt) keys.push('KeyE');
    // Space is the handbrake while driving: only fire on foot.
    if (target && !e.driving) { await page.mouse.move(target.aim.x, target.aim.y); keys.push('Space'); }
    await press(keys);
    if (values['tap-e-when'] && new RegExp(values['tap-e-when']).test(e.tracker ?? '') && Date.now() - lastTap > 1000) {
      lastTap = Date.now(); if (!held.has('KeyE')) { await page.keyboard.down('KeyE'); await page.waitForTimeout(80); await page.keyboard.up('KeyE'); log({ tapE: e.tracker, tick: e.tick }); }
    }
    if (Date.now() - lastLog > 3000) {
      lastLog = Date.now();
      log({ tick: e.tick, player: { x: +e.player.x.toFixed(1), z: +e.player.z.toFixed(1), hp: Math.round(e.player.hp), weapon: e.player.current, riding: e.player.riding }, driving: e.driving, apcBar: extra.apcBar, checkpoint: extra.checkpoint,
        enemies: foes.slice(0, 6).map(b => ({ kind: b.archetype ?? b.kind, hp: Math.round(b.hp), max: b.max, d: +b.d.toFixed(1), state: b.state })), allies: e.allies.filter(a => a.drawn).length,
        frames: await page.evaluate(() => (window as unknown as { __r28Frames: unknown[] }).__r28Frames.splice(0)),
        mega: await page.evaluate(() => { const w = (window.__SCENE__ as unknown as { game: { world: { megaPursuit?: { entity(): { health: { current: number; max: number }; transform: { x: number; z: number }; infected?: Record<string, unknown>; combat?: { staggerUntil?: number } } | undefined } } } }).game.world; const m = w.megaPursuit?.entity(); if (!m) return null; const b = m.infected ?? {}; return { hp: Math.round(m.health.current), x: +m.transform.x.toFixed(1), z: +m.transform.z.toFixed(1), phase: b.megaPhase, weak: b.megaWeakTicks, armourBroken: b.megaArmourBroken, special: (b as { specialAttack?: { move?: string } }).specialAttack?.move ?? null, stagger: m.combat?.staggerUntil, gateSpent: !!window.__SS__!.missions.state()?.states['gate-spent'], megaId: (m as unknown as { id: number }).id, megaLod: window.__SS__!.crowdFigures().find(f => f.id === (m as unknown as { id: number }).id)?.lod ?? null, drawnFigures: window.__SS__!.crowdFigures().filter(f => f.drawn).length }; }).catch(() => null) });
    }
    if (Date.now() - lastShot > shotEvery) { lastShot = Date.now(); await page.screenshot({ path: `${out}/s${String(shotN++).padStart(3, '0')}-t${e.tick}.jpg`, type: 'jpeg', quality: 70 }); }
    await page.waitForTimeout(100);
  }
  await press([]);
  log({ end: true, frames: await page.evaluate(() => (window as unknown as { __r28Frames: unknown[] }).__r28Frames.splice(0)), errors });
} finally { await context.close(); }
