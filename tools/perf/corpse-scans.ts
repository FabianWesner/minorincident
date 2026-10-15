/** Native Chrome/Metal, audit phone proxy; run under quiet-run after a production build. */
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer, origin } from '../scenelab/session';
const out = process.env.CORPSE_PERF_OUT ?? 'test-results/perf-corpse-scans';
mkdirSync(out, { recursive: true });
const failures: string[] = [];
const session = new SceneSession({ phone: true, tier: 'low', viewport: { width: 412, height: 839 }, seed: 2, nativeFrameTiming: true, query: { dpr: '1.5' } });
try {
  await session.open();
  const cdp = await session.page.context().newCDPSession(session.page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 839, deviceScaleFactor: 2.625, mobile: true });
  const sample = (seconds: number) => session.page.evaluate(async seconds => {
    const a = window.__SS__!, frames: number[] = [], updates: number[] = [], renders: number[] = [], sims: number[] = [];
    let previous = 0, draws = 0, triangles = 0; const start = performance.now(); a.resume();
    while (performance.now() - start < seconds * 1000 + 3000) {
      const now = await new Promise<number>(r => requestAnimationFrame(r)), p = a.perf();
      if (previous && now - start > 3000) { frames.push(now - previous); updates.push(p.updateCpuMs); renders.push(p.renderCpuMs); if (p.simTickMs) sims.push(p.simTickMs); draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles); }
      previous = now;
    }
    a.pause(); const p95 = (v: number[]) => v.sort((a,b) => a-b)[Math.ceil(v.length * .95)-1];
    return { frameP95: p95(frames), updateP95: p95(updates), renderP95: p95(renders), simP95: p95(sims), draws, triangles, frames: frames.length, corpses: a.query({}).filter(e => e.corpse).length, active: a.getState().ai!.count, backend: a.getState().render.backend, dpr: devicePixelRatio, canvas: { width: document.querySelector('canvas')!.width, height: document.querySelector('canvas')!.height } };
  }, seconds);
  if (process.argv.includes('--phone-levels')) {
    // Full game UI and default phone DPR, without the debug wireframe.
    await session.page.goto(`${origin}/?test=1&renderer=webgl&quality=low&audio=muted&dpr=1.5&seed=2&profile=1`);
    await session.page.waitForFunction(() => !!window.__SS__);
    await session.page.evaluate(async () => { await window.__SS__!.ready; });
    for (const level of ['L2', 'L4']) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const state = await session.page.evaluate(async level => {
        const a = window.__SS__!; await a.loadLevel(level, { seed: 2 }); a.pause(); a.missions.begin(); a.cheats.god(true); a.bot.start('complete');
        const target = level === 'L2' ? 5190 : 7020;
        while (a.tick() < target) await a.step(Math.min(120, target - a.tick()));
        a.bot.stop(); a.debug.figureJoints(false); await a.screenshotReady();
        return { tick: a.tick(), mission: a.missions.state(), player: a.getState().player!.transform, active: a.getState().ai!.count };
      }, level);
      if (level === 'L2' ? state.mission?.l2?.phase !== 'collapse' : state.mission?.l4?.phase !== 'war' || state.mission?.l4?.tankPhase !== 'hold' || state.mission?.l4?.heliPhase !== 'orbit') failures.push(`${level}: audit gameplay state not reached`);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const result = await sample(20);
      await session.screenshot(`${out}/${level}-phone.png`);
      writeFileSync(`${out}/${level}-phone.json`, JSON.stringify({ state, ...result, errors: session.errors }, null, 2));
      console.log(JSON.stringify({ level, ...result, errors: session.errors }));
      if (!Number.isFinite(result.frameP95) || !Number.isFinite(result.simP95) || result.frames < 1 || result.frameP95 > 33.33 || result.simP95 > 6 || result.draws > 300 || result.triangles > 500000 || session.errors.length) failures.push(`${level}: phone/E18 gate failed`);
    }
  } else {
    await session.load({ name: 'corpse-stress', seed: 2, ground: 'asphalt', size: 120, dof: false, time: 'L4', actors: [{ id: 'courier', kind: 'courier', at: [0, 0], god: true }], camera: { mode: 'game', target: [0, 0], zoom: 1 } });
    for (const count of [100, 500, 1000, 2000]) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await session.page.evaluate(async count => {
        const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        let n = a.query({}).filter(e => e.corpse).length;
        while (n < count) {
          const wave = Math.min(100, count - n);
          for (let i = 0; i < wave; i++) a.spawn('infected.runner', { x: -18 + (n + i) % 25 * 1.5, z: -18 + Math.floor((n + i) / 25) % 25 * 1.5 });
          a.cheats.killAll(); await a.step(150); n += wave;
        }
        a.debug.figureJoints(false); await a.screenshotReady();
        if ([...w.entities.iterate()].filter(e => e.corpse).length !== count) throw new Error('Missing permanent corpses');
      }, count);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const result = await sample(10);
      writeFileSync(`${out}/${count}.json`, JSON.stringify({ count, ...result, errors: session.errors }, null, 2));
      console.log(JSON.stringify({ count, ...result, errors: session.errors }));
      if (!Number.isFinite(result.frameP95) || !Number.isFinite(result.simP95) || result.frames < 1 || result.corpses !== count || result.active !== 0 || result.frameP95 > (count === 2000 ? 20 : 33.33) || result.simP95 > 6 || result.draws > 300 || result.triangles > 500000 || session.errors.length) failures.push(`${count}: corpse/E18 gate failed`);
    }
  }
  if (failures.length) throw new Error(failures.join('; '));
} finally { await session.close(); stopServer(); }
