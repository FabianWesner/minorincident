import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ActorSpec, SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer, writeJson } from './session';
import { poolUrl } from '../browser-pool/client';

// Run under tools/perf/quiet-run.sh. Baselines are served from temporary modules in this worktree, never another build/worktree.
const flag = (key: string) => { const i = process.argv.indexOf(`--${key}`); return i < 0 ? undefined : process.argv[i + 1]; };
if (flag('backend') && !['webgl2', 'webgpu'].includes(flag('backend')!)) throw new Error('Invalid --backend');
if (flag('tier') && !['low', 'high'].includes(flag('tier')!)) throw new Error('Invalid --tier');
const profile = `${flag('backend') ?? 'both'}-${flag('tier') ?? 'both'}`;
const run = new Date().toISOString().replace(/[:.]/g, '-');
const out = resolve(`test-results/luna-fixes-1101/performance/${profile}/${run}`);
mkdirSync(out, { recursive: true });
const paths = ['src/render/PaletteMaterial.ts', 'src/render/GameView.ts', 'src/render/district/DistrictOcclusion.ts', 'src/render/VehicleView.ts', 'src/render/characters/VehicleOccupant.ts'];
const temporary: string[] = [];
interface HostSample { at: string; load: number[]; busy: { pid: number; job: string; kind: string }[] }
async function hostSample(): Promise<HostSample> {
  const token = process.env.MI_BROWSER_POOL_EXCLUSIVE;
  if (!token) throw new Error('Timing requires an exclusive pool reservation');
  const response = await fetch(`${poolUrl()}/exclusive/${encodeURIComponent(token)}?quiet=1`);
  if (!response.ok) throw new Error(`Cannot verify timing reservation (${response.status})`);
  const { granted, conditions } = await response.json() as { granted: boolean; conditions: { load: number[]; busy: { pid: number; command: string }[] } };
  if (!granted) throw new Error('Timing reservation is not granted');
  return { at: new Date().toISOString(), load: conditions.load, busy: conditions.busy.map(p => ({
    pid: p.pid, job: /\/worktrees\/([^/]+)\//.exec(p.command)?.[1] ?? 'unlabelled',
    kind: /vitest/.test(p.command) ? 'unit tests' : /tsc/.test(p.command) ? 'typecheck' : /vite.*build/.test(p.command) ? 'build' : /headless/.test(p.command) ? 'foreign browser' : 'CPU work',
  })) };
}
const receipts: { phase: string; backend: string; tier: string; scene: string; maxMs: number; p95Ms: number; samples: number[]; draws: number; triangles: number; hostBefore: HostSample; hostAfter: HostSample }[] = [];
const crowd: ActorSpec[] = Array.from({ length: 80 }, (_, i) => ({ id: `zombie-${i}`, kind: 'infected', at: [(i % 10 - 4.5) * .48, (Math.floor(i / 10) - 3.5) * .48], state: 'idle' }));
const actors: ActorSpec[] = [{ id: 'courier', kind: 'courier', at: [0, 0] }, { id: 'corgi', kind: 'corgi', at: [1, 0] }];
const scenes: SceneSpec[] = [
  { name: 'L1-alley', ground: 'district', time: 'L1', layout: { district: 'D-GROVE', bbox: [[-30, -54], [30, -44]] }, actors: [{ id: 'courier', kind: 'courier', at: [-18, -48.5] }], camera: { mode: 'game', target: 'courier', zoom: .5 } },
  { name: 'L3-horde', ground: 'asphalt', time: 'L3', infectedCap: 200, actors: [actors[0], ...crowd], camera: { mode: 'game', target: 'courier', zoom: .5 } },
  { name: 'L5-fog', ground: 'asphalt', time: 'L5', weather: 'fog', actors, camera: { mode: 'game', target: 'courier', zoom: .5 } },
  { name: 'L8-night', ground: 'asphalt', time: 'L8-zoo', actors, camera: { mode: 'game', target: 'courier', zoom: .5 } },
  { name: 'L9-APC', ground: 'asphalt', time: 'L9-crossing', actors: [actors[0]], vehicles: [{ id: 'apc', asset: 'vehicle.military-apc', at: [0, 0], yaw: 90, driven: true, floor: true, health: 500 }], camera: { mode: 'game', target: 'apc', zoom: .5 } },
];
const session = new SceneSession({ backend: 'webgpu', tier: 'low', nativeFrameTiming: true });
await session.open();
try {
  for (const path of paths) { const temp = path.replace(/([^/]+)$/, '__luna_perf_before_$1'); writeFileSync(temp, execFileSync('git', ['show', `0e3e33219:${path}`])); temporary.push(temp); }
  for (const backend of (['webgl2', 'webgpu'] as const).filter(b => !flag('backend') || flag('backend') === b)) for (const tier of (['low', 'high'] as const).filter(t => !flag('tier') || flag('tier') === t)) for (const phase of ['before', 'after']) {
    {
      session.options.backend = backend; session.options.tier = tier;
      await session.page.unrouteAll({ behavior: 'wait' });
      if (phase === 'before') {
        for (const path of paths) await session.page.route(`**/${path}*`, async route => { const response = await route.fetch({ url: route.request().url().replace(path, path.replace(/([^/]+)$/, '__luna_perf_before_$1')) }); await route.fulfill({ response }); });
        for (const suffix of ['layout.json', 'base.glb']) await session.page.route(`**/assets/layouts/D-GROVE.${suffix}*`, route => route.fulfill({ body: execFileSync('git', ['show', `0e3e33219:public/assets/layouts/D-GROVE.${suffix}`], { maxBuffer: 8 * 1024 * 1024 }), contentType: suffix.endsWith('json') ? 'application/json' : 'model/gltf-binary' }));
      }
      await session.page.goto(`http://127.0.0.1:4872/?test=1&scenelab=1&profile=1&dpr=1&quality=${tier}&audio=muted&seed=1${backend === 'webgl2' ? '&renderer=webgl' : ''}`);
      await session.page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
      await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
      for (const scene of scenes) {
        await session.load(scene); await session.step(1); await session.ready();
        const actualBackend = await session.page.evaluate(() => window.__SS__!.perf().backend);
        if (actualBackend !== (backend === 'webgl2' ? 'webgl' : 'webgpu')) throw new Error(`Requested ${backend}, got ${actualBackend}`);
        const hostBefore = await hostSample();
        if (hostBefore.busy.length) {
          writeJson(`${out}/interrupted.json`, { phase, backend, tier, scene: scene.name, hostBefore });
          throw new Error('Foreign CPU/browser work appeared before timing; retry in a coordinated quiet window');
        }
        const sample = await session.page.evaluate(async () => {
          const api = window.__SS__!; api.pause(); api.inspect.enable(false);
          const samples: number[] = []; let previous = 0;
          for (let i = 0; i < 480; i++) { const now = await new Promise<number>(requestAnimationFrame); await api.step(1); if (i >= 120 && previous) samples.push(now - previous); previous = now; }
          api.pause(); const perf = api.perf(), sorted = [...samples].sort((a, b) => a - b);
          return { samples, maxMs: Math.max(...samples), p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], draws: perf.drawCalls, triangles: perf.triangles };
        });
        const hostAfter = await hostSample();
        receipts.push({ phase, backend, tier, scene: scene.name!, ...sample, hostBefore, hostAfter });
        writeJson(`${out}/frames.json`, { protocol: 'one fixed simulation tick per presented frame; 120 warmup and 360 measured ticks', quietPool: !!process.env.MI_BROWSER_POOL_EXCLUSIVE, headless: true, receipts });
        console.log(`${phase} ${backend} ${tier} ${scene.name}: max ${sample.maxMs.toFixed(2)} ms`);
        if (hostAfter.busy.length) throw new Error('Foreign CPU/browser work appeared during timing; receipt retained, acceptance invalid');
      }
      if (session.errors.length) throw new Error(session.errors.join('\n'));
    }
  }
} finally { for (const path of temporary) unlinkSync(path); await session.close(); stopServer(); }

const comparisons = receipts.filter(r => r.phase === 'after').map(after => {
  const before = receipts.find(r => r.phase === 'before' && r.backend === after.backend && r.tier === after.tier && r.scene === after.scene)!;
  return { backend: after.backend, tier: after.tier, scene: after.scene, beforeMaxMs: before.maxMs, afterMaxMs: after.maxMs, pass: after.maxMs <= before.maxMs };
});
const pass = comparisons.length > 0 && comparisons.every(c => c.pass);
writeJson(`${out}/comparison.json`, { pass, comparisons });
if (!pass) throw new Error('One or more scene maximum frame times regressed; no acceptance margin applied');

// Optional only when enough time remains in this reservation; the normal gate has its own bounded wrapper.
if (process.argv.includes('--gate')) {
  const result = spawnSync('sh', ['-c', 'npx tsc --noEmit && npm run lint && npm test && E2E_PORT=4871 SCENE_PORT=4872 npm run test:smoke && npm run scene:gate'], {
    stdio: 'inherit', env: { ...process.env, E2E_PORT: '4871', SCENE_PORT: '4872', MI_BUILD_CACHE: 'off' },
  });
  writeJson(`${out}/gate.json`, { pass: result.status === 0, exit: result.status, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() });
  if (result.status !== 0) throw new Error(`Requested gate failed (${result.status ?? result.signal})`);
}
