import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import type { Game } from '../../src/Game';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { menuStart, menuUrl } from './ui-helpers';

/**
 * Telemetry replay determinism: play a scripted REAL-input L1 run (keyboard, mouse clicks, wheel zoom, a viewport resize)
 * with the input-log recorder on (`?telemetry=record`), then load the level fresh and feed the recorded log back.
 * The player must walk the same path (+-5 cm) and hit the same deaths, objectives and final state.
 * Browser runs only through tools/e2e-lock.sh.
 */
const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as { anchors: Record<string, { position: number[] }> };
const at = (name: string) => ({ x: layout.anchors[name].position[0], z: layout.anchors[name].position[2] });
const recordUrl = `${menuUrl}&telemetry=record`;
const replayUrl = '/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1';
test.use({ headless: true });

/** Reload the page fresh, feed the recorded log back and compare with what the recording side saw. */
async function replayAndCompare(page: Page, live: NonNullable<Awaited<ReturnType<typeof liveOf>>>, recorded: { chunks: string[]; samples: number }, viewport = { width: 1600, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto(replayUrl);
  await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  const info = await page.evaluate(chunks => window.__SS__!.replay.start(chunks), recorded.chunks);
  expect(info.samples).toBe(recorded.samples);
  for (let at = 0; at < info.samples; at += 1200) await page.evaluate(until => window.__SS__!.replay.advance(until, 8), Math.min(info.samples, at + 1200));
  const replayed = await page.evaluate(() => window.__SS__!.replay.summary());
  expect(replayed.ticks).toBe(live.tick);
  expect(replayed.path.length).toBe(live.path.length);
  let worst = 0, firstOff = -1;
  for (let i = 0; i < live.path.length; i += 2) { const d = Math.hypot(replayed.path[i] - live.path[i], replayed.path[i + 1] - live.path[i + 1]); if (d > worst) worst = d; if (d > 0.05 && firstOff < 0) firstOff = i / 2 + 1; }
  console.log(`telemetry-replay ticks=${live.tick} samples=${info.samples} commands=${info.commands} deaths=${live.deaths.length} objectives=${live.objectives.length} worstPathDelta=${worst.toExponential(2)} firstOffTick=${firstOff}`);
  expect(worst, `path diverges from tick ${firstOff}`).toBeLessThan(0.05);
  expect(replayed.deaths.map(d => d.tick)).toEqual(live.deaths.map(d => d.tick));
  expect(replayed.objectives.map(o => [o.id, o.completedTick])).toEqual(live.objectives.map(o => [o.id, o.completedTick]));
  expect(replayed.completed).toEqual(live.completed);
  if (replayed.stateHash !== live.stateHash) {
    const mine = await page.evaluate(() => window.__SS__!.replay.diagnose());
    console.log('replay parts', JSON.stringify(mine.parts));
    console.log('replay entities', JSON.stringify(mine.entities));
  }
  expect(replayed.stateHash).toBe(live.stateHash);
  return { info, replayed };
}
const liveOf = (page: Page) => page.evaluate(() => window.__SS__!.replay.live());

test.describe('telemetry replay determinism', () => {
  test('T-TELEMETRY-1 a recorded real-input L1 run replays to the same path, deaths and objective ticks', async ({ page }) => {
    test.setTimeout(420_000); page.setDefaultTimeout(90_000);
    await menuStart(page, recordUrl);
    await page.evaluate(() => window.__SS__!.pause());
    await page.waitForFunction(() => window.__SS__!.replay.ready());
    const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
    const player = () => page.evaluate(() => window.__SS__!.getState().player!.transform);
    /** Click a ground point at most 7 m away in the direction of the target, with the real game camera. */
    const hop = async (target: { x: number; z: number }, stop = 1.3) => {
      for (let i = 0; i < 40; i++) {
        const p = await player(), dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
        if (d <= stop) return;
        const k = Math.min(1, 7 / d), point = await page.evaluate(q => window.__SS__!.input.project(q, 'player'), { x: p.x + dx * k, z: p.z + dz * k });
        const view = page.viewportSize()!;
        if (point.x > 20 && point.x < view.width - 20 && point.y > 20 && point.y < view.height - 20) await page.mouse.click(point.x, point.y);
        await step(40);
      }
    };
    await page.mouse.move(800, 450); await step(20);
    await page.mouse.wheel(0, 240); await step(30); // zoom out: a recorded camera input
    await hop(at('parcel-counter'));
    await page.keyboard.down('e'); await step(3); await page.keyboard.up('e'); await step(30);
    await page.mouse.wheel(0, -120); await step(20);
    await hop(at('lab-door'));
    // Keyboard phase: WASD with the cursor moving, attack key held in bursts, then a smaller window mid-run.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.down(i % 2 ? 'd' : 'w'); await page.mouse.move(700 + i * 30, 400 + i * 20); await page.keyboard.down('j'); await step(25); await page.keyboard.up('j'); await step(35); await page.keyboard.up(i % 2 ? 'd' : 'w');
      if (i === 2) { await page.setViewportSize({ width: 1400, height: 800 }); await step(10); }
    }
    await page.setViewportSize({ width: 1600, height: 900 }); await step(10);
    await hop(at('garage-door'));
    await step(300);

    const world = await page.evaluate(() => { const a = window.__SS__!; return { phase: a.missions.state()!.phase, infected: a.query({ kind: 'infected' }).filter(e => e.health.current > 0).length, kills: a.missions.state()!.stats.kills }; });
    console.log('world at end of recording', JSON.stringify(world));
    const live = (await liveOf(page))!;
    const recorded = (await page.evaluate(() => window.__SS__!.replay.recorded()))!;
    expect(live.ticks, 'the scripted run must cover real play').toBeGreaterThan(1500); expect(recorded.chunks.length).toBeGreaterThan(0);
    const { info } = await replayAndCompare(page, live, recorded);
    expect(info.commands).toBeGreaterThan(3); // begin, zooms, resizes
  });

  for (const profile of ['complete', 'newbie'] as const) test(`T-TELEMETRY-2 a recorded L1 bot run (${profile}: outbreak, fights, deaths, result) replays to the same state`, async ({ page }) => {
    test.setTimeout(600_000); page.setDefaultTimeout(120_000);
    await page.goto(`/?test=1&telemetry=record&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1`);
    await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async () => { const a = window.__SS__!; await a.ready; a.pause(); await a.loadLevel('L1', { seed: 1 }); a.pause(); });
    await page.waitForFunction(() => window.__SS__!.replay.ready());
    await page.evaluate(async profile => { const a = window.__SS__!; a.pause(); a.missions.begin(); a.bot.start(profile); await a.step(60); }, profile);
    let ticks = 0, phase = 'playing', infected = 0;
    while (phase === 'playing' && ticks < 40_000) {
      const r = await page.evaluate(async () => { const a = window.__SS__!; await a.step(600); const q = a.query({ kind: 'infected' }).filter(e => e.health.current > 0).length; return { phase: a.missions.state()!.phase, infected: q }; });
      phase = r.phase; infected = Math.max(infected, r.infected); ticks += 600;
    }
    const live = (await liveOf(page))!;
    console.log(`bot ${profile}: phase=${phase} ticks=${live.tick} maxInfected=${infected} deaths=${live.deaths.length} objectives=${JSON.stringify(live.objectives.map(o => o.id))}`);
    const recorded = (await page.evaluate(() => window.__SS__!.replay.recorded()))!;
    expect(live.tick).toBeGreaterThan(3000); expect(infected, 'the run must include infected').toBeGreaterThan(0);
    // Keep a bundle of the first bot run for tools/replay (npm run replay -- test-results/telemetry/bot-complete.bundle.json).
    if (profile === 'complete') { mkdirSync('test-results/telemetry', { recursive: true }); writeFileSync('test-results/telemetry/bot-complete.bundle.json', JSON.stringify({ version: 1, id: '00000000-0000-4000-8000-000000000001', base: 'local', chunks: recorded.chunks.map(c => gzipSync(Buffer.from(c, 'base64')).toString('base64')) })); }
    await replayAndCompare(page, live, recorded);
  });

  test('T-TELEMETRY-3 a run played in REAL TIME by the render loop (variable frame pacing, 6x clock) replays to the same state', async ({ page }) => {
    test.setTimeout(420_000); page.setDefaultTimeout(120_000);
    await page.goto(`/?test=1&telemetry=record&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1`);
    await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async () => { const a = window.__SS__!; await a.ready; a.pause(); await a.loadLevel('L1', { seed: 2 }); a.pause(); });
    await page.waitForFunction(() => window.__SS__!.replay.ready());
    await page.evaluate(() => { const a = window.__SS__!; a.missions.begin(); a.bot.start('newbie'); a.setTimeScale(6); a.resume(); });
    // The ticker advances the sim; no step() calls. Stop at the result screen or after 150 s of wall time.
    await page.waitForFunction(() => window.__SS__!.missions.state()!.phase !== 'playing', undefined, { timeout: 150_000 }).catch(() => undefined);
    await page.evaluate(() => window.__SS__!.pause());
    const live = (await liveOf(page))!;
    console.log(`real-time: ticks=${live.tick} deaths=${live.deaths.length} objectives=${JSON.stringify(live.objectives.map(o => o.id))}`);
    const recorded = (await page.evaluate(() => window.__SS__!.replay.recorded()))!;
    expect(live.tick).toBeGreaterThan(3000);
    await replayAndCompare(page, live, recorded);
  });
});


test('T-TELEMETRY-4 a retained level zoom is recorded and restored independently of the current camera', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?test=1&scenelab=1&telemetry=record&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1');
  await page.waitForFunction(() => Boolean(window.__SS__));
  const recorded = await page.evaluate(async () => {
    const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    await a.ready; a.pause(); game.view.view.zoom(Math.log(1.5), true);
    await a.loadLevel('L1', { seed: 1 }); a.pause(); a.missions.begin();
    await a.step(90);
    return a.replay.recorded()!;
  });
  expect(recorded.samples).toBeGreaterThan(0);
  const zooms = await page.evaluate(async chunks => {
    const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    game.view.view.zoom(Math.log(.5 / game.view.view.getState().targetZoom), true);
    const before = game.view.view.getState().targetZoom;
    await a.replay.start(chunks);
    return { before, after: game.view.view.getState().targetZoom };
  }, recorded.chunks);
  expect(zooms).toEqual({ before: .5, after: 1.5 });
});
