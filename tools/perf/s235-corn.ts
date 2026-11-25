/** Headless native frame timing through the L10 corn; run under quiet-run. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';

const label = process.argv[2] ?? 'candidate';
const session = new SceneSession({ backend: 'webgl2', tier: 'high', nativeFrameTiming: true, viewport: { width: 1280, height: 720 }, seed: 32 });
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  const result = await session.page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L10', { seed: 32 }); a.pause(); a.missions.begin(); a.inspect.enable(false); a.cheats.god(true);
    a.camera.follow(); a.camera.zoom(1); a.teleport('player', { x: 555, z: 42 });
    const dog = a.query({}).find(e => e.companion); if (dog) a.teleport(dog.id, { x: 554, z: 42 });
    await a.step(90); await a.screenshotReady();
    const start = a.getEntity(1)!.transform.x;
    const times: number[] = [];
    const done = new Promise<void>(resolve => {
      let last = performance.now(); const until = last + 6000;
      const frame = (now: number) => { times.push(now - last); last = now; if (now < until) requestAnimationFrame(frame); else resolve(); };
      requestAnimationFrame(frame);
    });
    a.input.set({ move: { x: 1, z: 0 }, walk: true }); a.resume(); await done; a.pause(); a.input.clear();
    const end = a.getEntity(1)!.transform.x, sorted = [...times].sort((x, y) => x - y);
    return { start, end, samples: times.length, max: sorted.at(-1), p95: sorted[Math.ceil(sorted.length * .95) - 1], p99: sorted[Math.ceil(sorted.length * .99) - 1], backend: a.perf().backend, quality: a.getState().render.quality, times };
  });
  mkdirSync('test-results/s235-corn-perf', { recursive: true });
  writeFileSync(`test-results/s235-corn-perf/${label}.json`, JSON.stringify({ ...result, errors: session.errors }, null, 2));
  console.log(JSON.stringify({ label, ...result, times: undefined, errors: session.errors }));
  if (result.end - result.start < 3 || result.backend !== 'webgl' || result.quality !== 'high' || session.errors.length) throw Error('Corn timing fixture invalid');
} finally { await session.close(); stopServer(); }
