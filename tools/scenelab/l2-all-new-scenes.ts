/** L2 production-renderer crowd, story and state evidence, one pooled browser at a time. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadavg } from 'node:os';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import type { SceneSpec, ActorSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

const root = process.cwd(), tier = process.env.REVIEW_TIER === 'high' ? 'high' : 'low';
const mode = process.env.L2_CAPTURE ?? 'crowd', variant = process.env.REVIEW_VARIANT ?? 'new';
const out = resolve(root, `test-results/l2-all-new/${mode}-${variant}-${tier}`);
const pedestrians = ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.civilian-elderly'];
export const crowd30: SceneSpec = {
  name: 'l2-street-crowd30', ground: 'district', time: 'L2', tier: 1, size: 100,
  layout: { district: 'D-GROVE', level: 'L2', bbox: [[-61, -13], [-30, 13]] },
  actors: Array.from({ length: 30 }, (_, i): ActorSpec => {
    const at: [number, number] = [-55 + i % 10 * 2, -3 + Math.floor(i / 10) * 3];
    if (i === 0) return { id: 'courier', kind: 'courier', at, yaw: -45 };
    if (i === 1) return { id: 'corgi', kind: 'corgi', at, yaw: -45 };
    const model = i < 4 ? 'npc.civilian-kid' : i < 8 ? 'npc.police-officer' : i < 14 ? 'npc.firefighter-alive' : pedestrians[(i - 14) % 5];
    return { id: `ped-${i}`, kind: 'pedestrian', at, yaw: -45, look: { model, handProp: model === 'npc.civilian-elderly' ? 'cane' : null }, state: 'idle' };
  }),
  script: Array.from({ length: 6 }, (_, i) => ({ frame: 1, actor: `ped-${14 + i}`, do: { infect: { instant: true } } })),
  camera: { mode: 'game', target: [-46, .7, 0], zoom: 2 }, frames: 3, shots: [3], expect: { consoleErrors: 0 },
};
if (variant === 'old') process.chdir(process.env.BASELINE_ROOT ?? resolve(root, '../l2-all-new-baseline'));
const session = new SceneSession({ backend: 'webgl2', tier, viewport: { width: 1600, height: 900 }, query: { crowdProbe: 'full' } });
const receipts = [];
try {
  await session.open();
  const files = mode === 'story' ? ['tests/scenes/catalog/fix-p1-l2-start-courier-crew.json', 'tests/scenes/qa-l2-truck-drive-full.json', 'tests/scenes/catalog/collision-l2-release.json', 'tests/scenes/catalog/l2-finale-streets.json', 'tests/scenes/catalog/l2-finale-bridge.json', 'specs/scenes/catalog/l2-market-doors.json'] : [];
  for (const file of files) {
    const spec = readSpec(resolve(file));
    const result = await runSpec(session, spec, { file, out: resolve(out, spec.name!), sheet: Math.max(spec.sheet ?? 60, Math.ceil((spec.frames ?? 180) / 12)) });
    receipts.push({ file, ...result }); writeJson(`${out}/receipts.json`, receipts);
    assert.ok(result.pass, `${spec.name}: ${JSON.stringify(result.failed)}`);
  }
  if (mode === 'crowd' || mode === 'perf') {
    const result = await runSpec(session, crowd30, { out, sheet: 0 });
    receipts.push(result); assert.ok(result.pass, JSON.stringify(result.failed));
    const metrics = await session.metrics();
    assert.equal(Object.keys(metrics.actors).length, 30);
    const resources = await session.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const textures = new Set<import('three').Texture>();
      game.view.scene.traverse(node => {
        const mesh = node as import('three').Mesh;
        if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) for (const value of Object.values(material)) if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as import('three').Texture);
        for (const texture of node.userData.preRenderTextures ?? []) textures.add(texture);
      });
      let decodedBytes = 0, rgbaUpperBoundBytes = 0;
      for (const texture of textures) {
        const image = texture.image as { width?: number; height?: number; data?: { byteLength: number } };
        if (!image?.width || !image.height) continue;
        const mips = texture.mipmaps as { data?: { byteLength: number } }[];
        decodedBytes += mips.reduce((n, mip) => n + (mip.data?.byteLength ?? 0), 0) || image.data?.byteLength || image.width * image.height * 4;
        rgbaUpperBoundBytes += image.data?.byteLength ?? Math.ceil(image.width * image.height * 4 * (texture.generateMipmaps || mips.length > 1 ? 4 / 3 : 1));
      }
      return { textureCount: textures.size, decodedBytes, rgbaUpperBoundBytes, render: window.__SS__!.getState().render };
    });
    writeJson(`${out}/receipt.json`, { variant, tier, result, metrics, resources, errors: session.errors });
    if (mode === 'perf') {
      // Shared-pool cadence, including live AI and animation. Final quiet timing
      // remains separate; report the refresh cap and competing leases explicitly.
      let peakLeases = 0;
      const monitor = setInterval(() => { void fetch('http://127.0.0.1:4329/status').then(r => r.json()).then((s: { leases: unknown[] }) => { peakLeases = Math.max(peakLeases, s.leases.length); }).catch(() => { peakLeases = Infinity; }); }, 1000);
      const hostLoad = loadavg();
      try {
        const cadence = await session.page.evaluate(async () => {
          const a = window.__SS__!; a.resume();
          const frames: number[] = []; let previous = 0, warm: Record<string, number> = {};
          for (let i = 0; i < 720; i++) { const now = await new Promise<number>(requestAnimationFrame); if (i === 119) warm = { ...a.perf().nodeBuildMaterials }; if (i >= 120 && previous) frames.push(now - previous); previous = now; }
          a.pause(); frames.sort((a, b) => a - b);
          const builds = Object.entries(a.perf().nodeBuildMaterials).filter(([key, count]) => count !== (warm[key] ?? 0));
          return { count: frames.length, p50: frames[Math.floor(frames.length * .5)], p95: frames[Math.ceil(frames.length * .95) - 1], max: frames[frames.length - 1], over200: frames.filter(t => t > 200).length, builds };
        });
        writeJson(`${out}/cadence.json`, { variant, tier, cadence, peakLeases, hostLoad, protocol: 'shared native Metal WebGL2, 60 Hz cap, 120 warm-up frames + 600 sampled frames, live L2 30-figure cast', errors: session.errors });
        assert.equal(peakLeases, 1, 'No competing shared context during cadence sample');
        assert.equal(cadence.over200, 0);
        assert.deepEqual(cadence.builds, [], 'No shader builds after warm-up');
      } finally { clearInterval(monitor); }
    }
  }
  if (mode === 'states') for (const model of ['npc.civilian-kid', 'npc.police-officer']) for (const state of model.endsWith('kid') ? ['healthy'] : ['healthy', 'turned', 'corpse']) {
    const spec: SceneSpec = { name: `${model}-${state}`, ground: 'asphalt', time: 'L2', size: 100,
      actors: [{ id: 'courier', kind: 'courier', at: [40, 40] }, { id: 'figure', kind: 'pedestrian', at: [0, 0], yaw: -45, look: { model }, state: 'idle' }],
      script: [...state !== 'healthy' ? [{ frame: 1, actor: 'figure', do: { infect: { instant: true } } }] : [], ...state === 'corpse' ? [{ frame: 2, actor: 'figure', do: { corpse: true as const } }] : []],
      camera: { mode: 'close', target: [0, .7, 0], radius: 6, azimuth: 45 }, frames: 180, shots: [3, 90, 180], expect: { consoleErrors: 0 } };
    const result = await runSpec(session, spec, { out: resolve(out, spec.name!), sheet: 60 });
    receipts.push({ model, state, ...result }); writeJson(`${out}/receipts.json`, receipts); assert.ok(result.pass, JSON.stringify(result.failed));
  }
  assert.equal(session.errors.length, 0);
} finally { await session.close(); stopServer(); process.chdir(root); }
console.log(JSON.stringify(receipts.map(r => ({ pass: r.pass, files: r.files }))));
