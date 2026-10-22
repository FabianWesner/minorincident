/** Shared browser measurement for the L10 entry regression spec and CLI. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { Page } from '@playwright/test';
import type { Game } from '../../src/Game';
import type { InputFrame } from '../../src/input/InputFrame';

interface L10Frame {
  at: number; dt: number; tick: number; loading: boolean; cardVisible: boolean; scenario: string | null;
  x: number; z: number; sim: number; update: number; render: number; builds: number;
  heroLight?: string | null; sun?: boolean; spot?: boolean;
  warmup: number;
}

/** Device-input recording from the cold-graph reproduction, including both lamp boundaries. */
const replay = JSON.parse(gunzipSync(readFileSync(new URL('../../tests/fixtures/perf/l10-real-input.json.gz', import.meta.url))).toString()) as { seed: number; ticks: number; inputs: { tick: number; frame: InputFrame }[] };
const frames: InputFrame[] = []; let cursor = 0;
for (let tick = 0; tick < replay.ticks; tick++) {
  while (cursor + 1 < replay.inputs.length && replay.inputs[cursor + 1].tick <= tick) cursor++;
  frames.push(structuredClone(replay.inputs[cursor].frame));
}

export async function measureL10Entry(page: Page, origin: string, entry: 'debug' | 'continue', backend: 'webgl2' | 'webgpu', out: string) {
  mkdirSync(out, { recursive: true }); page.setDefaultTimeout(180_000);
  await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&debug=1&quality=low&seed=${process.env.L10_SEED ?? 1}&audio=muted&dpr=1&profile=1&loadProfile=1${backend === 'webgl2' ? '&renderer=webgl' : ''}`);
  await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
  await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.debug.figureJoints(true); localStorage.removeItem('minor-incident.campaign'); });
  await page.evaluate('globalThis.__name = fn => fn');
  await page.getByTestId('start-game').click(); await page.getByTestId('character-female').click();
  if (entry === 'continue') {
    await page.getByTestId('level-L9').click({ force: true });
    await page.waitForFunction(() => { const g = (window.__SCENE__ as unknown as { game: { world: Game['world']; loading: boolean } }).game; return g.world.scenario === 'L9' && !g.loading; });
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const performanceNavigationStartMs = metrics.find(m => m.name === 'NavigationStart')!.value * 1000;
  const performanceStartedAt = await page.evaluate(() => performance.now());
  await page.evaluate(frames => {
    const g = (window.__SCENE__ as unknown as { game: { world: Game['world']; input: Game['input']; view: Game['view']; loading: boolean } }).game;
    const trace = window as unknown as { l10Trace: L10Frame[]; l10TraceRunning: boolean; l10CardClosed?: number };
    trace.l10Trace = []; trace.l10TraceRunning = true;
    const card = document.querySelector<HTMLElement>('[data-testid=level-transition]');
    if (!card) throw Error('The production loading card is missing');
    const transition = (g as unknown as { transition: { finish(): void } }).transition, finish = transition.finish;
    transition.finish = function () {
      if (g.world.scenario === 'L10') {
        if (card.hidden) throw Error('The loading card closed before L10 was ready');
        if (g.world.tick !== 0) throw Error(`Replay must begin at tick zero, got ${g.world.tick}`);
        const a = window.__SS__!, rig = g.view.view;
        a.cheats.god(true); rig.zoom(Math.log(1.5 / rig.getState().targetZoom), true);
        // The menu clears Recorder playback after loadLevel resolves. Use the
        // production telemetry feed, which survives that UI input release.
        // Install before the card closes to keep transport/setup out of play.
        let cursor = 0;
        const feed: NonNullable<Game['input']['feed']> = { scheme: 'mouse-only', next: () => {
          const frame = frames[cursor++];
          feed.scheme = frame?.drive ? frame.aimSource === 'pointer' ? 'mouse-keyboard' : 'keyboard' : 'mouse-only';
          return frame ?? null;
        } };
        g.input.feed = feed;
      }
      finish.call(this); if (g.world.scenario === 'L10') trace.l10CardClosed = performance.now();
    };
    let last = performance.now();
    const sample = (now: number) => {
      const p = g.world.entities.get(1)?.transform, perf = window.__SS__!.perf();
      const light = (g.view as unknown as { lighting: { heroLight: string | null; sun: { visible: boolean }; spot: { visible: boolean } } | null }).lighting;
      trace.l10Trace.push({ at: now, dt: now - last, tick: g.world.tick, loading: g.loading, cardVisible: !card.hidden, scenario: g.world.scenario, x: p?.x ?? 0, z: p?.z ?? 0, sim: perf.simMs, update: perf.updateCpuMs, render: perf.renderCpuMs, builds: perf.nodeBuilds,
        heroLight: light?.heroLight, sun: light?.sun.visible, spot: light?.spot.visible,
        warmup: (g.view as unknown as { shadowWarmup?: { remaining: number } }).shadowWarmup?.remaining ?? 0 }); last = now;
      if (trace.l10TraceRunning) requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  }, frames);
  if (entry === 'debug') await page.getByTestId('level-L10').click({ force: true });
  else {
    await page.evaluate(async () => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, m = g.world.missions!; a.pause();
      const at = m.def.anchors['crawl-end']; g.world.vehicles!.destroyScripted(m.l9!.state.carId, { ...at, y: .72, yaw: 0 });
      m.l9!.state.phase = 'done'; m.l9!.state.finished = true; g.world.storyLock = null;
      a.cheats.completeObjective('approach'); a.cheats.completeObjective('reach-outskirts'); await a.step(1); a.resume();
    });
  }
  await page.waitForFunction(() => { const g = (window.__SCENE__ as unknown as { game: { world: Game['world']; loading: boolean } }).game; return g.world.scenario === 'L10' && !g.loading; });
  console.log(`${entry}: L10 loaded`);
  await page.evaluate(() => window.__SS__!.resume());
  await page.waitForFunction(ticks => window.__SS__!.tick() >= ticks, replay.ticks, { timeout: 120_000 });
  const result = await page.evaluate(() => {
    const trace = window as unknown as { l10Trace: L10Frame[]; l10TraceRunning: boolean; l10CardClosed?: number }; trace.l10TraceRunning = false;
    window.__SS__!.pause(); window.__SS__!.input.clear();
    (window.__SCENE__ as unknown as { game: Game }).game.input.feed = null;
    const frames = trace.l10Trace, playable = frames.filter(f => f.scenario === 'L10' && f.at >= trace.l10CardClosed!).map(f => ({ ...f, dt: Math.min(f.dt, f.at - trace.l10CardClosed!) }));
    const ordered = playable.map(f => f.dt).sort((a, b) => a - b);
    return { frames, cardClosed: trace.l10CardClosed, playableFrames: playable.length, max: Math.max(...ordered), p95: ordered[Math.ceil(ordered.length * .95) - 1], hitches: playable.filter(f => f.dt > 200), backend: window.__SS__!.perf().backend, state: window.__SS__!.getEntity(1), load: window.__SS__!.perf().loadTiming };
  });
  const { profile } = await cdp.send('Profiler.stop'); await cdp.detach();
  writeFileSync(`${out}/${entry}-${backend}.cpuprofile`, JSON.stringify({ ...profile, performanceNavigationStartMs, performanceStartedAt }));
  writeFileSync(`${out}/${entry}-${backend}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ entry, backend: result.backend, frames: result.playableFrames, max: result.max, p95: result.p95, hitches: result.hitches }));
  return result;
}
