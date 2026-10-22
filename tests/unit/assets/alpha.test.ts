import { readFileSync, statSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Box3, Matrix4, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';
import { validateDocument } from '../../../tools/assets/validate';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';
import { simplifyCrowdLod } from '../../../src/render/characters/crowdLodGeometry';
import { l4Anchors, l4Line } from '../../../src/data/l4';

const def = manifest.find(a => a.id === 'inf.alpha') as AssetDef;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function load(path: string) {
  const bytes = readFileSync(path);
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}
for (const [lod, budget] of [8000, 3000, 1000].entries()) {
  test(`T-E07-01-alpha-asset-lod${lod} @E07-AC01 @E18-AC01 derived Alpha validates budgets and shared crowd animation`, async () => {
    const path = lod === 0 ? def.glb : def.lods![lod === 1 ? 'lod1' : 'lod2']!;
    const io = await assetIO(), doc = await io.read(path);
    const validation = validateDocument(doc, def, statSync(path).size, lod);
    expect(validation.errors).toEqual([]);
    expect(validation.triangles).toBeLessThanOrEqual(budget);
    expect(validation.materials).toBeLessThanOrEqual(def.budget.materials);
    expect(validation.fileKB).toBeLessThanOrEqual(800);
    const alpha = await load(path), worker = await load(`public/assets/models/inf.common-worker${lod ? `.lod${lod}` : ''}.glb`);
    const bounds = (root: typeof alpha) => {
      root.traverse(node => { if (node.name.startsWith('stump_')) node.visible = false; });
      return new Box3().setFromObject(root).getSize(new Vector3());
    };
    const a = bounds(alpha), b = bounds(worker);
    expect(a.y / b.y).toBeGreaterThanOrEqual(1.35);
    expect(a.y / b.y).toBeLessThanOrEqual(1.5);
    expect(a.x / b.x).toBeGreaterThan(a.y / b.y);
    expect(a.z / b.z).toBeGreaterThan(a.y / b.y);
    for (const name of def.animatedNodes) {
      const joint = alpha.getObjectByName(name)!;
      expect(joint).toBeTruthy();
      expect(joint.scale.toArray()).toEqual([1, 1, 1]);
      expect(joint.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    }
    const baked = bakeInfected(alpha, def.animatedNodes);
    expect(baked.clip.matrices.every(Number.isFinite)).toBe(true);
    for (const clip of ['run', 'swing', 'knockdown', 'get-up']) {
      const offset = infectedClips.indexOf(clip as typeof infectedClips[number]) * framesPerClip * baked.clip.parts.length * 16;
      const foot = baked.clip.parts.indexOf(clip === 'swing' ? 'handR' : 'footL') * 16;
      const first = new Matrix4().fromArray(baked.clip.matrices, offset + foot);
      const later = new Matrix4().fromArray(baked.clip.matrices, offset + foot + 8 * baked.clip.parts.length * 16);
      expect(later.equals(first), clip).toBe(false);
    }
    deinterleaveGeometry(baked.geometry);
    const indexed = mergeVertices(baked.geometry); baked.geometry.dispose();
    const emissive = indexed.getAttribute('_emissive');
    expect(Array.from(indexed.index!.array).some(i => emissive.getX(i) > .5)).toBe(true);
    if (lod === 2) {
      const eyes = new Set(Array.from(indexed.index!.array).filter(i => emissive.getX(i) > .5));
      await simplifyCrowdLod(indexed);
      const retained = new Set(Array.from(indexed.index!.array));
      for (const eye of eyes) expect(retained.has(eye)).toBe(true);
      expect(indexed.index!.count / 3).toBeLessThanOrEqual(budget);
    }
    const parts = indexed.getAttribute('_part_index');
    for (let i = 0; i < indexed.index!.count; i += 3) {
      expect(parts.getX(indexed.index!.getX(i))).toBe(parts.getX(indexed.index!.getX(i + 1)));
      expect(parts.getX(indexed.index!.getX(i))).toBe(parts.getX(indexed.index!.getX(i + 2)));
    }
    indexed.dispose();
  });
}
test('T-E07-19-alpha-line-asset @E07-AC19 fixture reuses the real Fairhaven anchors and crowd model override', () => {
  const spec = JSON.parse(readFileSync('tests/scenes/alpha-asset/fair-line.json', 'utf8'));
  expect(spec.layout).toMatchObject({ district: 'D-FAIR', level: 'L4' });
  for (const name of spec.layout.anchors) expect(l4Anchors[name]).toBeTruthy();
  expect(spec.actors.find((a: { id: string }) => a.id === 'alpha').look.model).toBe(def.id);
  const slot = spec.barricadeSlots[0];
  expect(slot.initialHp).toBe(300);
  expect(l4Line.some(p => Math.abs(p.x - (slot.a.x + slot.b.x) / 2) < .01 && p.z === slot.a.z)).toBe(true);
  expect(readFileSync(def.script!, 'utf8')).toContain("'inf.common-worker/build.py'");
});
