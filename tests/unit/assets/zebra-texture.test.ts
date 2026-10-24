import { statSync } from 'node:fs';
import { expect, test } from 'vitest';
import { DataTexture, Mesh, MeshBasicMaterial, Matrix4, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';
import { geometryHash, validateDocument } from '../../../tools/assets/validate';
import { bakeInfected, infectedClips, framesPerClip } from '../../../src/render/characters/bakeInfected';
import { packCrowdParts } from '../../../src/assets/crowd';
import { interleaveTexturedCrowd } from '../../../src/render/characters/crowdTexture';
import { crowdVertexLayout } from '../../../src/render/characters/CrowdAppearance';

const defs = ['amb.zebra', 'inf.zebra'].map(id => manifest.find(a => a.id === id)! as AssetDef);
for (const [lod, budget] of [6000, 2000, 700].entries()) test(`textured zebra LOD${lod}: delivered budgets, UVs, exact old rig/actions and grounded production atlas @E07-AC01 @E07-AC19 @E18-AC01`, async () => {
  const io = await assetIO(), hashes: string[] = [];
  for (const def of defs) {
    const base = await io.read('tests/fixtures/zebra-production-rig.glb');
    const source = await io.read(`assets/${def.id}/model${lod ? `.lod${lod}` : ''}.glb`);
    for (const name of def.requiredNodes) {
      const old = base.getRoot().listNodes().find(n => n.getName() === name)!;
      const current = source.getRoot().listNodes().find(n => n.getName() === name)!;
      expect(current.getMatrix(), `${name} production pivot`).toEqual(old.getMatrix());
    }
    const actions = (document: typeof source) => document.getRoot().listAnimations().map(a => [a.getName(), a.listChannels().map(c => [c.getTargetNode()!.getName(), c.getTargetPath(), Array.from(c.getSampler()!.getInput()!.getArray()!), Array.from(c.getSampler()!.getOutput()!.getArray()!)])]);
    expect(actions(source)).toEqual(actions(base));
    for (const size of [1024, 512]) {
      const path = `public/assets/models/${def.id}${lod ? `.lod${lod}` : ''}${size === 512 ? '.low' : ''}.glb`;
      const document = await io.read(path), validation = validateDocument(document, def, statSync(path).size, lod, source);
      expect(validation.errors).toEqual([]); expect(validation.triangles).toBeLessThanOrEqual(budget);
      expect(validation.drawCalls).toBeLessThanOrEqual(35); // Frozen production rig has 35 owner/material draws at every tier.
      expect(document.getRoot().listTextures().map(t => t.getSize())).toEqual([[size, size]]);
      for (const mesh of document.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
        if (p.getMaterial()?.getBaseColorTexture()) expect(p.getAttribute('TEXCOORD_0')?.getCount()).toBe(p.getAttribute('POSITION')!.getCount());
      }
      if (size === 1024) hashes.push(geometryHash(document));
    }
    // Load the actual delivered rig in Node without an image decoder. The GLB
    // texture itself was checked above; a DataTexture restores its binding for
    // the same browser bake, including UV mask and all original motion samples.
    const delivered = await io.read(lod ? def.lods![lod === 1 ? 'lod1' : 'lod2']! : def.glb);
    const mapped = new Set(delivered.getRoot().listMaterials().filter(m => m.getBaseColorTexture()).map(m => m.getName()));
    delivered.getRoot().listTextures().forEach(t => t.dispose());
    const binary = await io.writeBinary(delivered);
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength), '');
    gltf.scene.animations = gltf.animations; gltf.scene.userData.assetTextureMode = 'baseColor';
    gltf.scene.traverse(n => { if (n instanceof Mesh) for (const m of Array.isArray(n.material) ? n.material : [n.material]) if (mapped.has(m.name)) (m as MeshBasicMaterial).map = new DataTexture(new Uint8Array(4), 1, 1); });
    const baked = bakeInfected(gltf.scene, def.animatedNodes, false, undefined, undefined, true);
    expect(baked.geometry.hasAttribute('uv')).toBe(true); expect(baked.clip.matrices.every(Number.isFinite)).toBe(true);
    const width = baked.clip.parts.length * 16, matrix = new Matrix4(), point = new Vector3();
    const paws = ['pawFL', 'pawFR', 'pawBL', 'pawBR'].flatMap(name => {
      const joint = gltf.scene.getObjectByName(name)!, result: { part: number; point: Vector3 }[] = [];
      joint.traverse(n => { if (n instanceof Mesh) { const p = n.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) result.push({ part: baked.clip.parts.indexOf(name), point: joint.worldToLocal(new Vector3().fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)) }); } }); return result;
    });
    for (const clip of ['walk', 'run', 'shamble', 'infected-frail', 'infected-lurch', 'infected-sprint', 'dog-gallop', 'zebra-stampede'] as const) for (let f = 0; f < framesPerClip; f++) {
      const offset = (infectedClips.indexOf(clip) * framesPerClip + f) * width;
      expect(Math.min(...paws.map(p => point.copy(p.point).applyMatrix4(matrix.fromArray(baked.clip.matrices, offset + p.part * 16)).y)), `${clip} ${f} grounded hooves`).toBeGreaterThanOrEqual(-.001);
    }
    packCrowdParts(baked.geometry); interleaveTexturedCrowd(baked.geometry);
    const layout = crowdVertexLayout(baked.geometry, new (await import('three')).InstancedBufferAttribute(new Float32Array(16), 16));
    expect(layout.webgpu).toBe(true); expect(layout.webgl2).toBe(true); baked.geometry.dispose();
  }
  expect(hashes[0], 'healthy/infected share every surface and part').toBe(hashes[1]);
});
