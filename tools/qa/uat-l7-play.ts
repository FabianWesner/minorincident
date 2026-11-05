/** Isolated L7 fixtures, real DOM controls for escort passage and rocket discharge. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.argv[2] ?? 'test-results/uat-l7/play';
const tier = (process.argv[3] ?? 'high') as 'high' | 'low';
mkdirSync(out, { recursive: true });
const s = new SceneSession({ backend: 'webgl2', tier, viewport: { width: 1280, height: 800 }, query: { level: 'L7' } });
const evidence: unknown[] = [];
try {
  await s.open(); await s.page.evaluate('globalThis.__name = (fn) => fn');
  const walks: ('lake' | 'northgate')[] = process.argv.includes('--shots-only') ? [] : ['lake', 'northgate'];
  for (const spot of walks) {
    await s.page.evaluate(async ({ spot, tier }) => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      g.params.set('quality', 'high'); a.settings.set({ quality: 'high' });
      await a.loadLevel('L7', { seed: 29, progression: 'L7-default' }); a.settings.set({ quality: tier }); a.pause(); a.camera.follow(); a.cheats.god(true);
      const w = g.world, roster = w.l7Encounters!.state.roster;
      // Match the PO's 19-person carried group. Only fixture placement is scripted;
      // every subsequent movement comes from physical WASD keys.
      for (const row of roster.splice(19)) w.entities.delete(row.id);
      const x = spot === 'lake' ? -30 : 233, z = spot === 'lake' ? 60 : 42;
      a.teleport(1, { x, z });
      roster.forEach((row, i) => a.teleport(row.id, { x: x + (i % 5 - 2) * .9, z: z + Math.floor(i / 5) * .45 }));
      if (spot === 'lake') {
        w.missions!.state.steps.rocket.status = 'completed'; w.missions!.state.completedObjectives = ['rocket'];
        w.missions!.state.steps.corridor.status = 'active';
      }
      g.view.view.zoom(Math.log(1.5 / g.view.view.getState().targetZoom), true);
      await a.step(1); await a.screenshotReady();
    }, { spot, tier });
    await s.page.screenshot({ path: `${out}/${spot}-group-start.jpg`, type: 'jpeg', quality: 85 });
    const trace = [];
    for (let i = 0; i < 12; i++) {
      const waypoints = spot === 'lake' ? [53, 46, 40] : [35, 28, 21, 15];
      const z = waypoints[Math.min(Math.floor(i / 2), waypoints.length - 1)];
      for (let part = 0; part < 5; part++) {
        const keys = await s.page.evaluate(({ spot, z }) => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game, p = g.world.entities.get(1)!.transform;
          const dx = (spot === 'lake' ? -30 : 233) - p.x, dz = z - p.z, a = g.view.view.azimuth, d = Math.hypot(dx, dz);
          const x = Math.cos(a) * dx - Math.sin(a) * dz, y = Math.sin(a) * dx + Math.cos(a) * dz, keys: string[] = [];
          if (d > .5) {
            if (Math.abs(x) / d > .35) keys.push(x > 0 ? 'KeyD' : 'KeyA');
            if (Math.abs(y) / d > .35) keys.push(y > 0 ? 'KeyS' : 'KeyW');
          }
          return keys;
        }, { spot, z });
        for (const key of keys) await s.page.keyboard.down(key);
        await s.page.evaluate(() => window.__SS__!.step(30));
        for (const key of keys) await s.page.keyboard.up(key);
      }
      trace.push(await s.page.evaluate(async () => {
        const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        return { tick: a.tick(), player: a.getEntity(1)!.transform, rescues: w.trapRescue?.rescues ?? 0, group: w.l7Encounters!.corridorGroup(), followers: w.l7Encounters!.state.roster.map(r => a.getEntity(r.id)!.transform) };
      }));
      if ([1, 4, 11].includes(i)) { await s.ready(); await s.page.screenshot({ path: `${out}/${spot}-group-${i}.jpg`, type: 'jpeg', quality: 85 }); }
    }
    evidence.push({ spot, trace });
    writeFileSync(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
    const end = trace.at(-1)!;
    assert.equal(end.group.total, 19); assert.equal(end.group.near, 19);
    assert.equal(end.rescues, 0, 'passage uses locomotion, without a trap rescue');
    assert.ok(end.followers.every(p => p.z < (spot === 'lake' ? 56.65 : 30)), `${spot}: every follower crossed`);
    assert.ok(spot !== 'northgate' || end.followers.every(p => p.y > 4), 'group climbed the embankment');
    console.log(`${spot}: 19/19 crossed, player ${JSON.stringify(end.player)}`);
  }
  // Automatic approach pickup, then real-time overlapping rockets (muted hardware
  // output, live audio graph) so anti-spam/voice lifetimes use actual time.
  await s.page.evaluate(async tier => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    g.params.set('quality', 'high'); a.settings.set({ quality: 'high' }); await a.loadLevel('L7', { seed: 29, progression: 'L7-default' }); a.settings.set({ quality: tier });
    a.pause(); a.camera.follow(); a.cheats.god(true); a.teleport(1, { x: 276, z: 15 }); await a.step(1);
    g.view.view.zoom(Math.log(2 / g.view.view.getState().targetZoom), true); await a.step(1);
  }, tier);
  await s.page.evaluate(async () => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    a.teleport(1, { x: 266, z: 15 }); a.settings.set({ muted: false, cameraShake: false });
    g.audio.graph.output.gain.value = 0; await a.audio.unlock(); await a.step(30); a.audio.clearLog();
  });
  const point = await s.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game, q = g.view.project(251, 3.9, 15);
    let count = 0;
    const stop = g.world.events.on('combat.attack', e => {
      if (e.type === 'combat.attack' && e.actionId === 'weapon.rocket-launcher' && ++count === 5) { window.__SS__!.pause(); stop(); }
    });
    return { x: (q[0] + 1) * innerWidth / 2, y: (1 - q[1]) * innerHeight / 2, tick: g.world.tick, weapon: g.world.combat!.runner.loadout.current(g.world.combat!.runner.loadout.state.selectedSide).id };
  });
  console.log('salvo input', JSON.stringify(point));
  assert.equal(point.weapon, 'weapon.rocket-launcher'); assert.ok(point.x > 0 && point.x < 1280 && point.y > 0 && point.y < 800);
  await s.page.mouse.move(point.x, point.y); await s.page.keyboard.down('Shift'); await s.page.mouse.down();
  await s.page.evaluate(() => window.__SS__!.resume());
  const peaks: unknown[] = [];
  for (let shot = 1; shot <= 5; shot++) {
    await s.page.waitForFunction(({ tick, shot }) => (window.__SCENE__ as unknown as { game: Game }).game.world.events.events().filter(e => e.type === 'combat.attack' && e.tick >= tick).length >= shot, { tick: point.tick, shot });
    peaks.push(await s.page.evaluate(() => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      return { tick: a.tick(), flying: g.world.combat!.projectiles.length, effects: a.perf().effects, audio: a.audio.emitters() };
    }));
    await s.page.screenshot({ path: `${out}/five-rockets-${shot}.jpg`, type: 'jpeg', quality: 85 });
  }
  await s.page.mouse.up(); await s.page.keyboard.up('Shift');
  await s.page.evaluate(() => window.__SS__!.resume());
  await s.page.waitForTimeout(1400); await s.page.evaluate(() => window.__SS__!.pause());
  const salvo = await s.page.evaluate(tick => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    return { events: g.world.events.events().filter(e => e.tick >= tick && (e.type === 'combat.attack' || e.type === 'combat.exploded')), peaks: a.perf().effects, audio: a.audio.snapshot() };
  }, point.tick);
  evidence.push({ salvo, peaks });
  const shots = salvo.events.filter(e => e.type === 'combat.attack');
  assert.equal(shots.length, 5);
  assert.ok(shots.slice(1).every((e, i) => e.tick - shots[i].tick === 25));
  assert.equal(salvo.audio.cues.filter(e => e.cue === 'action.weapon.rocket-launcher').length, 5);
  assert.equal(salvo.audio.cues.filter(e => e.cue === 'explosion.crack').length, 5);
  assert.equal(salvo.audio.cues.filter(e => e.cue === 'explosion.boom').length, 5);
  assert.equal(salvo.events.filter(e => e.type === 'combat.exploded').length, 5);
  assert.deepEqual(salvo.peaks?.blasts.poolOverwrites, { fireballs: 0, chunks: 0 });
  assert.ok(salvo.peaks?.shots.every(shot => Math.hypot(...shot.end.map((n, i) => n - shot.muzzle[i])) < .01), 'rockets have no horizontal hitscan tracer');
  // Five exact ground endpoints, including a WASD + mouse shot. Stop after one
  // tick of trigger input to avoid a repeated discharge at the faster cadence.
  for (const [i, distance] of [4, 8, 15, 6, 12].entries()) {
    const click = await s.page.evaluate(async distance => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      a.teleport(1, { x: 266, z: 15 }); await a.step(30);
      const q = g.view.project(266 - distance, 3.9, 15);
      return { x: (q[0] + 1) * innerWidth / 2, y: (1 - q[1]) * innerHeight / 2, tick: a.tick() };
    }, distance);
    await s.page.mouse.move(click.x, click.y);
    if (i === 4) await s.page.keyboard.down('KeyW');
    await s.page.keyboard.down('Shift'); await s.page.mouse.down();
    await s.page.evaluate(() => window.__SS__!.step(1));
    await s.page.mouse.up(); await s.page.keyboard.up('Shift');
    if (i === 4) await s.page.keyboard.up('KeyW');
    await s.page.evaluate(() => window.__SS__!.step(8));
    const flight = await s.page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      return { destination: g.world.combat!.projectiles.at(-1)?.destination, scheme: g.input.scheme };
    });
    await s.page.evaluate(async tick => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      for (let i = 0; i < 180; i++) {
        await a.step(1);
        if (g.world.events.events().some(e => e.type === 'combat.exploded' && e.tick >= tick)) { await a.step(2); return; }
      }
      throw new Error('rocket did not detonate');
    }, click.tick);
    await s.ready(); await s.page.screenshot({ path: `${out}/point-${distance}m.jpg`, type: 'jpeg', quality: 85 });
    const hit = await s.page.evaluate(tick => (window.__SCENE__ as unknown as { game: Game }).game.world.events.events().find(e => e.type === 'combat.exploded' && e.tick >= tick), click.tick);
    evidence.push({ distance, flight, hit });
    assert.ok(hit?.type === 'combat.exploded');
    if (hit?.type === 'combat.exploded') assert.ok(Math.hypot(hit.position.x - (266 - distance), hit.position.z - 15, hit.position.y - 3.9) < .3, `click ${distance}m`);
  }
  console.log('Five rockets: 25 ticks apart; five ground endpoints within 0.3m; five launch cues and impacts.');
} finally { writeFileSync(`${out}/evidence.json`, JSON.stringify({ evidence, errors: s.errors }, null, 2)); await s.close(); stopServer(); }
