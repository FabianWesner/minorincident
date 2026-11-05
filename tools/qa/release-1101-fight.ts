/** Release QA 2026-11-01: per level, a progressed save (debug level-list entry = the level's campaign boundary save,
 * gear shown at tier >= 2), 90 s of real fighting by physical WASD + mouse aim (LMB held on the drawn chest), screenshots
 * at zoom 1.5 and 0.5. Diagnostics (read only, never fed back into inputs): infected engagement, alphas, marker motion,
 * HUD home button, attacks taken and dealt. The caller owns the preview server (current build or the PROD checkout).
 *
 *   node --import tsx tools/qa/release-1101-fight.ts <origin> <label> <low|high> [L1,L2,...] [seconds]
 * Frames + rows go to test-results/release-qa/fight/<label>-<tier>/ (git-ignored; RQ_OUT overrides the root, RQ_RENDERER=webgl forces WebGL2). Browsers come from the shared pool.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from '../browser-pool/client';
import type { Game } from '../../src/Game';
import { look } from '../playtest/eyes';

const [origin, label, tierArg, levelArg, secondsArg] = process.argv.slice(2);
if (!origin || !label) throw new Error('origin and label required');
const tier = tierArg === 'high' ? 'high' : 'low';
const levels = (levelArg ?? 'L1,L2,L3,L4,L5,L6,L7,L8,L9,L10').split(',');
const seconds = Number(secondsArg ?? 90);
const out = `${process.env.RQ_OUT ?? 'test-results/release-qa/fight'}/${label}-${tier}`; mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
const save = () => writeFileSync(`${out}/rows.json`, JSON.stringify(rows, null, 1));
try {
  for (const level of levels) {
    const errors: string[] = [];
    // One pool reservation per level (the pool caps a reservation at ten minutes).
    const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(240_000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
    await page.addInitScript('window.__name = fn => fn');
    const row: Record<string, unknown> = { level, tier, label };
    try {
      const t0 = Date.now();
      await page.goto(`${origin}/?test=1&scenelab=1&ui=1&debug=1&controls=wasd&quality=${tier}&audio=muted&seed=1&preload=0${process.env.RQ_RENDERER ? '&renderer=' + process.env.RQ_RENDERER : ''}`);
      await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__, null, { timeout: 180_000 });
      await page.evaluate(async () => { await window.__SS__!.ready; });
      // Real menu path, as the PO enters levels (debug-unlocked level list).
      await page.getByTestId('start-game').click();
      if (await page.getByTestId('character-female').isVisible().catch(() => false)) await page.getByTestId('character-female').click();
      await page.getByTestId(`level-${level}`).click({ force: true });
      await page.waitForFunction(l => (window.__SCENE__ as unknown as { game: Game }).game.world.scenario === l && !document.querySelector('[data-menu-screen=loading]:not([hidden])') && !(document.querySelector('[data-testid=level-transition]') as HTMLElement | null && !(document.querySelector('[data-testid=level-transition]') as HTMLElement).hidden), level, { timeout: 240_000 });
      row.loadSeconds = (Date.now() - t0) / 1000;
      // Story card / briefing: real clicks until the mission plays.
      for (let i = 0; i < 40; i++) {
        const state = await page.evaluate(() => ({ phase: window.__SS__!.missions.state()?.phase, button: (document.querySelector('[data-testid=mission-button]') as HTMLElement | null)?.offsetParent ? document.querySelector('[data-testid=mission-button]')!.textContent : null }));
        if (state.phase === 'playing') break;
        if (state.button) await page.getByTestId('mission-button').click().catch(() => {});
        else await page.mouse.click(640, 360);
        await page.waitForTimeout(500);
      }
      // L1 opens with the peaceful delivery: start the fighting part at the authored accident checkpoint (same campaign save).
      const fightCheckpoint: Record<string, string> = { L1: 'accident', L2: 'doors', ...JSON.parse(process.env.RQ_CHECKPOINTS ?? '{}') };
      if (fightCheckpoint[level]) {
        await page.evaluate(async ({ level, checkpoint }) => { await window.__SS__!.loadLevel(level as never, { seed: 1, checkpoint } as never); }, { level, checkpoint: fightCheckpoint[level] });
        for (let i = 0; i < 20; i++) {
          const phase = await page.evaluate(() => window.__SS__!.missions.state()?.phase);
          if (phase === 'playing') break;
          await page.getByTestId('mission-button').click({ timeout: 2000 }).catch(() => page.mouse.click(640, 360));
          await page.waitForTimeout(400);
        }
        row.checkpoint = fightCheckpoint[level];
      }
      row.home = await page.evaluate(() => { const h = document.querySelector<HTMLElement>('[data-testid=home-button]'); return h ? { hidden: h.hidden, shown: !!h.offsetParent } : null; });
      // The campaign save carries its own quality setting: apply the requested tier explicitly.
      await page.evaluate(t => window.__SS__!.settings.set({ quality: t as 'low' | 'high' }), tier);
      row.fixture = await page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
        a.pause(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5);
        const campaign = a.campaign.state() as unknown as { racks?: unknown; ownedActions?: string[]; survivors?: string[] } | null;
        const p = w.entities.get(1)!;
        const all = [...w.entities.iterate()];
        return {
          phase: w.missions?.state.phase, tick: w.tick, backend: g.perf().backend, quality: g.quality.tier, racks: campaign?.racks, survivors: campaign?.survivors,
          player: { ...p.transform }, riding: !!(p as unknown as { riding?: number }).riding,
          infected: all.filter(e => e.faction === 'infected' && e.health.current > 0).length,
          alphas: all.filter(e => e.faction === 'infected' && /alpha|mega|riot|brute|tank/i.test(e.archetype ?? '')).map(e => ({ id: e.id, archetype: e.archetype, hp: e.health.current, hidden: !!e.hidden, at: { x: +e.transform.x.toFixed(1), z: +e.transform.z.toFixed(1) } })),
          allies: all.filter(e => e.id !== 1 && (e.companion || e.faction === 'survivor' || e.civilian?.survivor || e.escort)).length,
        };
      });
      // Gear tier >= 2 look on the progressed save (visual only; the campaign tier is reported).
      row.gear = await page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        const sv = g.world.entities.get(1)!.survivor as unknown as { gearTier?: number; variant?: string } | undefined;
        const before = sv?.gearTier;
        if ((before ?? 0) < 2) await a.survivor.select((sv?.variant ?? 'female') as never, 2 as never);
        return { campaignTier: before, shown: Math.max(2, before ?? 0) };
      }).catch(e => ({ error: String(e) }));
      if ((row.fixture as { riding: boolean }).riding) { await page.keyboard.press('KeyE'); await page.evaluate(async () => { await window.__SS__!.step(90); }); }
      // Diagnostics hooks: attacks on / by the player and explosions.
      await page.evaluate(() => {
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        const log = { taken: 0, dealt: 0, hits: 0, blasts: [] as { x: number; z: number; tick: number }[], clicks: [] as { x: number; z: number; tick: number }[] };
        (window as unknown as { __rq: typeof log }).__rq = log;
        w.events.on('infected.attack', e => { if (e.type === 'infected.attack' && e.targetId === 1) log.taken++; });
        w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1) log.dealt++; });
        w.events.on('combat.hit', e => { if (e.type === 'combat.hit' && e.sourceId === 1) log.hits++; });
        w.events.on('explosion', e => { if (e.type === 'explosion') log.blasts.push({ x: e.position.x, z: e.position.z, tick: e.tick }); });
      });
      const held = new Set<string>(); let lmb = false, strafe = 1, stuck = 0, lastPos = { x: 0, z: 0 }, route = { path: [] as number[], goal: -1, pathIndex: 0 };
      const samples: unknown[] = [], shots: string[] = [];
      const ticks = seconds * 60;
      const shotAt = new Map([[Math.round(ticks * .2), 1.5], [Math.round(ticks * .4), .5], [Math.round(ticks * .6), 1.5], [Math.round(ticks * .8), .5], [ticks - 6, 1.5]]);
      let lastMarker: { step: string | null; anchor: string | null; x: number; z: number } | null = null;
      const markerMoves: unknown[] = [];
      for (let t = 0; t < ticks; t += 6) {
        const e = await page.evaluate(look);
        if (e.panel.visible && e.panel.button && e.phase !== 'playing') { await page.getByTestId('mission-button').click().catch(() => {}); }
        const p = e.player;
        let cursor = { x: e.view.w / 2 + 120, y: e.view.h / 2 }, fire = false;
        const enemy = e.enemies.find(b => b.drawn);
        // RQ_PASSIVE=1: never attack (does the horde chase and hit a courier who does not fight back?).
        if (p && enemy && enemy.d < 10 && !process.env.RQ_PASSIVE) { fire = true; cursor = enemy.aim; } else if (p && enemy) cursor = enemy.aim;
        if (t % 600 === 0) strafe = -strafe;
        // Fixture navigation (nav mesh steer toward the nearest live infected, else the objective anchor); keys are physical WASD.
        const nav = await page.evaluate(({ route, strafe, passive }) => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, p = w.entities.get(1)!.transform, m = w.missions!;
          const live = (w.infected?.active ?? []).filter(e => e.health.current > 0 && !e.hidden && !e.infected!.hidden && e.archetype !== 'infected.crow');
          live.sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z));
          const foe = live[0] && Math.hypot(live[0].transform.x - p.x, live[0].transform.z - p.z) < 45 ? live[0].transform : null;
          const anchor = m.state.marker ? m.def.anchors[m.state.marker] : null;
          let target = foe ?? anchor ?? { x: p.x + 5, z: p.z };
          const fd = foe ? Math.hypot(foe.x - p.x, foe.z - p.z) : 99;
          if (foe && fd < 9 && !passive) {
            // Circle-strafe the threat; back off when it touches.
            const rx = p.x - foe.x, rz = p.z - foe.z, r = fd || 1;
            target = fd < 2 ? { x: p.x + rx / r * 3, z: p.z + rz / r * 3 } : { x: p.x - rz / r * 3 * strafe + rx / r * (6 - fd) * .4, z: p.z + rx / r * 3 * strafe + rz / r * (6 - fd) * .4 };
          }
          const waypoint = { ...target };
          if (passive && foe && fd < 3) target = { ...p };
          if (!(foe && fd < 9) || passive) w.infected?.nav.steer(p, target, route, .45, waypoint, 3000, true, 8);
          const dx = waypoint.x - p.x, dz = waypoint.z - p.z, angle = g.view.view.azimuth;
          const right = Math.cos(angle) * dx - Math.sin(angle) * dz, below = Math.sin(angle) * dx + Math.cos(angle) * dz, length = Math.hypot(right, below) || 1;
          const keys = Math.hypot(target.x - p.x, target.z - p.z) < .8 || Math.hypot(dx, dz) < .05 ? [] : [Math.abs(right) / length > .38 ? right > 0 ? 'KeyD' : 'KeyA' : '', Math.abs(below) / length > .38 ? below > 0 ? 'KeyS' : 'KeyW' : ''].filter(Boolean);
          return { keys, route, wp: { x: +waypoint.x.toFixed(1), z: +waypoint.z.toFixed(1) }, target: { x: +target.x.toFixed(1), z: +target.z.toFixed(1) } };
        }, { route, strafe, passive: !!process.env.RQ_PASSIVE });
        if (process.env.RQ_DEBUG && t % 120 === 0) console.log(t, JSON.stringify({ p: p && { x: +p.x.toFixed(1), z: +p.z.toFixed(1) }, keys: nav.keys, wp: nav.wp, target: nav.target, stuck }));
        route = nav.route; let keys = nav.keys;
        if (stuck > 90) { keys = [['KeyA'], ['KeyD'], ['KeyW'], ['KeyS']][Math.floor(t / 120) % 4]; if (stuck > 210) stuck = 0; }
        if (p) { if (Math.hypot(p.x - lastPos.x, p.z - lastPos.z) < .02 && keys.length) stuck += 6; else stuck = Math.max(0, stuck - 6); lastPos = { x: p.x, z: p.z }; }
        cursor = { x: Math.max(20, Math.min(e.view.w - 20, cursor.x)), y: Math.max(90, Math.min(e.view.h - 120, cursor.y)) };
        for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
        for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
        await page.mouse.move(cursor.x, cursor.y);
        // RQ_SPACE=1: attack with Space (aim assist) instead of LMB, so PROD's click-to-move build fights the same way.
        if (process.env.RQ_SPACE) { if (fire && !lmb) { await page.keyboard.down('Space'); lmb = true; } else if (!fire && lmb) { await page.keyboard.up('Space'); lmb = false; } }
        else if (fire && !lmb) { await page.mouse.down(); lmb = true; } else if (!fire && lmb) { await page.mouse.up(); lmb = false; }
        await page.evaluate(async () => { window.__SS__!.pause(); await window.__SS__!.step(6); });
        if (t % 60 === 0) {
          const s = await page.evaluate(() => {
            const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, p = w.entities.get(1)!, m = w.missions!;
            const live = (w.infected?.active ?? []).filter(e => e.health.current > 0 && !e.hidden && !e.infected!.hidden);
            const near = live.filter(e => Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 12);
            const step = Object.entries(m.state.steps).find(([, s]) => s.status === 'active')?.[0] ?? null;
            const anchor = m.state.marker ? m.def.anchors[m.state.marker] : null;
            const figures = g.view.crowdFigures() as unknown as { id: number; drawn: boolean; joints?: Record<string, number[]> }[];
            // Tilt of drawn infected: hip->head angle from vertical.
            const walkers = new Map(near.filter(e => /^(chase|wander|attracted|search|idle)$/.test(e.infected!.state) && e.motion?.moving && e.archetype !== 'infected.crawler').map(e => [e.id, e]));
            const tilts = figures.filter(f => f.drawn && f.joints?.hip && f.joints.head && walkers.has(f.id)).map(f => { const h = f.joints!.hip, d = f.joints!.head; return Math.round(Math.atan2(Math.hypot(d[0] - h[0], d[2] - h[2]), d[1] - h[1]) * 180 / Math.PI); });
            const tilted = figures.filter(f => f.drawn && f.joints?.hip && f.joints.head && walkers.has(f.id)).filter(f => { const h = f.joints!.hip, d = f.joints!.head; return Math.atan2(Math.hypot(d[0] - h[0], d[2] - h[2]), d[1] - h[1]) > 50 * Math.PI / 180; }).map(f => { const e = walkers.get(f.id)!; return { id: f.id, archetype: e.archetype, state: e.infected!.state, x: +e.transform.x.toFixed(1), z: +e.transform.z.toFixed(1) }; });
            return { tick: w.tick, p: { x: +p.transform.x.toFixed(1), z: +p.transform.z.toFixed(1) }, hp: p.health.current, step, marker: m.state.marker, anchor: anchor ? { x: +anchor.x.toFixed(1), z: +anchor.z.toFixed(1) } : null,
              live: live.length, near: near.length, nearStates: near.reduce<Record<string, number>>((o, e) => { o[e.infected!.state] = (o[e.infected!.state] ?? 0) + 1; return o; }, {}),
              closest: near.sort((a, b) => Math.hypot(a.transform.x - p.transform.x, a.transform.z - p.transform.z) - Math.hypot(b.transform.x - p.transform.x, b.transform.z - p.transform.z)).slice(0, 3).map(e => { const f = figures.find(f => f.id === e.id) as unknown as { drawn: boolean; lod?: string; joints?: Record<string, number[]> } | undefined; return { id: e.id, a: e.archetype, st: e.infected!.state, y: +(e.transform.y ?? 0).toFixed(2), d: +Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z).toFixed(1), drawn: !!f?.drawn, lod: f?.lod, head: f?.joints?.head?.map(v => +v.toFixed(2)) }; }),
              scripted: near.filter(e => e.infected!.scripted).length, tilts, tilted, rq: { ...(window as unknown as { __rq: object }).__rq, blasts: undefined, clicks: undefined } };
          });
          samples.push(s);
          if (lastMarker && lastMarker.step === s.step && lastMarker.anchor === s.marker && s.anchor && Math.hypot(s.anchor.x - lastMarker.x, s.anchor.z - lastMarker.z) > .5) markerMoves.push({ tick: s.tick, step: s.step, marker: s.marker, from: lastMarker, to: s.anchor, player: s.p });
          if (s.anchor) lastMarker = { step: s.step, anchor: s.marker, x: s.anchor.x, z: s.anchor.z };
        }
        for (const [at, zoom] of shotAt) if (t <= at && at < t + 6) {
          await page.evaluate(async zoom => { const a = window.__SS__!; a.camera.zoom(zoom); await a.step(1); await a.screenshotReady(); }, zoom);
          const file = `${out}/${level}-t${Math.round(t / 60)}-z${zoom}.jpg`;
          await page.screenshot({ path: file, type: 'jpeg', quality: 80 }); shots.push(file);
          await page.evaluate(() => window.__SS__!.camera.zoom(1.5));
        }
      }
      for (const k of held) await page.keyboard.up(k); if (lmb) { if (process.env.RQ_SPACE) await page.keyboard.up('Space'); else await page.mouse.up(); }
      const end = await page.evaluate(() => { const w = (window.__SCENE__ as unknown as { game: Game }).game.world; return { rq: (window as unknown as { __rq: object }).__rq, phase: w.missions?.state.phase, step: Object.entries(w.missions!.state.steps).find(([, s]) => s.status === 'active')?.[0] ?? null, completed: Object.values(w.missions!.state.steps).filter(s => s.status === 'completed').length, perf: (window.__SCENE__ as unknown as { game: Game }).game.perf() }; });
      const engagedSamples = (samples as { near: number; nearStates: Record<string, number> }[]).filter(s => s.near > 0);
      Object.assign(row, { samples, shots, markerMoves, end: { ...end, perf: { backend: (end.perf as { backend?: string }).backend } }, engagedSamples: engagedSamples.length,
        maxTilt: Math.max(0, ...(samples as { tilts: number[] }[]).flatMap(s => s.tilts)), errors });
      console.log(JSON.stringify({ level, tier, label, load: row.loadSeconds, home: row.home, alphas: (row.fixture as { alphas: unknown[] }).alphas.length, infected: (row.fixture as { infected: number }).infected, engaged: engagedSamples.length, rq: end.rq && { ...(end.rq as object), blasts: undefined }, markerMoves: markerMoves.length, maxTilt: row.maxTilt, errors: errors.length }));
    } catch (error) { row.error = String(error).slice(0, 800); row.errors = errors; console.log(JSON.stringify({ level, tier, label, error: row.error })); await page.screenshot({ path: `${out}/${level}-error.jpg`, type: 'jpeg', quality: 70 }).catch(() => {}); }
    rows.push(row); save();
    await page.close(); await browser.close();
  }
} finally { save(); }
