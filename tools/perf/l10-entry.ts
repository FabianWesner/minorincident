/** Run with quiet-run. Measures production debug selection and L9 automatic continue. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, origin, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.L10_OUT ?? 'test-results/fixes-13h-l10/entry';
mkdirSync(out, { recursive: true });
const backend = process.env.L10_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const session = new SceneSession({ backend, tier: 'low', nativeFrameTiming: true });
try {
  await session.open();
  const page = session.page; page.setDefaultTimeout(180_000);
  for (const entry of (process.env.L10_ENTRIES ?? 'debug,continue').split(',')) {
    await page.goto(`${origin}/?testApi=1&scenelab=1&debug=1&quality=low&seed=32&audio=muted&dpr=1&profile=1&loadProfile=1${backend === 'webgl2' ? '&renderer=webgl' : ''}`);
    await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
    await page.evaluate(async () => { await window.__SS__!.ready; localStorage.removeItem('minor-incident.campaign'); });
    await page.evaluate('globalThis.__name = fn => fn');
    await page.getByTestId('start-game').click(); await page.getByTestId('character-female').click();
    if (entry === 'continue') {
      await page.getByTestId('level-L9').click({ force: true });
      await page.waitForFunction(() => { const g = (window.__SCENE__ as unknown as { game: Game & { loading: boolean } }).game; return g.world.scenario === 'L9' && !g.loading; });
    }
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
    await page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game & { loading: boolean } }).game;
      const trace = window as unknown as { l10Trace: { at: number; dt: number; tick: number; loading: boolean; scenario: string | null; x: number; z: number; sim: number; update: number; render: number; builds: number }[]; l10TraceRunning: boolean };
      trace.l10Trace = []; trace.l10TraceRunning = true;
      let last = performance.now();
      const sample = (now: number) => {
        const p = g.world.entities.get(1)?.transform, perf = window.__SS__!.perf();
        trace.l10Trace.push({ at: now, dt: now - last, tick: g.world.tick, loading: g.loading, scenario: g.world.scenario, x: p?.x ?? 0, z: p?.z ?? 0, sim: perf.simMs, update: perf.updateCpuMs, render: perf.renderCpuMs, builds: perf.nodeBuilds }); last = now;
        if (trace.l10TraceRunning) requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
    if (entry === 'debug') await page.getByTestId('level-L10').click({ force: true });
    else {
      await page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, m = g.world.missions!; a.pause();
        const at = m.def.anchors['crawl-end']; g.world.vehicles!.destroyScripted(m.l9!.state.carId, { ...at, y: .72, yaw: 0 });
        m.l9!.state.phase = 'done'; m.l9!.state.finished = true; g.world.storyLock = null;
        a.cheats.completeObjective('approach'); a.cheats.completeObjective('reach-outskirts'); await a.step(1); a.resume();
      });
    }
    await page.waitForFunction(() => { const g = (window.__SCENE__ as unknown as { game: Game & { loading: boolean } }).game; return g.world.scenario === 'L10' && !g.loading; });
    console.log(`${entry}: L10 loaded`);
    await page.evaluate(() => { window.__SS__!.cheats.god(true); window.__SS__!.input.set({ moveTarget: { x: 755, z: 13.6 }, navigation: true, pointerGround: true }); window.__SS__!.resume(); });
    await page.waitForTimeout(Number(process.env.L10_SECONDS ?? 65) * 1000);
    const result = await page.evaluate(() => {
      const trace = window as unknown as { l10Trace: { at: number; dt: number; tick: number; loading: boolean; scenario: string | null }[]; l10TraceRunning: boolean }; trace.l10TraceRunning = false;
      window.__SS__!.pause(); window.__SS__!.input.clear();
      const frames = trace.l10Trace, playable = frames.filter((f, i) => f.scenario === 'L10' && !f.loading && i > 0 && !frames[i - 1].loading && frames[i - 1].scenario === 'L10');
      const ordered = playable.map(f => f.dt).sort((a, b) => a - b);
      return { frames, playableFrames: playable.length, max: Math.max(...ordered), p95: ordered[Math.ceil(ordered.length * .95) - 1], hitches: playable.filter(f => f.dt > 200), backend: window.__SS__!.perf().backend, state: window.__SS__!.getEntity(1), load: window.__SS__!.perf().loadTiming };
    });
    const { profile } = await cdp.send('Profiler.stop'); await cdp.detach();
    writeFileSync(`${out}/${entry}-${backend}.cpuprofile`, JSON.stringify(profile));
    writeFileSync(`${out}/${entry}-${backend}.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ entry, backend: result.backend, frames: result.playableFrames, max: result.max, p95: result.p95, hitches: result.hitches }));
    assert.ok(result.playableFrames > 100);
    if (process.env.L10_ASSERT === '1') assert.ok(result.max <= 200, `${entry}: ${result.max} ms after loading`);
  }
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }
