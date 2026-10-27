/** Native 120/400 px old/new figures through the game's lighting and camera. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AssetDef } from '../../src/assets/types';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer, writeJson } from './session';

const out = resolve(process.env.L1_REVIEW_RAW ?? 'test-results/l1-all-new/figures');
mkdirSync(out, { recursive: true });
const current = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
const old = JSON.parse(execFileSync('git', ['show', `${process.env.REVIEW_BASE ?? '0009f107d'}:src/assets/manifest.json`], { encoding: 'utf8' })) as AssetDef[];
const ids = (process.env.FIGURES ?? 'npc.depot-clerk').split(',');
const tier = process.env.REVIEW_TIER === 'low' ? 'low' : 'high';
const backend = process.env.REVIEW_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const skinTone = process.env.REVIEW_SKIN_TONE === undefined ? undefined : Number(process.env.REVIEW_SKIN_TONE);
if (skinTone !== undefined && (!Number.isInteger(skinTone) || skinTone < 0 || skinTone > 5)) throw Error('REVIEW_SKIN_TONE must be 0–5');
const session = new SceneSession({ backend, tier, viewport: { width: 800, height: 600 } });
const receipts: unknown[] = [];
try {
  await session.open();
  await session.page.addInitScript("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
  await session.page.evaluate("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
  await session.load({ name: 'figure-review', ground: 'asphalt', time: process.env.REVIEW_TIME === 'L3' ? 'L3' : process.env.REVIEW_TIME === 'L2' ? 'L2' : 'L1', size: 100, actors: [{ id: 'courier', kind: 'courier', at: [40, 40] }], camera: { mode: 'pose', position: [7, 6, 7], target: [0, .8, 0] } });
  const actual = await session.page.evaluate(() => window.__SS__!.getState().render);
  if (actual.backend !== (backend === 'webgl2' ? 'webgl' : 'webgpu') || actual.quality !== tier) throw Error(`Review renderer mismatch: requested ${backend}/${tier}, got ${actual.backend}/${actual.quality}`);
  for (const id of ids) for (const variant of ['old', 'new']) for (const pixels of [120, 400]) for (const yaw of [-45, 135]) {
    const coat = id.match(/\.(black|cream)$/)?.[1], base = coat ? id.replace(/\.(black|cream)$/, '') : id;
    const def = structuredClone((variant === 'old' ? old : current).find(d => d.id === base)!);
    if (tier === 'low' && def.crowdSkin) {
      const lowPath = (path: string) => { const low = path.replace(/\.glb$/, '.low.glb'); return existsSync(low) ? low : path; };
      def.glb = lowPath(def.glb!);
      if (def.lods) for (const lod of ['lod1', 'lod2'] as const) if (def.lods[lod]) def.lods[lod] = lowPath(def.lods[lod]!);
    }
    const framing = await session.page.evaluate(async ({ def, pixels, yaw, moving, coat, clip, skinTone }) => {
      const modulePath = '/src/assets/registry.ts', threePath = '/node_modules/three/build/three.webgpu.js';
      const reviewMaterialPath = '/tools/scenelab/l1-all-new-review-material.ts';
      const { AssetRegistry } = await import(modulePath), { Box3, Vector3 } = await import(threePath), { reviewEyeMaterial, reviewSkinTone } = await import(reviewMaterialPath);
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const view = game.view as unknown as { scene: import('three').Scene; camera: import('three').PerspectiveCamera; renderer: import('three/webgpu').WebGPURenderer; materials: import('../../src/render/Materials').Materials };
      const state = window as unknown as { reviewRoot?: import('three').Object3D; reviewRegistry?: import('../../src/assets/registry').AssetRegistry };
      state.reviewRoot?.traverse(node => {
        if (!(node as import('three').Mesh).isMesh) return;
        const materials = (node as import('three').Mesh).material;
        for (const material of Array.isArray(materials) ? materials : [materials]) if (material.userData.reviewEyeMask) material.dispose();
      });
      state.reviewRoot?.removeFromParent(); await state.reviewRegistry?.dispose();
      const registry = state.reviewRegistry = new AssetRegistry((event: unknown) => { throw Error(JSON.stringify(event)); }, { renderer: view.renderer, materials: view.materials, manifest: [def] });
      const root = state.reviewRoot = await registry.loadAsset(def.id, pixels === 120 ? 'lod1' : 'lod0', coat) as import('three').Object3D;
      // Match CrowdView/CivilianMaterial: healthy figures hide the infection
      // emitters; infected eye quads are circular discs in the game shader.
      root.traverse(node => {
        const mesh = node as import('three').Mesh;
        if (!mesh.isMesh || !mesh.userData.crowdEye) return;
        mesh.visible = def.id.startsWith('inf.');
        if (!mesh.visible) return;
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(reviewEyeMaterial) : reviewEyeMaterial(mesh.material);
      });
      if (def.crowdSkin && skinTone !== undefined) reviewSkinTone(root, skinTone, view.materials);
      if (def.id.startsWith('npc.')) {
        const box = new Box3().setFromObject(root.getObjectByName('skin_body') ?? root); root.scale.multiplyScalar(1.8 / (box.max.y - box.min.y));
      }
      root.rotation.y = yaw * Math.PI / 180;
      if (moving && def.id.startsWith('npc.')) {
        const modulePath = '/src/render/characters/NpcAnimator.ts', { NpcAnimator } = await import(modulePath);
        new NpcAnimator(root).update(.3, 3.2, .96, false);
      }
      if (clip && def.id.startsWith('npc.')) {
        const path = '/src/render/characters/clips.ts', { sampleClip, authoredClips } = await import(path);
        sampleClip(root, clip, authoredClips.get(clip).duration * .5);
      }
      root.traverse(node => { if ('isMesh' in node) { node.castShadow = node.receiveShadow = true; } });
      view.scene.add(root); root.updateMatrixWorld(true);
      const box = new Box3().setFromObject(root.getObjectByName('skin_body') ?? root), center = box.getCenter(new Vector3());
      let distance = 8, bounds = [0, 0, 0, 0];
      for (let iteration = 0; iteration < 8; iteration++) {
        const polar = Math.PI * .30, position = center.clone().add(new Vector3(Math.sin(polar) / Math.SQRT2, Math.cos(polar), Math.sin(polar) / Math.SQRT2).multiplyScalar(distance));
        window.__SCENE__!.setCamera({ mode: 'pose', position: position.toArray(), target: center.toArray() }); await window.__SCENE__!.ready();
        const xs: number[] = [], ys: number[] = [];
        root.traverse(node => {
          const mesh = node as import('three').Mesh; if (!mesh.isMesh || !mesh.visible) return;
          for (let p = mesh.parent; p; p = p.parent) if (!p.visible) return;
          const positions = mesh.geometry.getAttribute('position'), point = new Vector3();
          for (let i = 0; i < positions.count; i++) { mesh.getVertexPosition(i, point); point.applyMatrix4(mesh.matrixWorld).project(view.camera); xs.push((point.x + 1) * 400); ys.push((1 - point.y) * 300); }
        });
        bounds = [xs.reduce((a, b) => Math.min(a, b), Infinity), ys.reduce((a, b) => Math.min(a, b), Infinity), xs.reduce((a, b) => Math.max(a, b), -Infinity), ys.reduce((a, b) => Math.max(a, b), -Infinity)];
        distance *= (bounds[3] - bounds[1]) / pixels;
      }
      return { bounds, targetPixels: pixels, actualPixels: bounds[3] - bounds[1], yaw, lod: pixels === 120 ? 'lod1' : 'lod0' };
    }, { def, pixels, yaw, moving: process.env.POSE === 'run', coat, clip: process.env.CLIP, skinTone });
    const file = resolve(out, `${id}-${variant}-${pixels}-${yaw}.png`);
    await session.screenshot(file); receipts.push({ id, variant, tier, backend, actualBackend: actual.backend, skinTone, file, ...framing });
    writeJson(resolve(out, 'receipts.json'), receipts);
    writeJson(resolve(out, `${id}-receipts.json`), receipts.filter(r => (r as { id: string }).id === id));
  }
  if (session.errors.length) throw Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
