/** Headless moving-bullet review: real L4 rifle bursts and courier MG, both backends/tiers and all player zooms.
 * SCENE_PORT=3497 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/tracers.ts
 * TRACER_CASE can restrict cases, e.g. webgl2-high-z0.5-courier. Captures and probes are in test-results/tracers. */
import assert from 'node:assert/strict';
import { SceneSession, readSpec, stopServer, writeJson, encodeWebm } from './session';
import { canvasFrame, canvasFrameChecks } from '../../tests/e2e/canvas-frame';

const filter = process.env.TRACER_CASE ? new RegExp(process.env.TRACER_CASE) : null;
const results = [];
try {
  for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 } });
    try {
      const cases = [0.5, 1, 1.5].flatMap(zoom => ['squad', 'courier'].map(scene => ({ zoom, scene, name: `${backend}-${tier}-z${zoom}-${scene}` }))).filter(c => !filter || filter.test(c.name));
      if (!cases.length) continue;
      await session.open();
      for (const { zoom, scene, name } of cases) {
        const spec = readSpec(`docs/scenes/tracers/${scene}.json`), out = `test-results/tracers/${name}`;
        spec.camera = { mode: 'game', target: scene === 'courier' ? 'courier' : [0, 0], zoom };
        await session.load(spec);
        const cells = [], video = [], probes = [];
        let firstShot = -1;
        for (let frame = 1; frame <= 90; frame++) {
          await session.step(1);
          // Inspect the existing GPU slot attributes, without adding a production debug API.
          const probe = await session.page.evaluate(() => {
            const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
            const fx = game.view.vfx!, g = fx.particles.mesh.geometry;
            const o = g.getAttribute('fxOrigin'), m = g.getAttribute('fxMotion'), s = g.getAttribute('fxStyle');
            const tracers = [];
            for (let i = 0; i < s.count; i++) {
              const age = fx.time - o.getW(i), life = m.getW(i);
              if (s.getY(i) !== 11 || life <= 0 || age >= life) continue;
              const origin = [o.getX(i), o.getY(i), o.getZ(i)];
              const velocity = [m.getX(i), m.getY(i), m.getZ(i)], speed = Math.hypot(...velocity);
              const flightAge = Math.max(0, age - 1 / 120);
              const head = origin.map((v, j) => v + velocity[j] * flightAge);
              const projectedGround = window.__SS__!.input.project({ x: head[0], z: head[2] });
              tracers.push({ slot: i, born: o.getW(i), age, flightAge, life, origin, velocity, head, projectedGround, length: Math.min(s.getX(i), flightAge * speed), width: s.getW(i), range: s.getZ(i) });
            }
            const actions = game.view as unknown as { actions: { projectiles: { visible: boolean }[] } };
            return { frame: window.__SCENE__!.frame, time: fx.time, shots: fx.shots.map(shot => ({ ...shot })), tracers, particles: fx.particles.count,
              projectileBalls: actions.actions.projectiles.filter(p => p.visible).length, perf: window.__SS__!.perf() };
          });
          probes.push(probe);
          if (firstShot < 0 && probe.shots.length) firstShot = frame;
          if (firstShot >= 0 && frame < firstShot + 12) {
            await session.screenshot(`${out}/f${frame}.png`);
            const jpeg = await session.snapshot(); cells.push({ frame, jpeg }); video.push(jpeg);
          }
          for (const t of probe.tracers) {
            assert.ok(t.length <= 1.001 && t.width < .07);
            assert.ok(Math.abs(Math.hypot(...t.velocity) - 320) < .01);
            assert.ok(t.flightAge * 320 <= t.range + .001);
          }
          assert.ok(probe.particles <= (tier === 'high' ? 2048 : 512));
          if (scene === 'courier') assert.equal(probe.projectileBalls, 0);
        }
        const metrics = await session.metrics(), visible = probes.flatMap(p => p.tracers.filter(t => t.flightAge > .001));
        assert.ok(firstShot >= 0 && visible.length > 0, `${name}: no flying streak captured`);
        let movingPairs = 0;
        for (let i = 1; i < probes.length; i++) for (const head of probes[i].tracers) {
          const previous = probes[i - 1].tracers.find(t => t.slot === head.slot && t.born === head.born);
          if (!previous || previous.flightAge <= 0) continue;
          const travelled = Math.hypot(...head.head.map((v, j) => v - previous.head[j]));
          assert.ok(Math.abs(travelled - 320 / 60) < .002); movingPairs++;
        }
        assert.ok(movingPairs > 0, `${name}: no moving frame pair`);
        assert.equal(metrics.backend, backend === 'webgl2' ? 'webgl' : backend);
        if (backend === 'webgl2') assert.ok(await session.page.evaluate(() => {
          const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
          return (game.view.renderer.backend as unknown as { gl: unknown }).gl instanceof WebGL2RenderingContext;
        }));
        assert.ok((metrics.perf.drawCalls.max ?? 0) <= (tier === 'high' ? 600 : 300));
        assert.ok((metrics.perf.triangles.max ?? 0) <= (tier === 'high' ? 1_500_000 : 500_000));
        assert.equal(session.errors.length, 0);
        assert.ok(canvasFrameChecks(await canvasFrame(session.page)).every(c => c.pass));
        await session.makeSheet(cells, `${out}/sequence.jpg`, 640, 1600);
        encodeWebm(video, `${out}/sequence.webm`, 60);
        // At closest zoom a 320 m/s head can cross the whole viewport in one 60 Hz
        // interval. Sample the first real shot at 240 Hz as well, with sim frozen.
        await session.load(spec); await session.step(firstShot);
        const subframes = [], subvideo = [], subtimes: { tick: number; time: number }[] = [];
        for (let sample = 0; sample < 12; sample++) {
          if (sample) await session.page.evaluate(() => window.__SS__!.vfx.stepRender(1 / 240));
          await session.screenshot(`${out}/sub-${sample}.png`);
          const jpeg = await session.snapshot(); subframes.push({ frame: sample, jpeg }); subvideo.push(jpeg);
          subtimes.push(await session.page.evaluate(() => ({ tick: window.__SS__!.tick(), time: window.__SS__!.getState().render.vfx!.time })));
        }
        assert.ok(subtimes.every(t => t.tick === subtimes[0].tick));
        await session.makeSheet(subframes, `${out}/subsequence.jpg`, 640, 1600);
        encodeWebm(subvideo, `${out}/subsequence.webm`, 60); // 4× slow motion for visual review.
        writeJson(`${out}/probes.json`, { name, firstShot, metrics, probes, subframeIntervalS: 1 / 240, subtimes, errors: session.errors });
        results.push({ name, pass: true, firstShot, visibleFrames: visible.length, movingPairs, drawCalls: metrics.perf.drawCalls.max, triangles: metrics.perf.triangles.max });
        console.log(JSON.stringify(results.at(-1)));
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); writeJson('test-results/tracers/summary.json', results); }
