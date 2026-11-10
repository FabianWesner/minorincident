/** r27-l9apc: L9 first boarder wave freeze probe. Real-time play (not stepped): the APC drops to the durability floor,
 * then a mixed wave meets the crawling hull so boarders climb. Records every frame over 150 ms, the renderer's runtime
 * node builds (material compiles) in it, and a CPU profile of the wave (top self-time functions).
 * Usage: SCENE_PORT=4896 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/r27-l9-boarders.ts
 * (REVIEW_TIER=low|high, REVIEW_BACKEND=webgl2|webgpu, R27_TAG=label) */
import { SceneSession, stopServer, writeJson } from './session';

const tier = process.env.REVIEW_TIER === 'high' ? 'high' : 'low';
const backend = process.env.REVIEW_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const session = new SceneSession({ tier, backend, query: { loadProfile: '2' } });
type Node = { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; hitCount?: number };
try {
  await session.open();
  // tsx keeps function names with an injected __name helper that the page does not have.
  await session.page.evaluate(`window.__name = (f) => f;
    window.__r27 = { spikes: [], frame: () => new Promise(resolve => requestAnimationFrame(t => resolve(t))) };
    window.__r27.watch = async (label, ms) => {
      const api = window.__SS__, r = window.__r27; let last = await r.frame(), builds = api.perf().nodeBuilds, materials = { ...api.perf().nodeBuildMaterials }, worst = 0;
      const end = performance.now() + ms;
      while (performance.now() < end) {
        const now = await r.frame(), dt = now - last; last = now; worst = Math.max(worst, dt);
        const perf = api.perf();
        if (dt > 150 || perf.nodeBuilds !== builds) {
          r.spikes.push({ label, tick: api.tick(), dt: Math.round(dt), updateCpuMs: perf.updateCpuMs, renderCpuMs: perf.renderCpuMs, simMs: perf.simMs, newBuilds: perf.nodeBuilds - builds,
            materials: Object.entries(perf.nodeBuildMaterials).filter(([key, count]) => count > (materials[key] ?? 0)).map(([key]) => key).slice(0, 40) });
          builds = perf.nodeBuilds; materials = { ...perf.nodeBuildMaterials };
        }
      }
      return worst;
    };`);
  const setup = await session.page.evaluate(async () => {
    const api = window.__SS__!, r = (window as unknown as { __r27: { watch: (label: string, ms: number) => Promise<number> } }).__r27;
    await api.loadLevel('L9', { seed: 1, progression: 'L9-default' });
    api.missions.begin(); api.pause(); api.cheats.god(true); await api.screenshotReady();
    const carId = api.query({ kind: 'vehicle' }).find(e => e.archetype === 'vehicle.military-apc' && e.vehicle?.driver === 1)!.id;
    api.resume(); const worstIdle = await r.watch('idle', 4000);
    api.explosions.wreck(carId);
    const worstFloor = await r.watch('floor', 4000);
    return { carId, worstIdle, worstFloor };
  });
  const cdp = await session.page.context().newCDPSession(session.page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
  const wave = await session.page.evaluate(async carId => {
    const api = window.__SS__!, r = (window as unknown as { __r27: { watch: (label: string, ms: number) => Promise<number>; spikes: unknown[] } }).__r27;
    const apc = api.getEntity(carId)!;
    const types = ['infected.runner', 'infected.sprinter', 'infected.dog', 'infected.runner', 'infected.brute', 'infected.armored'];
    // Crawl forward so the wave reaches the moving hull's sides and climbs aboard (a stationary hull holds them off).
    const c = Math.cos(apc.transform.yaw), s = Math.sin(apc.transform.yaw);
    for (let i = 0; i < 18; i++) {
      const along = 2 + (i % 6) * 2, side = (i % 2 ? 1 : -1) * (2.2 + (i % 3) * .4);
      api.spawn(types[i % types.length], { x: apc.transform.x + c * along + s * side, z: apc.transform.z - s * along + c * side }, { state: 'chase' });
    }
    api.input.set({ drive: { throttle: .35, steer: 0 }, brake: false });
    const worstWave = await r.watch('wave', 12000);
    api.input.clear();
    const state = api.getEntity(carId)!;
    return { worstWave, attached: state.vehicle?.attached.length, stage: state.vehicle?.stage, spikes: r.spikes, backend: api.perf().backend, nodeBuilds: api.perf().nodeBuilds };
  }, setup.carId);
  const { profile } = await cdp.send('Profiler.stop') as { profile: { nodes: Node[]; samples: number[]; timeDeltas: number[] } };
  const self = new Map<string, number>(), byId = new Map(profile.nodes.map(n => [n.id, n]));
  profile.samples.forEach((id, i) => { const n = byId.get(id)!, key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(key, (self.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000); });
  const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, ms]) => ({ fn: k, ms: Math.round(ms) }));
  const result = { ...setup, ...wave, profileTop: top };
  const out = `test-results/r27-l9apc/boarders-${tier}-${backend}${process.env.R27_TAG ? `-${process.env.R27_TAG}` : ''}`;
  writeJson(`${out}/result.json`, { tier, backend, result, errors: session.errors });
  await session.screenshot(`${out}/end.png`);
  console.log(JSON.stringify({ tier, backend, worstIdle: result.worstIdle, worstFloor: result.worstFloor, worstWave: result.worstWave, attached: result.attached, spikes: result.spikes.length, errors: session.errors.length }));
} finally { await session.close(); stopServer(); }
