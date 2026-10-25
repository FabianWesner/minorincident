import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { stripGlbTextures } from '../helpers/stripGlbTextures';
import { afterEach, expect, test, vi } from 'vitest';
import { DataTexture, Mesh, MeshBasicMaterial, Matrix4, Color, Float32BufferAttribute, Scene, type Material } from 'three';
import { MeshLambertNodeMaterial, InstancedMesh } from 'three/webgpu';
import { Materials } from '../../../src/render/Materials';
import { Lighting } from '../../../src/render/Lighting';
import { AssetRegistry } from '../../../src/assets/registry';
import type { AssetDef } from '../../../src/assets/types';
import { createInfectedPlaceholder } from '../../../src/render/characters/infectedPlaceholder';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';
import { packCrowdParts } from '../../../src/assets/crowd';
import { crowdTexture, interleaveTexturedCrowd } from '../../../src/render/characters/crowdTexture';
import { StaticCorpses } from '../../../src/render/characters/StaticCorpses';
import { crowdVertexLayout } from '../../../src/render/characters/CrowdAppearance';
import type { EntitySnapshot } from '../../../src/sim/world/types';

afterEach(() => vi.unstubAllGlobals());
test('@E07 atlas materials and the owning registry release a shared map and its cached material once', async () => {
  const atlas = new DataTexture(new Uint8Array(16), 2, 2); atlas.generateMipmaps = true;
  const dispose = vi.spyOn(atlas, 'dispose');
  const root = createInfectedPlaceholder('runner');
  root.traverse(node => { if (node instanceof Mesh) node.material = new MeshBasicMaterial({ map: atlas }); });
  const def = { id: 'inf.test-tex', textureMode: 'baseColor', status: 'integrated', glb: 'public/test.glb', requiredNodes: [], animatedNodes: [], sockets: [], decayVariants: [] } as unknown as AssetDef;
  const lighting = new Lighting(new Scene()), shading = new Materials(lighting);
  const registry = new AssetRegistry(() => {}, { manifest: [def], load: async () => root, materials: shading });
  const first = await registry.loadAsset(def.id), second = await registry.loadAsset(def.id);
  expect(crowdTexture(first)).toBe(atlas); expect(crowdTexture(second)).toBe(atlas);
  const materials: unknown[] = []; first.traverse(n => { if (n instanceof Mesh) materials.push(n.material); });
  expect(new Set(materials).size).toBe(1);
  expect(registry.textureMemory()).toEqual({ count: 1, decodedBytes: 20 });
  const material = materials[0] as Material, released = vi.spyOn(material, 'dispose');
  await registry.dispose(); expect(dispose).toHaveBeenCalledTimes(1); expect(released).toHaveBeenCalledTimes(1);
  expect([...shading['cache'].values()]).not.toContain(material);
  shading.dispose(); expect(released).toHaveBeenCalledTimes(1); lighting.dispose();
});

test('@E07 UVs and texture masks survive the production crowd bake and frozen corpse page within backend limits', () => {
  const root = createInfectedPlaceholder('runner');
  let assigned = false;
  root.traverse(n => {
    if (!(n instanceof Mesh) || assigned) return;
    const count = n.geometry.getAttribute('position').count, uv = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) uv.set([.25, .75], i * 2);
    n.geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    (n.material as MeshBasicMaterial).map = new DataTexture(new Uint8Array(4), 1, 1); assigned = true;
  });
  const baked = bakeInfected(root, [], false, undefined, undefined, true, true);
  const uv = baked.geometry.getAttribute('uv');
  const masks = baked.geometry.getAttribute('_shirt');
  expect(Array.from({ length: masks.count }, (_, i) => masks.getX(i))).toContain(-10);
  expect(Array.from({ length: masks.count }, (_, i) => masks.getX(i)).some(v => v >= 0)).toBe(true);
  const expected = Array.from({ length: uv.count * 2 }, (_, i) => uv.getComponent(Math.floor(i / 2), i % 2));
  packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  const frame = infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;
  pool.prepare('textured', baked.geometry, material, baked.clip, frame);
  pool.place({ id: 9 } as EntitySnapshot, 'textured', baked.geometry, material, baked.clip, frame, new Matrix4(), new Color(1, 1, 1), [0, 0, 0]);
  const page = pool.children[0] as InstancedMesh, frozen = page.geometry.getAttribute('uv');
  expect(Array.from({ length: frozen.count * 2 }, (_, i) => frozen.getComponent(Math.floor(i / 2), i % 2))).toEqual(expected);
  const layout = crowdVertexLayout(page.geometry, page.instanceMatrix);
  expect(layout.webgpu).toBe(true); expect(layout.webgl2).toBe(true);
  interleaveTexturedCrowd(baked.geometry);
  expect(crowdVertexLayout(baked.geometry, page.instanceMatrix).buffers).toBeLessThanOrEqual(8);
  pool.dispose(); baked.geometry.dispose(); material.dispose();
});

// Adding the suit atlas must preserve the zebra's authored eye emitters.
test.each(['amb.zebra', 'inf.zebra'])('@E07 @E17 %s keeps its authored emission when UVs are retained', async id => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const emission: number[][] = [];
  for (const preserveUV of [false, true]) {
    const root = (await loader.parseAsync(stripGlbTextures(readFileSync(`public/assets/models/${id}.lod2.glb`)), '')).scene;
    root.traverse(node => { delete node.userData.crowdAtlas; delete node.userData.assetTextureMode; });
    const baked = bakeInfected(root, [], false, ['idle'], undefined, true, preserveUV);
    const flags = baked.geometry.getAttribute('_emissive');
    emission.push(Array.from({ length: flags.count }, (_, i) => flags.getX(i)));
    baked.geometry.dispose();
  }
  expect(emission[1]).toEqual(emission[0]);
});
