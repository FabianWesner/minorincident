/** Paired native combat windows, run unchanged against SCENE_DIST before/after builds.
 * These fixtures are performance diagnostics, separate from mortal input runs. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Game } from '../../src/Game';
import { quietConditions } from '../browser-pool/host';
import { poolUrl } from '../browser-pool/client';
import { SceneSession, origin, stopServer } from '../scenelab/session';

assert.equal(process.env.MI_PERF_LOCK_HELD, '1', 'Run with tools/perf/quiet-run.sh');
const output = process.argv[2];
assert.ok(output, 'Provide the receipt path');
mkdirSync(dirname(output), { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'low', nativeFrameTiming: true, query: { crowdProbe: 'drawn', profile: '0' } });
const owned = new Set([process.pid]);
const conditions: Awaited<ReturnType<typeof quietConditions>>[] = [], windows: unknown[] = [];
let sampler: ReturnType<typeof setInterval> | undefined;
try {
  await session.open();
  assert.equal(await (await fetch(origin)).text(), readFileSync(resolve(process.env.SCENE_DIST ?? 'dist', 'index.html'), 'utf8'), 'Timing server must serve the requested build');
  if (process.env.MI_BROWSER_POOL === '1') {
    const status = await (await fetch(`${poolUrl()}/status`)).json() as { browsers: { pid: number }[] };
    for (const browser of status.browsers) owned.add(browser.pid);
  }
  // A fresh native browser can raise the load average even inside an exclusive
  // slot. Keep its clock paused until that startup work has cooled, using the
  // same quiet limit as admission rather than measuring through the spike.
  const coolDeadline = Date.now() + 120_000;
  let initial = await quietConditions(owned);
  while (!initial.quiet && Date.now() < coolDeadline) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    initial = await quietConditions(owned);
  }
  conditions.push(initial);
  assert.equal(initial.quiet, true, JSON.stringify(initial));
  sampler = setInterval(() => { void quietConditions(owned).then(c => conditions.push(c)); }, 1000);
  await session.page.evaluate('window.__name = f => f');
  await session.page.evaluate(() => window.__SS__!.debug.figureJoints(false));
  for (const [level, checkpoint] of [['L5', 'survivor-1'], ['L7', null], ['L8', null], ['L9', null], ['L10', 'cure-disperse-ready']] as const) {
    await session.page.evaluate(async ({ level, checkpoint }) => {
      const a = window.__SS__!;
      a.pause(); a.settings.set({ quality: 'low' });
      await a.loadLevel(level, checkpoint ? { seed: 1, checkpoint } : { seed: 1 });
      a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5);
      if (level === 'L7') {
        a.bot.start('complete');
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        let reached = false;
        for (let seconds = 0; seconds < 120; seconds++) {
          await a.step(60);
          const w = g.world, p = w.entities.get(1)!.transform;
          reached = w.infected!.active.some(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 15);
          if (reached) break;
        }
        a.bot.stop(); if (!reached) throw new Error('L7 combat was not reached');
      }
      if (level === 'L8') { a.bot.start('complete'); await a.step(3599); a.bot.stop(); await a.step(1); }
      if (level === 'L9') { a.bot.start('complete'); await a.step(45 * 60); }
      if (level === 'L10') {
        // The performance checkpoint advances objectives without traversing
        // the city. Place this explicit fixture beside its authored console;
        // activating the assault below still uses the normal E interaction.
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        const console = g.world.missions!.def.anchors['cure-console'];
        a.teleport('player', { x: console.x - 1.5, z: console.z });
      }
    }, { level, checkpoint });
    if (level === 'L10') { await session.page.evaluate(() => window.__SS__!.resume()); await session.page.keyboard.down('KeyE'); await session.page.waitForTimeout(1000); await session.page.keyboard.up('KeyE'); }
    const result = await session.page.evaluate(async level => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      a.resume();
      // Settle the native phase/animation before the fixed twenty-second fight window.
      for (let i = 0; i < 120; i++) await new Promise(requestAnimationFrame);
      const frames: number[] = [], populations: number[] = [], nodeBuilds = a.perf().nodeBuilds;
      let previous = 0; const started = performance.now(), tick = g.world.tick;
      while (performance.now() - started < 20_000) {
        const now = await new Promise<number>(requestAnimationFrame);
        if (previous) frames.push(now - previous); previous = now;
        if (frames.length % 60 === 0) populations.push(g.world.infected!.director.count);
        if (g.world.scenario !== level) throw new Error(`Window left ${level}`);
      }
      a.pause();
      return { level, tick, endTick: g.world.tick, chargeActive: !!g.world.missions?.state.states['charge-active'],
        frames, populations, quality: a.perf().quality, nodeBuildsAtStart: nodeBuilds, nodeBuildsAtEnd: a.perf().nodeBuilds, detailedProbeFigures: a.crowdFigures().filter(f => f.joints || f.soles || f.feet.length).length, max: Math.max(...frames), backend: a.perf().backend };
    }, level);
    assert.equal(result.quality.tier, 'low', 'Keep the same rendered quality in both builds');
    assert.equal(result.detailedProbeFigures, 0, 'Native timing must not collect skeleton diagnostics');
    if (level === 'L10') assert.equal(result.chargeActive, true, 'Measure the activated native assault');
    windows.push(result); console.log(`${level}: max=${result.max.toFixed(2)} ms`);
    writeFileSync(output, JSON.stringify({ at: new Date().toISOString(), complete: false, dist: process.env.SCENE_DIST ?? 'dist', conditions, windows }));
  }
  clearInterval(sampler); sampler = undefined;
  conditions.push(await quietConditions(owned));
  assert.deepEqual(conditions.flatMap(c => c.busy), [], 'Foreign build/test/browser overlapped');
  writeFileSync(output, JSON.stringify({ at: new Date().toISOString(), complete: true, dist: process.env.SCENE_DIST ?? 'dist', conditions, windows }));
  assert.deepEqual(session.errors, []);
} finally { if (sampler) clearInterval(sampler); await session.close(); stopServer(); }
