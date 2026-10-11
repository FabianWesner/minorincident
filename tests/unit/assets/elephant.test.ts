import { readFileSync, statSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Box3, Matrix4, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';
import { validateDocument } from '../../../tools/assets/validate';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';

const defs = ['amb.elephant', 'inf.elephant'].map(id => manifest.find(d => d.id === id) as AssetDef);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function load(path: string) {
  const bytes = readFileSync(path);
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}
for (const [lod, limit] of [12000, 4000, 1500].entries()) {
  test(`T-E07-01-elephant-asset-lod${lod} @E07-AC01 @E18-AC01 normal/infected share rig and closed silhouette within budgets`, async () => {
    const models = [];
    for (const def of defs) {
      const path = lod ? def.lods![lod === 1 ? 'lod1' : 'lod2']! : def.glb;
      const doc = await (await assetIO()).read(path);
      const result = validateDocument(doc, def, statSync(path).size, lod);
      expect(result.errors).toEqual([]);
      expect(result.triangles).toBeLessThanOrEqual(limit);
      expect(result.materials).toBeLessThanOrEqual(4);
      expect(result.fileKB).toBeLessThanOrEqual(1000);
      const model = await load(path);
      model.traverse(n => { if (n.name.startsWith('stump_')) n.visible = false; });
      const bounds = new Box3().setFromObject(model);
      expect(bounds.min.y).toBeCloseTo(0, 2);
      expect(bounds.getSize(new Vector3()).y).toBeGreaterThan(2.9);
      const soleHeight = model.getObjectByName('footL')!.getWorldPosition(new Vector3()).y;
      expect(model.getObjectByName('root')!.userData.groundedAnimal).toBe(true);
      const baked = bakeInfected(model, def.animatedNodes);
      expect(baked.clip.matrices.every(Number.isFinite)).toBe(true);
      // Inspect the delivered pose atlas with Scene Lab's rear-foot sole probes.
      for (const clip of ['idle', 'run', 'walk'] as const) for (let frame = 0; frame < framesPerClip; frame++) {
        for (const foot of ['footL', 'footR']) {
          const offset = ((infectedClips.indexOf(clip) * framesPerClip + frame) * baked.clip.parts.length + baked.clip.parts.indexOf(foot)) * 16;
          const pose = new Matrix4().fromArray(baked.clip.matrices, offset);
          for (const x of [-.05, .085]) expect(new Vector3(x, -soleHeight, 0).applyMatrix4(pose).y).toBeGreaterThanOrEqual(-.001);
        }
      }
      for (const joint of ['legFL', 'legFR', 'legBL', 'legBR']) {
        const index = baked.clip.parts.indexOf(joint);
        expect(index).toBeGreaterThanOrEqual(0);
        const offset = infectedClips.indexOf('run') * framesPerClip * baked.clip.parts.length * 16 + index * 16;
        expect(new Matrix4().fromArray(baked.clip.matrices, offset).equals(new Matrix4().fromArray(baked.clip.matrices, offset + 8 * baked.clip.parts.length * 16))).toBe(false);
      }
      const emission = baked.geometry.getAttribute('_emissive');
      expect(Array.from({ length: emission.count }, (_, i) => emission.getX(i)).some(v => v > .5)).toBe(def.id.startsWith('inf.'));
      baked.geometry.dispose();
      models.push(model);
    }
    for (const name of defs[0].animatedNodes) {
      const a = models[0].getObjectByName(name)!, b = models[1].getObjectByName(name)!;
      expect(a.parent?.name, name).toBe(b.parent?.name);
      expect(a.matrixWorld.toArray(), name).toEqual(b.matrixWorld.toArray());
    }
    for (const name of ['body', 'head', 'earL', 'trunk']) {
      const surfaces = models.map(model => {
        const node = model.getObjectByName(name)!;
        return new Box3().setFromObject(node).getSize(new Vector3()).toArray();
      });
      for (let axis = 0; axis < 3; axis++) expect(surfaces[0][axis]).toBeCloseTo(surfaces[1][axis], 2);
    }
  });
}
test('T-E07-01-elephant-derivation @E07-AC01 infected build executes normal base and LODs are authored without collapse', () => {
  expect(readFileSync('assets/inf.elephant/build.py', 'utf8')).toContain("'amb.elephant/build.py'");
  expect(readFileSync('assets/amb.elephant/build.py', 'utf8')).not.toContain("modifiers.new");
  for (const def of defs) for (let lod = 0; lod < 3; lod++) {
    const stats = JSON.parse(readFileSync(`assets/${def.id}/model${lod ? `.lod${lod}` : ''}.stats.json`, 'utf8'));
    expect(stats).toMatchObject({ derivedFrom: 'amb.elephant', decimation: false, infected: def.id.startsWith('inf.') });
  }
});
