/** Native frame cadence and complete GPU pass queries. Run only through perf/quiet-run.sh. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
const tier = process.argv.includes('--low') ? 'low' : 'high';
const out = process.env.E25_OUT ?? `test-results/epics/E25/final/perf-${tier}`;
mkdirSync(out, { recursive: true });
const s = new SceneSession({ tier, backend: 'webgl2', viewport: { width: 1600, height: 900 }, nativeFrameTiming: true, query: { crowdProbe: 'drawn' } });
const rows: unknown[] = [];
try {
  await s.open(); await s.page.evaluate('globalThis.__name = (fn) => fn');
  for (const scenario of ['light-lab', 'night-street', ...(tier === 'high' ? ['reflection-lab'] : [])]) {
    if (scenario === 'night-street') {
      await s.page.evaluate(async () => { await window.__SS__!.loadLevel('night-street', { seed: 1 }); window.__SS__!.pause(); });
    } else {
      const spec: SceneSpec = scenario === 'light-lab'
        ? { name: scenario, ground: 'asphalt', size: 60, time: 'night', dof: false, props: [{ asset: 'prop.light-tower-trailer', at: [-10, 0], powerGroup: 'trailer' }, { asset: 'prop.privacy-fence', at: [8, 0], scale: [1, 1, 4] }], actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }], camera: { mode: 'pose', position: [24, 32, 36], target: [0, 0, 0] } }
        : { name: scenario, ground: 'asphalt', size: 50, time: 'night', weather: 'rain', weatherWarmup: 120, dof: false, props: [{ asset: 'prop.jukebox', at: [-3, 0] }, { asset: 'prop.street-lamp', at: [3, 0] }, { asset: 'veh.sedan-green', at: [0, -4] }], actors: [{ id: 'courier', kind: 'courier', at: [-12, -8] }], camera: { mode: 'pose', position: [15, 18, 20], target: [0, 0, 0] } };
      await s.load(spec); await s.step(120);
    }
    await s.ready();
    const probeMode = await s.page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      g.view.renderer.profile = null; g.view.renderer.profileAssets = null;
      // Scene Lab enables full skeleton diagnostic snapshots for visual captures.
      // Native timing keeps submission records and the production renderer, as
      // the existing crowdProbe=drawn timing path intends.
      const crowd = (g.view as unknown as { crowd?: { batches: Map<string, { probe: { constructor: { joints: boolean } } }> } }).crowd;
      const probe = crowd?.batches.values().next().value?.probe;
      if (!probe) throw Error('Cannot disable visual-only skeleton diagnostics');
      probe.constructor.joints = false;
      return { profile: g.view.renderer.profile, skeletonJoints: probe.constructor.joints, backend: g.perf().backend };
    });
    const native = await s.page.evaluate(async () => {
      const a = window.__SS__!, frames: number[] = [], sim: number[] = [];
      a.cheats.god(true); a.resume();
      for (let i = 0; i < 120; i++) await new Promise(requestAnimationFrame);
      const start = { tick: a.tick(), frames: a.perf().renderedFrames };
      let prev = await new Promise<number>(requestAnimationFrame), maxDraws = 0, maxTriangles = 0;
      for (let i = 0; i < 300; i++) {
        const now = await new Promise<number>(requestAnimationFrame), p = a.perf();
        frames.push(now - prev); prev = now; sim.push(p.simMs);
        maxDraws = Math.max(maxDraws, p.drawCalls); maxTriangles = Math.max(maxTriangles, p.triangles);
      }
      a.pause(); frames.sort((a, b) => a - b); sim.sort((a, b) => a - b);
      return { samples: frames.length, frameP50: frames[149], frameP95: frames[284], simP95: sim[284], maxDraws, maxTriangles,
        ticks: a.tick() - start.tick, renderedFrames: a.perf().renderedFrames - start.frames, frameMs: frames, perf: a.perf() };
    });
    const gpu = await s.page.evaluate(async scenario => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game, r = g.view.renderer;
      type Context = { textures: { name: string }[] | null; depthTexture?: { name: string }; width: number; height: number };
      const backend = r.backend as unknown as { trackTimestamp: boolean; disjoint?: unknown; beginRender(context: Context): void; getTimestampUID(context: Context): string; getTimestamp(uid: string): number; hasTimestampQuery(uid: string): boolean };
      if (!backend.disjoint) return { available: false, reason: 'EXT_disjoint_timer_query_webgl2 unavailable', groups: [] };
      const begin = backend.beginRender.bind(backend), render = r.render.bind(r);
      let label = '', contexts: { uid: string; label: string; width: number; height: number }[] = [];
      backend.trackTimestamp = true;
      r.render = (scene, camera) => { const old = label; label = scene.name || scene.type; try { return render(scene, camera); } finally { label = old; } };
      backend.beginRender = context => {
        begin(context);
        contexts.push({ uid: backend.getTimestampUID(context), label: context.textures?.map(t => t.name).filter(Boolean).join('+') || context.depthTexture?.name || label, width: context.width, height: context.height });
      };
      const post = (g.view as unknown as { postFx?: { wetReflections?: { enabled: { value: number } } } }).postFx;
      const groups = [];
      try {
        for (const enabled of scenario === 'reflection-lab' ? [1, 0, 1, 0] : [1]) {
          if (post?.wetReflections) post.wetReflections.enabled.value = enabled;
          const samples = [];
          for (let i = 0; i < 35; i++) {
            contexts = []; r.nextNodeFrame();
            const f = (r as unknown as { _nodes: { nodeFrame: { time: number; deltaTime: number } } })._nodes.nodeFrame;
            f.time = f.deltaTime = 0; g.view.update(1);
            const total = await r.resolveTimestampsAsync('render');
            const passes = contexts.map(c => ({ ...c, ms: backend.hasTimestampQuery(c.uid) ? backend.getTimestamp(c.uid) : null }));
            if (i >= 5) samples.push({ backendReportedMs: total, totalMs: passes.reduce((sum, p) => sum + (p.ms ?? 0), 0), passes });
          }
          groups.push({ ssrEnabled: enabled, samples });
        }
      } finally { backend.trackTimestamp = false; backend.beginRender = begin; r.render = render; if (post?.wetReflections) post.wetReflections.enabled.value = 1; }
      return { available: true, groups };
    }, scenario);
    const cdp = await s.page.context().newCDPSession(s.page);
    for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage'); await cdp.detach();
    rows.push({ scenario, tier, viewport: [1600, 900], probeMode, native, gpu, heap,
      budgets: { frame: native.frameP95 <= (tier === 'high' ? 16.7 : 33.3), draws: native.maxDraws <= (tier === 'high' ? 600 : 300), triangles: native.maxTriangles <= (tier === 'high' ? 1500000 : 500000), heap: heap.usedSize <= (tier === 'high' ? 400e6 : 250e6), sim: native.simP95 <= (tier === 'high' ? 4 : 6) } });
    console.log(`${scenario} ${tier}: native p95 ${native.frameP95.toFixed(3)} ms; GPU queries ${gpu.available}`);
  }
} finally {
  writeFileSync(`${out}/measurements.json`, JSON.stringify({ tier, rows, errors: s.errors }, null, 2) + '\n');
  await s.close(); stopServer();
}
