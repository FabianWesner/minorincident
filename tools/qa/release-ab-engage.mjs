/** Native infected approached with physical keys/mouse, without shooting or adding enemies. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from '../browser-pool/client.ts';
import { newCampaign, preset } from '../../src/sim/progression/Campaign.ts';
import { prepareStop } from './ab-tour.ts';
const levels = (process.argv[2] ?? 'L1,L2,L3,L4,L5,L6,L7,L8,L9,L10').split(','), out = resolve('test-results/release-ab-1101/engagement'); mkdirSync(out, { recursive: true });
const checkpoints = { L1: 'accident', L2: 'doors', L3: 'armory', L4: 'turn', L5: 'outside', L6: 'abandon', L7: 'rocket', L8: 'breach' };
const receipt = resolve(out, `${levels.join('-')}.json`), rows = existsSync(receipt) ? JSON.parse(readFileSync(receipt, 'utf8')) : [];
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  for (const level of levels) for (const [side, origin] of [['prod', 'http://127.0.0.1:4902'], ['candidate', 'http://127.0.0.1:4901']]) {
    if (rows.some(r => r.side === side && r.level === level && r.result && !r.failure && !r.errors.length)) continue;
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }), page = await context.newPage(); page.setDefaultTimeout(120000);
    const row = { side, level, checkpoint: checkpoints[level], errors: [], trace: [], images: [] }, held = new Set();
    page.on('pageerror', e => row.errors.push(e.message));
    try {
      await page.addInitScript('window.__name = f => f');
      await page.goto(`${origin}/?test=1&testApi=1&scenelab=1&preload=0&quality=low&controls=wasd&audio=muted&dpr=1&seed=1`);
      await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
      const save = level === 'L1' ? newCampaign() : preset(`${level}-default`); save.settings.quality = 'low';
      const nativeBeat = ['L2', 'L4', 'L5', 'L6', 'L7', 'L8'].includes(level);
      row.proof = await page.evaluate(prepareStop, { stop: { id: `${level}-engage`, level, checkpoint: nativeBeat ? undefined : checkpoints[level] }, seed: 1, save, zoom: 1.5 });
      row.start = await page.evaluate(async level => {
        const a = window.__SS__, g = window.__SCENE__.game, w = g.world;
        a.bot.start('complete');
        const near = () => w.infected.active.some(e => e.health.current > 0 && !e.hidden && !e.infected.hidden && Math.hypot(e.transform.x - w.entities.get(1).transform.x, e.transform.z - w.entities.get(1).transform.z) < 80);
        const phase = () => { const m = w.missions.state; return level === 'L2' ? m.l2.doorsOpenAt > 0 : level === 'L4' ? m.l4.turnAt > 0 : level === 'L5' ? m.l5.phase === 'search' : level === 'L6' ? m.l6.phase === 'retreat' : level === 'L7' ? w.l7Encounters.state.started : level === 'L8' ? w.missions.l8.state.breachedAt > 0 : true; };
        for (let i = 0; i < 150 && (w.storyLock || !near() || !phase()) && !['result', 'progression'].includes(w.missions.state.phase); i++) await a.step(120);
        g.driver = null; g.input.release(); w.clearInput(); a.camera.follow(); a.camera.zoom(1.5); a.settings.set({ quality: 'low', vfx: true });
        if (level === 'L4') await a.step(1200);
        window.__engage = { start: w.tick, events: [], frames: [], route: { path: [], goal: -1, pathIndex: 0 }, target: null };
        for (const event of ['infected.attack', 'civilian.grabbed', 'combat.hit', 'vehicle.damage']) w.events.on(event, e => window.__engage.events.push(structuredClone(e)));
        g.input.tap = frame => { if (window.__engage.frames.length < 2000) window.__engage.frames.push({ tick: w.tick, move: { ...frame.move }, aimPoint: frame.aimPoint, strafe: frame.strafe }); };
        return { tick: w.tick, player: { ...w.entities.get(1).transform }, live: w.infected.active.filter(e => e.health.current > 0).length, phase: w.missions.state.phase, vehicle: w.vehicles.active };
      }, level);
      if (level === 'L9') {
        row.control = 'native vehicle bot; courier protected inside APC';
        await page.evaluate(async () => { window.__SS__.bot.start('complete'); await window.__SS__.step(1800); window.__SS__.bot.stop(); });
      } else {
        row.control = 'physical WASD and cursor aim; 1800 native sim ticks; no firing; god mode for observation';
        for (let tick = 0; tick < 1800; tick += 6) {
          const command = await page.evaluate(() => {
            const a = window.__SS__, g = window.__SCENE__.game, w = g.world, p = w.entities.get(1).transform, r = window.__engage;
            const enemies = w.infected.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected.hidden).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z));
            const target = enemies[0]; if (!target) return { keys: [], cursor: { x: 640, y: 360 } };
            r.target = target.id;
            const next = { ...target.transform }; w.infected.nav.steer(p, target.transform, r.route, .45, next, 3000, true, 8);
            const dx = next.x - p.x, dz = next.z - p.z, angle = g.view.view.azimuth, right = Math.cos(angle) * dx - Math.sin(angle) * dz, down = Math.sin(angle) * dx + Math.cos(angle) * dz, d = Math.hypot(right, down) || 1;
            const keys = Math.hypot(target.transform.x - p.x, target.transform.z - p.z) < .9 ? [] : [Math.abs(right) / d > .38 ? right > 0 ? 'KeyD' : 'KeyA' : '', Math.abs(down) / d > .38 ? down > 0 ? 'KeyS' : 'KeyW' : ''].filter(Boolean);
            const cursor = a.input.project(target.transform, 'destination');
            return { keys, cursor: { x: Math.max(60, Math.min(1220, cursor.x)), y: Math.max(100, Math.min(590, cursor.y)) } };
          });
          for (const key of [...held]) if (!command.keys.includes(key)) { await page.keyboard.up(key); held.delete(key); }
          for (const key of command.keys) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
          await page.mouse.move(command.cursor.x, command.cursor.y);
          await page.evaluate(() => window.__SS__.step(6));
          if (tick % 60 === 0) row.trace.push(await page.evaluate(() => { const a = window.__SS__, g = window.__SCENE__.game, p = g.world.entities.get(1).transform; return { tick: a.tick(), player: { ...p }, alive: g.world.infected.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected.hidden).length, drawn: a.crowdFigures().filter(f => f.drawn).map(f => f.id), near: g.world.infected.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 10).map(e => ({ id: e.id, at: { ...e.transform }, state: e.infected.state, target: e.infected.l1?.targetId ?? e.infected.targetId, script: e.infected.scripted, mode: e.infected.l1?.mode })) }; }));
          if (tick % 600 === 0) { await page.evaluate(() => window.__SS__.screenshotReady()); const image = `${level}-${side}-${tick}.jpg`; await page.screenshot({ path: resolve(out, image), type: 'jpeg', quality: 80 }); row.images.push(image); }
        }
      }
      row.result = await page.evaluate(() => { const r = window.__engage, g = window.__SCENE__.game; return { tick: g.world.tick, player: { ...g.world.entities.get(1).transform }, events: r.events, inputs: r.frames, firstAttackSeconds: r.events.filter(e => e.type === 'infected.attack' && e.targetId === 1).map(e => (e.tick - r.start) / 60)[0] ?? null, courierAttacks: r.events.filter(e => e.type === 'infected.attack' && e.targetId === 1).length, grabs: r.events.filter(e => e.type === 'civilian.grabbed' && e.targetId === 1).length, vehicle: g.world.missions.l9?.state }; });
      await page.evaluate(() => window.__SS__.screenshotReady()); const image = `${level}-${side}-1800.jpg`; await page.screenshot({ path: resolve(out, image), type: 'jpeg', quality: 80 }); row.images.push(image);
    } catch (e) { row.failure = String(e); }
    finally { for (const key of held) await page.keyboard.up(key).catch(() => {}); await context.close(); rows.push(row); writeFileSync(receipt, JSON.stringify(rows, null, 2)); console.log(JSON.stringify({ side, level, firstAttackSeconds: row.result?.firstAttackSeconds, attacks: row.result?.courierAttacks, failure: row.failure, errors: row.errors })); }
  }
} finally { await browser.close(); }
if (rows.some(r => r.failure || r.errors.length)) process.exitCode = 1;
