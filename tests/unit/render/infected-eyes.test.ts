import { Vector3, type BufferGeometry } from 'three';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { expect, test } from 'vitest';
import { regularInfectedModels } from '../../../src/data/crowdAppearance';
import { bakeInfected } from '../../../src/render/characters/bakeInfected';
import { markInfectedEyeCores } from '../../../src/render/characters/infectedEyes';
import { simplifyCrowdLod } from '../../../src/render/characters/crowdLodGeometry';

function surfaceAreas(geometry: BufferGeometry): Map<number, number> {
  const position = geometry.getAttribute('position'), parts = geometry.getAttribute('_part_index'), indices = geometry.index!;
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), areas = new Map<number, number>();
  for (let i = 0; i < indices.count; i += 3) {
    const vertex = indices.getX(i), part = parts.getX(vertex);
    a.fromBufferAttribute(position, vertex); b.fromBufferAttribute(position, indices.getX(i + 1)).sub(a); c.fromBufferAttribute(position, indices.getX(i + 2)).sub(a);
    areas.set(part, (areas.get(part) ?? 0) + b.cross(c).length() / 2);
  }
  return areas;
}

for (const model of regularInfectedModels) for (const lod of ['lod1', 'lod2']) test(`@E25 @E25-AC13 ${model} ${lod}: body surfaces and red eye cores survive the low bake`, async () => {
  const file = readFileSync(`public/assets/models/${model}.${lod}.glb`);
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  const baked = bakeInfected(scene); deinterleaveGeometry(baked.geometry);
  const geometry = mergeVertices(baked.geometry); baked.geometry.dispose();
  const emissive = geometry.getAttribute('_emissive'), skin = geometry.getAttribute('_shirt'), position = geometry.getAttribute('position');
  const original = Array.from({ length: emissive.count }, (_, i) => emissive.getX(i));
  markInfectedEyeCores(geometry);
  const cores = original.flatMap((value, i) => !value && emissive.getX(i) > .5 ? [i] : []);
  expect(cores.length).toBeGreaterThan(0);
  for (const i of cores) expect(skin.getX(i)).toBe(0);
  // White teeth below the glowing eye envelope must not become emitters.
  const lowestEye = Math.min(...original.flatMap((value, i) => value ? [position.getY(i)] : []));
  for (let i = 0; i < emissive.count; i++) if (skin.getX(i) === -1 || position.getY(i) < lowestEye - .004) expect(emissive.getX(i)).toBe(original[i]);
  if (lod === 'lod2') {
    const before = surfaceAreas(geometry);
    await simplifyCrowdLod(geometry, .025, .2, true);
    const after = surfaceAreas(geometry);
    for (const name of ['torso', 'armL', 'armR', 'foreArmL', 'foreArmR', 'handL', 'handR', 'legL', 'legR', 'shinL', 'shinR']) {
      const part = baked.clip.parts.indexOf(name);
      expect((after.get(part) ?? 0) / before.get(part)!, `${model} ${name} surface retention`).toBeGreaterThanOrEqual(.85);
    }
    const retained = new Set(Array.from(geometry.index!.array));
    for (const i of cores) expect(retained.has(i)).toBe(true);
  }
  geometry.dispose();
});
