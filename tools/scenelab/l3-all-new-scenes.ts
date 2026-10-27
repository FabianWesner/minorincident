/** L3 production-renderer crowd, story and state evidence, one pooled browser at a time. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadavg } from 'node:os';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import type { SceneSpec, ActorSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

const root = process.cwd(), tier = process.env.REVIEW_TIER === 'high' ? 'high' : 'low';
const mode = process.env.L3_CAPTURE ?? 'crowd', variant = process.env.REVIEW_VARIANT ?? 'new';
const out = resolve(root, `test-results/l3-all-new/${mode}-${variant}-${tier}`);
const pedestrians = ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.civilian-elderly'];
export const crowd30: SceneSpec = {
  name: 'l3-street-crowd30', ground: 'district', time: 'L3', tier: 1, size: 100,
  layout: { district: 'D-CORRIDOR', level: 'L3', bbox: [[-61, -13], [-30, 13]] },
  actors: Array.from({ length: 30 }, (_, i): ActorSpec => {
    const at: [number, number] = [-55 + i % 10 * 2, -3 + Math.floor(i / 10) * 3];
    if (i === 0) return { id: 'courier', kind: 'courier', at, yaw: -45 };
    if (i === 1) return { id: 'corgi', kind: 'corgi', at, yaw: -45 };
    const model = i < 11 ? 'npc.national-guard' : i < 16 ? 'npc.police-officer' : pedestrians[(i - 16) % 5];
    const soldier = model === 'npc.national-guard', officer = model === 'npc.police-officer';
    return { id: `ped-${i}`, kind: 'pedestrian', at, yaw: -45,
      look: { model, handProp: soldier ? 'rifle' : model === 'npc.civilian-elderly' ? 'cane' : null, role: soldier ? 'soldier' : officer ? 'officer' : undefined, tint: soldier ? '#4b5a3a' : officer ? '#2f4858' : undefined },
      state: soldier ? { ally: { role: 'soldier', weapon: 'rifle' } } : officer ? { ally: { role: 'officer' } } : 'idle' };
  }),
  script: Array.from({ length: 6 }, (_, i) => ({ frame: 1, actor: `ped-${16 + i}`, do: { infect: { instant: true } } })),
  camera: { mode: 'game', target: [-46, .7, 0], zoom: 1.5 }, frames: 3, shots: [3], expect: { consoleErrors: 0 },
};
if (variant === 'old') process.chdir(process.env.BASELINE_ROOT ?? resolve(root, '../l3-all-new-baseline'));
const session = new SceneSession({ backend: 'webgl2', tier, viewport: { width: 1600, height: 900 }, query: { crowdProbe: 'full' } });
const receipts = [];
try {
  await session.open();
  // Current checkpoint fixture; the older qa-l3-army/finale specs predate the
  // eastward compound move. Story evidence below runs the production mission.
  const files = mode === 'checkpoint' ? ['tests/scenes/catalog/l3-army-inner-cover.json'] : [];
  for (const file of files) {
    const spec = readSpec(resolve(file));
    const result = await runSpec(session, spec, { file, out: resolve(out, spec.name!), sheet: Math.max(spec.sheet ?? 60, Math.ceil((spec.frames ?? 180) / 12)) });
    receipts.push({ file, ...result }); writeJson(`${out}/receipts.json`, receipts);
    assert.ok(result.pass, `${spec.name}: ${JSON.stringify(result.failed)}`);
    if (mode === 'checkpoint') {
      await session.page.evaluate(async () => { window.__SCENE__!.setCamera({ mode: 'close', target: 'hmg', radius: 6, azimuth: 45 }); await window.__SCENE__!.ready(); });
      await session.screenshot(resolve(out, spec.name!, 'close.png'));
    }
  }
  if (mode === 'story') {
    await session.page.evaluate(async () => {
      const api = window.__SS__!; await api.loadLevel('L3', { seed: 1 }); api.missions.begin(); api.pause(); api.camera.follow();
      const game = (window.__SCENE__ as unknown as { game: Game }).game, rig = game.view.view;
      rig.zoom(Math.log(1.5 / rig.getState().zoom));
      for (let i = 0; i < 60; i++) rig.update(game.world.entities.get(1)!.transform, 1 / 60);
      await api.screenshotReady();
    });
    const captured = new Set<string>();
    const capture = async (name: string) => {
      const shots = [];
      for (const frame of [0, 30, 60]) {
        if (frame) await session.page.evaluate(async () => { await window.__SS__!.step(30); });
        const file = resolve(out, name, `shot-${String(frame).padStart(4, '0')}.png`);
        await session.screenshot(file);
        const evidence = await session.page.evaluate(() => ({ state: window.__SS__!.getState(), mission: window.__SS__!.missions.state(), perf: window.__SS__!.perf() }));
        shots.push({ frame, file, ...evidence });
      }
      captured.add(name); writeJson(resolve(out, name, 'receipt.json'), { name, tier, zoom: 1.5, backend: 'webgl2', shots, errors: session.errors });
    };
    await capture('l3-station-ready');
    await session.page.evaluate(() => window.__SS__!.bot.start('complete'));
    try {
      for (let i = 0; i < 600 && captured.size < 5; i++) {
        const at = await session.page.evaluate(async () => {
          const api = window.__SS__!; await api.step(60);
          const game = (window.__SCENE__ as unknown as { game: Game }).game, s = game.world.missions!.state.l3!;
          return { x: game.world.entities.get(1)!.transform.x, tick: game.world.tick, attackAt: s.attackAt, fallbackAt: s.fallbackAt };
        });
        if (!captured.has('l3-station-attack') && at.attackAt && at.tick - at.attackAt >= 900) await capture('l3-station-attack');
        if (!captured.has('l3-fallback-squad') && at.fallbackAt) await capture('l3-fallback-squad');
        if (!captured.has('l3-boulevard') && at.x >= 35) await capture('l3-boulevard');
        if (!captured.has('l3-army-arrival') && at.x >= 216) await capture('l3-army-arrival');
      }
      assert.equal(captured.size, 5, `Missing production story beats: ${[...captured]}`);
      writeJson(resolve(out, 'receipt.json'), { tier, beats: [...captured], errors: session.errors });
    } finally { await session.page.evaluate(() => { window.__SS__!.bot.stop(); window.__SS__!.input.clear(); }); }
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
    writeJson(`${out}/receipt.json`, { variant, tier, spec: crowd30, result, metrics, resources, errors: session.errors });
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
        writeJson(`${out}/cadence.json`, { variant, tier, cadence, peakLeases, hostLoad, protocol: 'shared native Metal WebGL2, 60 Hz cap, 120 warm-up frames + 600 sampled frames, live L3 30-figure cast', errors: session.errors });
        assert.equal(peakLeases, 1, 'No competing shared context during cadence sample');
        assert.equal(cadence.over200, 0);
        assert.deepEqual(cadence.builds, [], 'No shader builds after warm-up');
      } finally { clearInterval(monitor); }
    }
  }
  if (mode === 'states') for (const model of ['npc.national-guard']) for (const state of model.endsWith('kid') ? ['healthy'] : ['healthy', 'turned', 'corpse']) {
    const spec: SceneSpec = { name: `${model}-${state}`, ground: 'asphalt', time: 'L3', size: 100,
      actors: [{ id: 'courier', kind: 'courier', at: [40, 40] }, { id: 'figure', kind: 'pedestrian', at: [0, 0], yaw: -45, look: { model, handProp: 'rifle', role: 'soldier', tint: '#4b5a3a' }, state: { ally: { role: 'soldier', weapon: 'rifle' } } }],
      script: [...state !== 'healthy' ? [{ frame: 1, actor: 'figure', do: { infect: { instant: true } } }] : [], ...state === 'corpse' ? [{ frame: 2, actor: 'figure', do: { corpse: true as const } }] : []],
      camera: { mode: 'close', target: [0, .7, 0], radius: 6, azimuth: 45 }, frames: 180, shots: [3, 90, 180], expect: { consoleErrors: 0 } };
    const result = await runSpec(session, spec, { out: resolve(out, spec.name!), sheet: 60 });
    receipts.push({ model, state, ...result }); writeJson(`${out}/receipts.json`, receipts); assert.ok(result.pass, JSON.stringify(result.failed));
  }
  assert.equal(session.errors.length, 0);
} finally { await session.close(); stopServer(); process.chdir(root); }
console.log(JSON.stringify(receipts.map(r => ({ pass: r.pass, files: r.files }))));
