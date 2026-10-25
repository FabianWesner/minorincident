/** Identical 200-AI, six-model scene on main and this lane. ABBA, native headless Metal, one browser per reservation. */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { get } from 'node:http';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';
import type { InstancedMesh } from 'three';
import { SceneSession, stopServer, writeJson, type Backend } from './session';

const root = process.cwd(), baseline = resolve(process.env.BASELINE_ROOT ?? '../skinned-prod-baseline');
const out = resolve(root, 'docs/reports/skinned-prod'), receipts: Record<string, unknown>[] = [];
const models = ['inf.common-worker', 'inf.nurse', 'npc.civilian-woman-a', 'npc.civilian-man-b', 'inf.dog', 'inf.zebra'];
const spec: SceneSpec = { name: 'skinned-prod-200', size: 120, ground: 'asphalt', time: 'golden', infectedCap: 200,
  actors: [{ id: 'courier', kind: 'courier', at: [0, 0], god: true },
    // Both builds discover these civilian rigs before the infected view initializes.
    { id: 'register-woman', kind: 'pedestrian', at: [45, 45], look: { model: models[2] } },
    { id: 'register-man', kind: 'pedestrian', at: [48, 45], look: { model: models[3] } },
    ...Array.from({ length: 200 }, (_, i) => ({ id: `ai-${i}`, kind: 'infected' as const,
      archetype: i % 6 === 4 ? 'infected.dog' : i % 6 === 5 ? 'infected.zebra' : i % 6 === 1 ? 'infected.nurse' : 'infected.sprinter',
      at: [i % 20 * .8 - 8, Math.floor(i / 20) * .8 - 12] as [number, number], state: 'chase' as const, look: { model: models[i % 6] } }))],
  camera: { mode: 'pose', position: [40, 45, 32], target: [2, .5, 0] } };
process.env.SCENE_SERVER = 'preview';
try {
  for (const backend of (process.env.BACKENDS ?? 'webgl2,webgpu').split(',') as Backend[]) for (const variant of (process.env.VARIANTS ?? 'main,skin,skin,main').split(',')) {
    process.chdir(variant === 'main' ? baseline : root); process.env.SCENE_DIST = 'dist';
    const session = new SceneSession({ backend, tier: 'high', nativeFrameTiming: true, query: { crowdProbe: 'drawn' } });
    try {
      await session.open(); await session.load(spec);
      await session.page.evaluate(() => { window.__SS__!.settings.set({ quality: 'low' }); window.__SS__!.debug.figureJoints(false); window.__SS__!.cheats.god(true); });
      await session.step(120); await session.ready();
      const profiler = process.env.PROFILE ? await session.page.context().newCDPSession(session.page) : undefined;
      if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.start'); }
      let overlap = false;
      const monitor = setInterval(() => {
        const processes = execFileSync('ps', ['-axo', 'command='], { encoding: 'utf8' }).split('\n');
        const browsers = processes.filter(line => /^\/(?:.*\/)?(?:chrome-headless-shell|Chromium|Google Chrome) /.test(line) && !line.includes('--type=') && (line.includes('headless') || line.includes('--remote-debugging')));
        if (browsers.length > 1) overlap = true;
      }, 500);
      let result;
      try {
        result = await session.page.evaluate(async () => {
          const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
          const crowd = (game.view as unknown as { crowd: { batches: Map<string, { count: number; asset: string; lod: string; texture: { image: { width: number; height: number } }; mesh: InstancedMesh; probe: { figures: { id: number; drawn: boolean }[] } }> } }).crowd;
          const frames: number[] = [], assets = new Set<string>(), skins = new Set<string>();
          let missing: unknown[] = [];
          let previous = 0, minBodies = Infinity, maxDraws = 0;
          const started = performance.now(); api.resume();
          for (let i = 0; i < 720 || performance.now() - started < 12000; i++) {
            const now = await new Promise<number>(requestAnimationFrame);
            if (i >= 120 && previous) frames.push(now - previous); previous = now;
            if (i % 30 === 0) {
              let bodies = 0;
              for (const batch of crowd.batches.values()) if (batch.count) {
                bodies += batch.count; assets.add(batch.asset); if (batch.mesh.geometry.hasAttribute('_skin')) skins.add(batch.asset);
              }
              if (bodies < minBodies) {
                const drawn = new Set([...crowd.batches.values()].flatMap(b => b.probe.figures.filter(f => f.drawn).map(f => f.id)));
                missing = game.world.infected!.active.filter(e => !drawn.has(e.id)).map(e => ({ id: e.id, archetype: e.archetype, at: e.transform, hidden: e.hidden, corpse: e.corpse, civilian: e.civilian?.state, state: e.infected?.state }));
              }
              minBodies = Math.min(minBodies, bodies); maxDraws = Math.max(maxDraws, api.getState().render.crowd?.meshDrawCalls ?? 0);
            }
          }
          api.pause(); frames.sort((a, b) => a - b);
          const perf = api.perf();
          // Inspect after sampling: identical LOD/quality choices and the actual vertex/bone workload.
          const batches = [...crowd.batches.values()].filter(b => b.count).map(b => {
            const g = b.mesh.geometry, skin = g.getAttribute('_skin'), vertices = g.getAttribute('position').count;
            let influences = 0;
            if (skin) for (let i = 0; i < skin.count; i++) influences += 1 + Number(skin.getY(i) > 0) + Number(skin.getZ(i) > 0) + Number(skin.getW(i) % 1 > 0);
            return { asset: b.asset, lod: b.lod, instances: b.count, vertices, triangles: (g.index?.count ?? vertices) / 3,
              meanInfluences: skin ? influences / vertices : 1, poseTexture: [b.texture.image.width, b.texture.image.height] };
          });
          return { batches, backend: perf.backend, quality: api.getState().render.quality, count: api.getState().ai?.count, minBodies, maxDraws,
            missing, assets: [...assets].sort(), skins: [...skins].sort(), samples: frames.length, p95: frames[Math.ceil(frames.length * .95) - 1],
            p50: frames[Math.ceil(frames.length * .5) - 1], triangles: perf.triangles, updateCpuMs: perf.updateCpuMs, renderCpuMs: perf.renderCpuMs, simMs: perf.simMs, elapsedMs: performance.now() - started };
        });
      } finally { clearInterval(monitor); }
      if (profiler) writeJson(resolve(out, `cpu-profile-${variant}-${backend}.json`), await profiler.send('Profiler.stop'));
      if (overlap) throw Error('Concurrent browser detected; timing is invalid');
      receipts.push({ variant, ...result, errors: [...session.errors] }); writeJson(resolve(out, 'performance.json'), receipts);
      console.log(JSON.stringify({ variant, ...result, errors: session.errors.length }));
      if (result.quality !== 'low' || result.backend !== (backend === 'webgl2' ? 'webgl' : 'webgpu') || result.count !== 200 || result.minBodies !== 200 || result.maxDraws > 30 || variant === 'skin' && result.skins.length < 6 || session.errors.length) throw Error('Invalid 200-AI receipt');
    } finally { await session.close(); stopServer(); }
    for (let i = 0; i < 30; i++) {
      const alive = await new Promise<boolean>(resolve => {
        const request = get(`http://127.0.0.1:${process.env.SCENE_PORT ?? 4632}`, { agent: false }, response => { response.resume(); resolve(true); });
        request.on('error', () => resolve(false)); request.setTimeout(1000, () => { request.destroy(); resolve(false); });
      });
      if (!alive) break; await new Promise(r => setTimeout(r, 100));
    }
  }
  if (process.env.PROFILE) { console.log('Diagnostic profile complete; this is not an acceptance run.'); process.exitCode = 0; }
  else {
  const summaries = ['webgl', 'webgpu'].map(backend => {
    const rows = receipts.filter(r => r.backend === backend);
    const mean = (variant: string) => { const values = rows.filter(r => r.variant === variant).map(r => r.p95 as number); return values.reduce((a, b) => a + b, 0) / values.length; };
    const before = mean('main'), after = mean('skin');
    return { backend, mainP95: before, skinP95: after, deltaMs: after - before, passed: rows.length === 4 && after - before <= 1 };
  });
  writeJson(resolve(out, 'performance-summary.json'), summaries);
  if (summaries.some(row => !row.passed)) throw Error('Low p95 exceeded main +1 ms');
  }
} finally { stopServer(); process.chdir(root); writeJson(resolve(out, 'performance.json'), receipts); }
