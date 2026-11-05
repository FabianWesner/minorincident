/** Real keyboard/mouse comparison against a separately served PROD checkout.
 * node --import tsx tools/qa/uat-scripted-engagement.ts <origin> <label> [L3|L4|L5|refuge]
 * Both servers are owned by the caller. Browsers always use the shared pool. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from '../browser-pool/client';
import type { Game } from '../../src/Game';

const [origin, label, only] = process.argv.slice(2);
if (!origin || !label) throw new Error('origin and report label required');
const out = 'test-results/q297'; mkdirSync(out, { recursive: true });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const rows: unknown[] = [], errors: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180_000);
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript('window.__name = fn => fn');
  const load = async () => {
    await page.goto(`${origin}/?test=1&scenelab=1&ui=1&debug=1&controls=wasd&quality=low&audio=muted&seed=1&preload=0`);
    await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__, null, { timeout: 180_000 });
    await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); window.__SS__!.settings.set({ quality: 'low' }); });
  };
  for (const level of (['L3', 'L4', 'L5'] as const).filter(l => !only || only === 'levels' || only === 'review' || only === l)) {
    await load();
    if (level === 'L5') {
      // Exercise the PO's debug-unlocked native level-list entry.
      await page.getByTestId('start-game').click();
      if (await page.getByTestId('character-female').isVisible()) await page.getByTestId('character-female').click();
      await page.getByTestId('level-L5').click({ force: true });
      await page.waitForFunction(() => (window.__SCENE__ as unknown as { game: Game }).game.world.scenario === 'L5' && !document.querySelector('[data-menu-screen=loading]:not([hidden])'));
    } else await page.evaluate(async level => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game, path = '/src/sim/progression/Campaign.ts';
      g.campaign = (await import(path)).preset(`${level}-default`); g.campaign!.settings.quality = 'low';
      await window.__SS__!.loadLevel(level, { seed: 1, checkpoint: level === 'L3' ? 'armory' : 'turn' });
    }, level);
    await page.evaluate(() => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5);
      g.ui.show(null); g.driver = null;
    });
    if (level !== 'L5') await page.evaluate(async level => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game, a = window.__SS__!;
      if (level === 'L3') {
        a.missions.completeObjective('defend');
        const zone = g.world.missions!.def.anchors['l3-zone'];
        a.teleport(1, { x: zone.x - 18, z: 0 });
        await a.step(600);
        const group = g.world.infected!.active.filter(e => e.health.current > 0 && e.infected!.l1?.mode === 'attracted').sort((a, b) => b.transform.x - a.transform.x)[0];
        if (group) {
          a.teleport(1, { x: group.transform.x + 1.5, z: group.transform.z + 1.1 });
          const hero = g.world.entities.get(1)!; hero.transform.y = group.transform.y;
          g.world.physics.playerBody!.setTranslation(hero.transform, true); g.world.physics.playerBody!.setNextKinematicTranslation(hero.transform); g.view.snapCamera();
        }
      } else for (let t = 0; t < 2400; t += 120) await a.step(120);
      g.driver = null; g.input.release(); g.world.clearInput();
    }, level);
    const trace: unknown[] = [];
    const walk = async (target: { x: number; z: number }, ticks: number, shoot = false) => {
      let route = { path: [] as number[], goal: -1, pathIndex: 0 };
      const held = new Set<string>();
      try {
        for (let t = 0; t < ticks; t += 6) {
          const cmd = await page.evaluate(({ target, route, shoot }) => {
            const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, p = w.entities.get(1)!.transform;
            const waypoint = { ...target };
            w.infected!.nav.steer(p, target, route, .45, waypoint, 3000, true, 8);
            const dx = waypoint.x - p.x, dz = waypoint.z - p.z, angle = g.view.view.azimuth;
            const right = Math.cos(angle) * dx - Math.sin(angle) * dz, below = Math.sin(angle) * dx + Math.cos(angle) * dz, length = Math.hypot(right, below) || 1;
            const keys = Math.hypot(target.x - p.x, target.z - p.z) < 1.1 ? [] : [Math.abs(right) / length > .38 ? right > 0 ? 'KeyD' : 'KeyA' : '', Math.abs(below) / length > .38 ? below > 0 ? 'KeyS' : 'KeyW' : ''].filter(Boolean);
            const enemy = shoot ? w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected!.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 15).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0] : undefined;
            const cursor = a.input.project(enemy?.transform ?? (shoot ? { x: p.x + 3, z: p.z } : target), 'destination');
            return { keys, route, cursor: { x: Math.max(60, Math.min(innerWidth - 60, cursor.x)), y: Math.max(110, Math.min(innerHeight - 150, cursor.y)) } };
          }, { target, route, shoot });
          route = cmd.route;
          for (const key of held) if (!cmd.keys.includes(key)) { await page.keyboard.up(key); held.delete(key); }
          for (const key of cmd.keys) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
          await page.mouse.move(cmd.cursor.x, cmd.cursor.y);
          if (shoot && !t) { await page.keyboard.down('ShiftLeft'); await page.mouse.down(); }
          await page.evaluate(async () => { await window.__SS__!.step(6); });
          if (t % 30 === 0) trace.push(await page.evaluate(() => {
            const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, p = w.entities.get(1)!, live = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected!.hidden);
            const near = live.filter(e => Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 16);
            return { tick: w.tick, p: { ...p.transform }, frame: { ...w.inputFrame }, ghost: w.inspectionGhost, hidden: p.hidden, near: near.map(e => ({ id: e.id, archetype: e.archetype, at: { ...e.transform }, state: e.infected!.state, target: e.infected!.heardTargetId || e.infected!.l1?.targetId, script: e.infected!.scripted, approach: e.infected!.l1?.mode, distance: Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z), sensed: w.infected!.hearing.notices(e, p.transform, 1) })) };
          }));
        }
      } finally { for (const key of held) await page.keyboard.up(key); if (shoot) { await page.mouse.up(); await page.keyboard.up('ShiftLeft'); } }
    };
    if (level === 'L5') {
      const brace = await page.evaluate(() => ({ ...(window.__SCENE__ as unknown as { game: Game }).game.world.missions!.def.anchors['l5-brace'] }));
      await walk(brace, 120); await page.keyboard.press('KeyE');
      await page.evaluate(async () => { await window.__SS__!.step(180); });
    }
    const fixture = await page.evaluate(level => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, p = w.entities.get(1)!.transform;
      const enemies = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected!.hidden);
      const directed = enemies.filter(e => e.infected!.scripted || e.infected!.l1?.mode === 'attracted');
      const pool = level === 'L5' ? enemies : directed.length ? directed : enemies;
      pool.sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z));
      const target = level === 'L4' ? { x: -32.15, z: 6.62 } : level === 'L3' ? { x: w.missions!.def.anchors['l3-zone'].x - 5, z: 0 } : pool[0]?.transform ?? w.missions!.def.anchors['l3-zone'];
      return { p: { ...p }, tier: w.infected!.director.tier, backend: g.perf().backend, controls: 'wasd-aim', phase: { phase: w.missions!.state.phase, checkpoint: w.missions!.state.checkpoint, l4: w.missions!.state.l4?.phase, l5: w.missions!.state.l5?.phase, active: Object.entries(w.missions!.state.steps).filter(([, s]) => s.status === 'active').map(([id]) => id) }, alive: enemies.length, directed: directed.length, target: { x: target.x, z: target.z }, picked: pool.slice(0, 8).map(e => ({ id: e.id, at: { ...e.transform }, script: e.infected!.scripted, mode: e.infected!.l1?.mode })) };
    }, level);
    console.log(label, level, JSON.stringify({ start: fixture.p, alive: fixture.alive, directed: fixture.directed, target: fixture.target }));
    const firstWalk = level === 'L3' ? 180 : level === 'L4' ? 360 : 600;
    await walk(fixture.target, firstWalk);
    await page.evaluate(async () => { await window.__SS__!.screenshotReady(); });
    await page.screenshot({ path: `${out}/${label}-${level}-approach.jpg`, type: 'jpeg', quality: 84 });
    if (firstWalk < 600) await walk(fixture.target, 600 - firstWalk);
    const standing = await page.evaluate(() => ({ ...window.__SS__!.getEntity(1)!.transform }));
    await walk(standing, 180);
    await page.evaluate(async () => { await window.__SS__!.screenshotReady(); });
    await page.screenshot({ path: `${out}/${label}-${level}-engaged.jpg`, type: 'jpeg', quality: 84 });
    await walk(standing, 120, true);
    const result = await page.evaluate(() => {
      const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
      return { tick: w.tick, p: w.entities.get(1)!.transform, phase: { phase: w.missions!.state.phase, checkpoint: w.missions!.state.checkpoint, l4: w.missions!.state.l4?.phase, l5: w.missions!.state.l5?.phase, active: Object.entries(w.missions!.state.steps).filter(([, s]) => s.status === 'active').map(([id]) => id) }, alive: w.infected!.active.filter(e => e.health.current > 0).length, attacks: a.events().filter(e => e.type === 'infected.attack' && e.targetId === 1), playerAttacks: a.events().filter(e => e.type === 'combat.attack' && e.sourceId === 1) };
    });
    await page.evaluate(async () => { await window.__SS__!.screenshotReady(); });
    await page.screenshot({ path: `${out}/${label}-${level}-mouse.jpg`, type: 'jpeg', quality: 84 });
    rows.push({ level, fixture, trace, result });
    writeFileSync(`${out}/${label}${only ? `-${only}` : ''}.json`, JSON.stringify({ rows, errors }, null, 2));
  }
  if (only === 'queue' || only === 'review') {
    await load();
    const fixture = await page.evaluate(async () => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game, path = '/src/sim/progression/Campaign.ts';
      game.campaign = (await import(path)).preset('L4-default'); game.campaign!.settings.quality = 'low';
      await a.loadLevel('L4', { seed: 1, checkpoint: 'turn' }); a.pause();
      const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, o = w.npcs!.civilians.outbreak!;
      g.ui.show(null); g.driver = null; w.storyLock = null;
      // Isolate the queue's walking/arrival from the battlefield. These remain
      // the original eight unarmed camp residents, with live solids and routines.
      w.missions!.l4!.update = () => {}; w.infected!.director.update = () => {};
      for (const e of [...w.infected!.active]) w.infected!.release(e);
      const people = w.missions!.state.l4!.residentIds.map(id => w.entities.get(id)!).filter(e => e.civilian && !e.civilian.ally && !e.civilian.pet && !e.infection && e.health.current > 0).slice(0, 8);
      if (people.length !== 8) throw new Error('Native eight-person shelter cohort unavailable');
      const ids = people.map(e => e.id);
      for (const e of w.entities.iterate()) if (e.civilian || e.companion) e.hidden = !ids.includes(e.id);
      const door = o.refuges.find(r => r.id === 'refuge-door-22')!;
      const source = people.map(e => ({ id: e.id, at: { ...e.transform }, schedule: e.civilian!.schedule }));
      for (const [i, e] of people.entries()) {
        a.teleport(e.id, { x: door.x - 5 + i % 3 * .85, z: door.z + Math.floor(i / 3) * .85 });
        const c = e.civilian!; c.state = 'flee'; c.story = null; c.path.length = 0; c.goal = -1;
        c.l1!.refuge = door.id; c.l1!.target = (o as unknown as { refugeSpot(person: typeof e, refuge: typeof door): { x: number; z: number } | null }).refugeSpot(e, door);
        if (!c.l1!.target) throw new Error('Shelter reservation unavailable');
        c.l1!.repickAt = w.tick + 100_000; delete c.l1!.doorAt;
      }
      a.teleport(1, { x: -4.76, z: 19.69 }); a.camera.follow(); a.camera.zoom(1.5);
      return { ids, source, door, isolation: 'Native residents; battlefield director paused; real movement, solids, shelter slots and routines' };
    });
    await page.addStyleTag({ content: '.story-bubble,.mission-subtitle{visibility:hidden!important}' });
    const samples: unknown[] = [];
    for (const [time, ticks] of [[3, 180], [23, 1200]]) {
      await page.evaluate(async ticks => { await window.__SS__!.step(ticks); }, ticks);
      const state = await page.evaluate(ids => {
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        const people = ids.map(id => w.entities.get(id)!);
        const idle = people.filter(e => !e.hidden && e.civilian!.state === 'calm' && e.civilian!.schedule?.[e.civilian!.scheduleStep ?? 0]?.anchor === 'refuge/shelter');
        const distances = idle.flatMap((e, i) => idle.slice(i + 1).map(other => Math.hypot(e.transform.x - other.transform.x, e.transform.z - other.transform.z)));
        return { tick: w.tick, entered: people.filter(e => e.hidden && e.health.current > 0).length, minimumIdleGap: distances.length ? Math.min(...distances) : null, people: people.map(e => ({ id: e.id, hp: e.health.current, hidden: e.hidden, at: { ...e.transform }, state: e.civilian!.state, activity: e.civilian!.schedule?.[e.civilian!.scheduleStep ?? 0] })) };
      }, fixture.ids);
      samples.push({ time, ...state });
      for (const quality of ['low', 'high'] as const) {
        await page.evaluate(async quality => { window.__SS__!.settings.set({ quality }); await window.__SS__!.screenshotReady(); }, quality);
        await page.screenshot({ path: `${out}/${label}-queue-${time}s-${quality}.jpg`, type: 'jpeg', quality: 86 });
      }
      console.log(label, 'queue', time, JSON.stringify({ entered: state.entered, minimumIdleGap: state.minimumIdleGap }));
    }
    rows.push({ level: 'queue', fixture, samples });
  }
  if (!only || only.startsWith('refuge')) {
    await load();
    await page.evaluate(async early => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game, presetPath = '/src/sim/progression/Campaign.ts';
      game.campaign = (await import(presetPath)).preset('L4-default'); game.campaign!.settings.quality = 'low';
      await a.loadLevel('L4', { seed: 1, ...(early === 'early' ? { checkpoint: 'turn' } : {}) }); a.pause(); a.missions.begin(); a.cheats.god(true);
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      if (early !== 'early') {
        const path = '/src/debug/bot/LevelFourBot.ts';
        const { LevelFourBot } = await import(path); g.driver = new LevelFourBot(g.world, 'complete');
        const until = early === 'late' ? 16000 : 7676;
        while (g.world.tick < until && (early !== 'late' || g.world.missions!.state.l4!.phase !== 'collapse')) await a.step(Math.min(300, until - g.world.tick));
      }
      g.driver = null; g.input.release(); g.world.clearInput(); a.teleport(1, { x: -4.76, z: 19.69 }); a.camera.zoom(1.5); a.camera.follow();
      if (early === 'early') await a.step(1200);
    }, only === 'refuge-early' ? 'early' : only === 'refuge-late' ? 'late' : 'full');
    const audit = await page.evaluate(() => {
      const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
      const people = [...w.entities.iterate()].filter(e => e.civilian && !e.hidden && e.health.current > 0);
      const near = people.filter(e => Math.hypot(e.transform.x + 4.76, e.transform.z - 19.69) < 20);
      return { tick: w.tick, phase: w.missions!.state.l4?.phase, checkpoint: w.missions!.state.checkpoint, entered: [...w.entities.iterate()].filter(e => e.hidden && e.civilian?.schedule?.[e.civilian.scheduleStep ?? 0]?.anchor === 'refuge/inside').length, people: near.map(e => ({ id: e.id, at: { ...e.transform }, state: e.civilian!.state, ally: !!e.civilian!.ally, activity: e.civilian!.schedule?.[e.civilian!.scheduleStep ?? 0], l1: e.civilian!.l1 })), idleOverlaps: people.flatMap((a, i) => people.slice(i + 1).filter(b => ['hide', 'calm'].includes(a.civilian!.state) && ['hide', 'calm'].includes(b.civilian!.state) && Math.hypot(a.transform.x - b.transform.x, a.transform.z - b.transform.z) < .7).map(b => ({ a: a.id, b: b.id, distance: Math.hypot(a.transform.x - b.transform.x, a.transform.z - b.transform.z) }))) };
    });
    for (const quality of ['low', 'high'] as const) {
      await page.evaluate(async quality => { window.__SS__!.settings.set({ quality }); await window.__SS__!.screenshotReady(); }, quality);
      await page.screenshot({ path: `${out}/${label}-${only ?? 'refuge'}-${quality}.jpg`, type: 'jpeg', quality: 86 });
    }
    rows.push({ level: 'refuge', audit }); console.log(label, 'refuge', JSON.stringify(audit));
  }
} finally { writeFileSync(`${out}/${label}${only ? `-${only}` : ''}.json`, JSON.stringify({ rows, errors }, null, 2)); await browser.close(); }
