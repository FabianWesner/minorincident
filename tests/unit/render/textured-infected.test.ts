import { readFileSync } from 'node:fs';
import { Color, InstancedMesh, Matrix4, Mesh, MeshLambertNodeMaterial, Texture, Vector3 } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import { bakeInfected, framesPerClip } from '../../../src/render/characters/bakeInfected';
import { packCrowdParts } from '../../../src/assets/crowd';
import { StaticCorpses } from '../../../src/render/characters/StaticCorpses';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { stripGlbTextures } from '../helpers/stripGlbTextures';

test('textured suit retains UVs, centimetre caps, joint poses and frozen corpse texels across all LODs @E07 @E17', async () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const clips = ['idle', 'walk', 'infected-run', 'swing', 'death-back'] as const;
  let bytes = 0;
  for (const [lod, budget] of [6000, 2500, 900].entries()) {
    const file = readFileSync(`assets/inf.common-worker/model${lod ? `.lod${lod}` : ''}.glb`); bytes += file.length;
    const root = (await loader.parseAsync(stripGlbTextures(file), '')).scene;
    const atlas = new Texture();
    root.traverse(node => { if (node instanceof Mesh && node.name.startsWith('suit_')) (node.material as MeshLambertNodeMaterial).map = atlas; });
    root.updateMatrixWorld(true);
    for (const name of ['head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'legL', 'legR']) {
      const cap = root.getObjectByName(`stump_${name}`) as Mesh;
      expect(cap.userData.hidden).toBe(true);
      cap.geometry.computeBoundingBox();
      const size = cap.geometry.boundingBox!.getSize(new Vector3()).multiply(cap.scale);
      expect(Math.max(size.x, size.y, size.z)).toBeLessThan(.08);
    }
    const baked = bakeInfected(root, [], false, clips, undefined, true, true);
    expect(baked.texture).toBe(atlas);
    const p = baked.geometry.getAttribute('position'), uv = baked.geometry.getAttribute('uv'), part = baked.geometry.getAttribute('_part_index');
    expect(uv.count).toBe(p.count); expect(baked.geometry.index!.count / 3).toBeLessThanOrEqual(budget);
    const point = new Vector3(), matrix = new Matrix4();
    for (let c = 0; c < clips.length; c++) for (let f = 0; f < framesPerClip; f++) {
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < p.count; i++) {
        point.fromBufferAttribute(p, i).applyMatrix4(matrix.fromArray(baked.clip.matrices, ((c * framesPerClip + f) * baked.clip.parts.length + part.getX(i)) * 16));
        min = Math.min(min, point.y); max = Math.max(max, point.y);
      }
      expect(min, `${lod}/${clips[c]}/${f}: ground penetration`).toBeGreaterThan(-.05);
      expect(max, `${lod}/${clips[c]}/${f}: inflated geometry`).toBeLessThan(1.95);
    }
    packCrowdParts(baked.geometry);
    const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
    const frame = clips.indexOf('death-back') * framesPerClip + framesPerClip - 1;
    pool.place({ id: 3, corpse: true } as EntitySnapshot, 'suit', baked.geometry, material, baked.clip, frame, new Matrix4(), new Color('white'), [0, 0, 0]);
    const frozen = (pool.children[0] as InstancedMesh).geometry.getAttribute('uv');
    expect(frozen.count).toBe(uv.count);
    for (let i = 0; i < uv.count; i++) { expect(frozen.getX(i)).toBe(uv.getX(i)); expect(frozen.getY(i)).toBe(uv.getY(i)); }
    pool.dispose(); baked.geometry.dispose(); material.dispose(); atlas.dispose();
  }
  expect(bytes).toBeLessThanOrEqual(600_000);
});
