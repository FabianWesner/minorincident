/** Q-213: retain the real west-breach pile and identify each frozen draw. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer, writeJson } from './session';

const tier = process.env.REVIEW_TIER === 'low' ? 'low' : 'high';
const backend = process.env.REVIEW_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const variant = process.env.REVIEW_VARIANT ?? 'before';
const out = resolve(`test-results/q212-load/breach-${variant}-${tier}-${backend}`);
const session = new SceneSession({ backend, tier, viewport: { width: 1600, height: 900 }, query: { loadProfile: '2', crowdProbe: 'full' } });
try {
  await session.open();
  await session.page.evaluate(async () => {
    const api = window.__SS__!;
    await api.loadLevel('L4', { seed: 3, checkpoint: 'turn', progression: 'L4-default' });
    api.pause(); api.cheats.god(true); api.teleport('player', { x: -29, z: 4 }); api.camera.follow(); api.camera.zoom(1);
    await api.screenshotReady();
  });
  const warm = await session.page.evaluate(() => ({ builds: window.__SS__!.perf().nodeBuilds, materials: { ...window.__SS__!.perf().nodeBuildMaterials } }));
  await session.page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const renderer = game.view.renderer, before = renderer.debug.onNodeBuilderCreated;
    const late: unknown[] = [];
    (window as unknown as { q212Builds: unknown[] }).q212Builds = late;
    renderer.debug.onNodeBuilderCreated = (builder, object) => {
      before?.(builder, object);
      const draw = object as unknown as { object: import('three').Object3D; material: import('three').Material };
      const ancestry: string[] = []; for (let n: import('three').Object3D | null = draw.object; n; n = n.parent) ancestry.push(`${n.name}:${n.id}`);
      late.push({ ancestry, material: draw.material.name, type: draw.material.type });
    };
    type Binding = { isSampledTexture?: boolean; name: string; texture: import('three').Texture; textureNode?: { value: import('three').Texture } };
    type Draw = { object: import('three').InstancedMesh; getBindings(): { bindings: Binding[] }[] };
    const backend = renderer.backend as unknown as { draw(draw: Draw, info: unknown): void; get(binding: unknown): { textureGPU?: unknown } };
    const draw = backend.draw, sampled = new Map<string, unknown>();
    (window as unknown as { q212Draws: Map<string, unknown> }).q212Draws = sampled;
    backend.draw = function (object, info) {
      if (object.object.name.startsWith('corpses:infected.runner:')) {
        const mesh = object.object, placement = mesh.geometry.getAttribute('_placement0') as import('three').InterleavedBufferAttribute | undefined;
        sampled.set(mesh.uuid, { name: mesh.name, expected: (mesh.userData.preRenderTextures as import('three').Texture[]).map(t => t.id),
          matrixVersion: mesh.instanceMatrix.version, placementVersion: placement?.data.version,
          textures: object.getBindings().flatMap(group => group.bindings.filter(b => b.isSampledTexture).map(b => ({ name: b.name, id: b.texture.id,
            wanted: b.textureNode?.value.id, correctHandle: backend.get(b).textureGPU === backend.get(b.texture).textureGPU,
            size: [(b.texture.image as { width?: number })?.width, (b.texture.image as { height?: number })?.height] }))) });
      }
      draw.call(this, object, info);
    };
  });
  for (const seconds of [60, 120, 180]) {
    await session.page.evaluate(async seconds => {
      const api = window.__SS__!, target = api.missions.state()!.l4!.turnAt + seconds * 60;
      while (api.tick() < target) { api.teleport('player', { x: -29, z: 4 }); await api.step(Math.min(60, target - api.tick())); }
      await api.screenshotReady();
    }, seconds);
    await session.screenshot(`${out}/${seconds}s.png`);
    const state = await session.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const frozen: unknown[] = [];
      const meshes = new Set<import('three').InstancedMesh>(), bodyIds = new Map<string, string>();
      game.view.scene.traverse(node => {
        const pool = node as unknown as { slots?: Map<string, { page: { mesh: import('three').InstancedMesh }; index: number }> };
        if (!(pool.slots instanceof Map)) return;
        for (const [id, { page, index }] of pool.slots) {
          const mesh = page.mesh, matrix = mesh.matrixWorld.clone(); mesh.getMatrixAt(index, matrix);
          if (mesh.visible && mesh.count) meshes.add(mesh); bodyIds.set(`${mesh.uuid}/${index}`, id);
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          const bounds = mesh.geometry.boundingBox;
          const root = game.view.camera.position.clone().setFromMatrixPosition(matrix);
          const projected = root.clone().project(game.view.camera);
          frozen.push({ id, mesh: mesh.name, uuid: mesh.uuid, source: mesh.geometry.userData.corpseSource, index,
            triangles: (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3,
            root: root.toArray(), screen: [(projected.x + 1) * 800, (1 - projected.y) * 450], bounds: bounds ? [bounds.min.toArray(), bounds.max.toArray()] : undefined,
            entity: game.world.entities.get(Number(id)), material: { name: (mesh.material as import('three').Material).name, uuid: (mesh.material as import('three').Material).uuid } });
        }
      });
      const ray = (window.__SCENE__ as unknown as { ray: import('three').Raycaster }).ray;
      ray.near = 0; ray.far = Infinity;
      const picks = [[780, 120], [600, 170], [330, 170], [850, 70], [750, 190]].map(([x, y]) => {
        ray.setFromCamera({ x: x / 800 - 1, y: 1 - y / 450 } as import('three').Vector2, game.view.camera);
        return { pixel: [x, y], hits: ray.intersectObjects([...meshes], false).slice(0, 4).map(h => ({ id: bodyIds.get(`${h.object.uuid}/${h.instanceId}`), mesh: h.object.name, distance: h.distance, uv: h.uv?.toArray() })) };
      });
      return { tick: game.world.tick, frozen, picks, layout: window.__SS__!.debug.corpseLayout(), figures: window.__SS__!.crowdFigures(), perf: window.__SS__!.perf(), draws: [...(window as unknown as { q212Draws: Map<string, unknown> }).q212Draws.values()] };
    });
    writeJson(`${out}/${seconds}s.json`, state);
  }
  const after = await session.page.evaluate(() => ({ builds: window.__SS__!.perf().nodeBuilds, materials: { ...window.__SS__!.perf().nodeBuildMaterials }, late: (window as unknown as { q212Builds: unknown[] }).q212Builds,
    draws: [...(window as unknown as { q212Draws: Map<string, { name: string; expected: number[]; matrixVersion: number; placementVersion: number; textures: { id: number; wanted: number; correctHandle: boolean }[] }> }).q212Draws.values()] }));
  if (process.env.Q212_ISOLATE === '1') {
    await session.page.evaluate(async () => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      game.view.scene.traverse(node => {
        if (!(node as import('three').Mesh).isMesh) return;
        for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
          if (ancestor.name !== 'infected-crowd' && ancestor.name !== 'civilian-crowd') continue;
          if (!node.name.startsWith('corpses:infected.runner:')) node.visible = false;
          break;
        }
      });
      const view = game.view as unknown as { postFx: { render(): void } };
      for (let i = 0; i < 3; i++) { game.view.renderer.nextNodeFrame(); view.postFx.render(); await game.view.renderer.finishWarmUp(); }
    });
    await session.page.screenshot({ path: `${out}/common-worker-only.png` });
  }
  const lateBuilds = after.builds - warm.builds;
  const wrongAtlas = after.draws.filter(d => d.expected.some(id => !d.textures.some(t => t.id === id && t.wanted === id && t.correctHandle)));
  const stalePlacement = after.draws.filter(d => d.matrixVersion !== d.placementVersion);
  writeJson(`${out}/summary.json`, { variant, tier, backend, warm, after, lateBuilds, wrongAtlas, stalePlacement, errors: session.errors });
  assert.deepEqual(session.errors, []);
  if (variant === 'after') { assert.equal(lateBuilds, 0); assert.deepEqual(wrongAtlas, []); assert.deepEqual(stalePlacement, []); }
  console.log(JSON.stringify({ variant, tier, backend, out, lateBuilds }));
} finally { await session.close(); stopServer(); }
