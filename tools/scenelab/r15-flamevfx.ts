/** One pooled native browser, matched original/current firing captures and sustained-fire timing. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, origin, port, stopServer } from './session';
import { quietConditions } from '../browser-pool/host';
import { poolUrl } from '../browser-pool/client';

assert(process.env.MI_BROWSER_POOL_EXCLUSIVE, 'Run through tools/perf/quiet-run.sh');
const out = 'test-results/r15-flamevfx', report = 'docs/reports/r15-flamevfx';
const paths = ['src/render/GameView.ts', 'src/render/vfx/Vfx.ts', 'src/render/vfx/Blasts.ts', 'src/sim/combat/Combat.ts', 'src/sim/interact/Hazards.ts'];
const revision = execFileSync('git', ['rev-parse', process.env.R15_BASELINE_REVISION ?? 'eb835fc1'], { encoding: 'utf8' }).trim();
const original = new Map(paths.map(path => [resolve(path), execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8' })]));
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const sources = paths.map(path => ({ path, before: sha(original.get(resolve(path))!), after: sha(readFileSync(path, 'utf8')) }));
const base = JSON.parse(readFileSync('docs/reports/r15-flamer/scene.json', 'utf8')) as SceneSpec;
base.name = 'r15-flamevfx'; base.weather = 'clear'; base.frames = 140;
base.actors!.find(actor => actor.id === 'target')!.at = [5.2, 0];
const session = new SceneSession({ viewport: { width: 1280, height: 720 }, backend: 'webgl2', tier: 'high', nativeFrameTiming: true });
const baselinePort = port + 1;
const beforeServer = await createServer({ configFile: resolve('vite.config.ts'), cacheDir: '/private/tmp/r15-flamevfx-vite-before',
  plugins: [{ name: 'r15-original-sources', enforce: 'pre', load(id) { return original.get(id.split('?')[0]); } }],
  server: { host: '127.0.0.1', port: baselinePort, strictPort: true } });
const captures: unknown[] = [], timings: unknown[] = [], temporal: unknown[] = [], conditions: unknown[] = [];
mkdirSync(out, { recursive: true }); mkdirSync(report, { recursive: true });
const save = () => writeFileSync(`${report}/evidence.json`, JSON.stringify({ revision, sources, browser: 'one pooled headless native Metal WebGL2 context, uncapped Chrome', method: 'Original Git source overrides on a private Vite server versus current source, identical seeded Scene Lab, actual attack inputs. Native timing: 180 warm frames, 600 measured rAF intervals and at least 5 seconds per quality/side; infinite fuel only for timing.', captures, timings, temporal, conditions, consoleErrors: session.errors }, null, 2) + '\n');
try {
  await beforeServer.listen(); await session.open();
  const status = await (await fetch(`${poolUrl()}/status`)).json() as { browsers: { pid: number }[] };
  const owned = new Set([process.pid, ...status.browsers.map(b => b.pid)]);
  for (const side of ['before', 'after']) for (const tier of ['high', 'low'] as const) {
    session.options.tier = tier;
    const url = side === 'before' ? `http://127.0.0.1:${baselinePort}` : origin;
    await session.page.goto(`${url}/?test=1&scenelab=1&renderer=webgl&profile=1&dpr=1&quality=${tier}&audio=muted&seed=1`);
    await session.page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__, null, { timeout: 120_000 });
    await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    for (const zoom of [1, 1.5]) {
      const spec = structuredClone(base); spec.camera = { mode: 'game', target: 'courier', zoom };
      await session.load(spec); await session.step(45);
      const file = `${out}/${tier}-z${zoom}-${side}.png`; await session.screenshot(file);
      const result = await session.page.evaluate(() => {
        const api = window.__SS__!, state = api.getState();
        return { camera: state.render.camera, quality: state.render.quality, attacks: api.events(0).filter(e => e.type === 'combat.attack' && e.actionId === 'weapon.flamethrower').length, vfx: state.render.vfx, perf: api.perf() };
      });
      assert.equal(result.quality, tier); assert(result.attacks > 0);
      captures.push({ side, tier, zoom, frame: 45, file, ...result }); save();
      if (side === 'after' && zoom === 1) {
        for (const frame of [46, 50, 55, 60, 65, 70, 75, 80]) {
          await session.step(frame - (frame === 46 ? 45 : frame === 50 ? 46 : frame - 5));
          const state = await session.page.evaluate(() => ({ tick: window.__SS__!.tick(), vfx: window.__SS__!.getState().render.vfx }));
          temporal.push({ tier, frame, ...state });
        }
        await session.screenshot(`${out}/${tier}-sustained.png`);
        await session.step(40); await session.screenshot(`${out}/${tier}-released.png`);
        temporal.push({ tier, frame: 120, released: true, vfx: await session.page.evaluate(() => window.__SS__!.getState().render.vfx) });
      }
    }
    // A fresh identical scene for a sustained production-input native cadence sample.
    const spec = structuredClone(base); spec.camera = { mode: 'game', target: 'courier', zoom: 1 };
    await session.load(spec); await session.step(45); await session.ready();
    const condition = await quietConditions(owned); conditions.push({ side, tier, phase: 'start', ...condition });
    assert.deepEqual(condition.busy, [], 'Foreign work overlapped native timing');
    const timing = await session.page.evaluate(async () => {
      const api = window.__SS__!, gl = document.querySelector('canvas')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
      api.cheats.infiniteCharges(true); api.cheats.god(true);
      api.input.set({ move: { x: 0, z: 0 }, aim: { x: 1, z: 0 }, aimSource: 'keyboard', left: { down: false, held: true, up: false } });
      api.resume();
      for (let i = 0; i < 180; i++) await new Promise(requestAnimationFrame);
      const frames: number[] = [], begin = performance.now(), startTick = api.tick(), attacksAtStart = api.events(0).filter(e => e.type === 'combat.attack').length;
      let previous = await new Promise<number>(requestAnimationFrame);
      while (frames.length < 600 || performance.now() - begin < 5000) { const now = await new Promise<number>(requestAnimationFrame); frames.push(now - previous); previous = now; }
      api.pause(); api.input.clear();
      const sorted = [...frames].sort((a, b) => a - b), perf = api.perf();
      return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null, durationMs: performance.now() - begin, samples: frames.length, frames,
        p50: sorted[Math.ceil(sorted.length * .5) - 1], p95: sorted[Math.ceil(sorted.length * .95) - 1], ticks: api.tick() - startTick,
        discharges: api.events(0).filter(e => e.type === 'combat.attack').length - attacksAtStart, perf, vfx: api.getState().render.vfx };
    });
    assert(timing.discharges > 5, 'Native sample must contain sustained fire');
    timings.push({ side, tier, ...timing });
    conditions.push({ side, tier, phase: 'end', ...await quietConditions(owned) }); save();
    console.log(JSON.stringify({ side, tier, p50: timing.p50, p95: timing.p95, discharges: timing.discharges }));
  }
  assert.deepEqual(session.errors, []); save();
} finally { await session.close(); stopServer(); await beforeServer.close(); }
