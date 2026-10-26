import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { Box3, Mesh, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from '../../../src/assets/manifest.json';
import { stripGlbTextures } from '../helpers/stripGlbTextures';
import { CorgiTongue } from '../../../src/render/characters/CorgiTongue';
import { PawContacts } from '../../../src/render/characters/PawContacts';
import { QuadrupedAnimator } from '../../../src/render/characters/QuadrupedAnimator';
import { variantPath } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';

async function load(path: string) {
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripGlbTextures(readFileSync(path)), '')).scene;
}
const corgi = manifest.find(d => d.id === 'char.corgi')!;
for (const lod of ['lod0', 'lod1', 'lod2'] as const) test(`L1 corgi ${lod}: old detailed backpack is still rigid on its original socket @E08 @E17`, async () => {
  const before = await load(`assets/char.corgi/model${lod === 'lod0' ? '' : '.' + lod}.glb`);
  const after = await load((lod === 'lod0' ? corgi.glb : corgi.lods![lod])!);
  before.updateMatrixWorld(true); after.updateMatrixWorld(true);
  const oldPack = before.getObjectByName('packSocket')!, pack = after.getObjectByName('packSocket')!;
  const a = new Box3().setFromObject(oldPack), b = new Box3().setFromObject(pack);
  expect(a.min.distanceTo(b.min)).toBeLessThan(1e-5); expect(a.max.distanceTo(b.max)).toBeLessThan(1e-5);
  const names: string[] = [];
  pack.traverse(n => { if (n instanceof Mesh) { expect(n).not.toBeInstanceOf(SkinnedMesh); names.push(...(Array.isArray(n.material) ? n.material : [n.material]).map(m => m.name)); } });
  expect(names).toContain('pal_backpackTeal'); expect(names).toContain('pal_survivorRed'); expect(names).toContain('pal_picketWhite');
});

test('L1 corgi: welded tongue retracts at rest and pants after a run @E08', async () => {
  const root = await load(corgi.lods!.lod1), tongue = new CorgiTongue(root), body = root.getObjectByName('skin_body') as SkinnedMesh;
  expect(tongue.found).toBe(true);
  const joint = body.skeleton.bones.findIndex(n => n.name === 'tongue'), weights = body.geometry.getAttribute('skinWeight'), indices = body.geometry.getAttribute('skinIndex');
  const vertices: number[] = [];
  for (let i = 0; i < indices.count; i++) for (let k = 0; k < 4; k++) if (indices.getComponent(i, k) === joint && weights.getComponent(i, k) > .5) { vertices.push(i); break; }
  expect(vertices.length).toBeGreaterThan(4);
  const front = () => { root.updateMatrixWorld(true); return Math.max(...vertices.map(i => body.getVertexPosition(i, new Vector3()).x)); };
  tongue.update(0, 0); const retracted = front();
  for (let frame = 1; frame < 120; frame++) tongue.update(frame / 60, 4);
  expect(tongue.out).toBeGreaterThan(.99); expect(front() - retracted).toBeGreaterThan(.025);
  for (let frame = 120; frame < 600; frame++) tongue.update(frame / 60, 0);
  expect(tongue.out).toBeLessThan(.01); expect(front()).toBeCloseTo(retracted, 3);
});

test('L1 corgi: all four weighted paws participate in standing, walking, trotting and sitting contacts @E08', async () => {
  const root = await load(corgi.lods!.lod1), body = root.getObjectByName('skin_body') as SkinnedMesh;
  const contacts = new PawContacts(root), animator = new QuadrupedAnimator(root), point = new Vector3();
  expect(contacts.points()).toHaveLength(4);
  let distance = 0, lowest = Infinity;
  for (let frame = 0; frame < 780; frame++) {
    const speed = frame < 60 || frame >= 420 ? 0 : frame < 180 ? 1.4 : frame < 300 ? 3.8 : 7;
    distance += speed / 60; animator.update(frame / 60, speed, distance); root.updateMatrixWorld(true);
    if (frame % 6) continue;
    for (let i = 0; i < body.geometry.getAttribute('position').count; i++) lowest = Math.min(lowest, body.getVertexPosition(i, point).applyMatrix4(body.matrixWorld).y);
  }
  expect(lowest).toBeGreaterThanOrEqual(-.02);
});

test('all six L1 dog appearances retain one body, rig, UV layout and world scale at every LOD @E08 @E17', async () => {
  for (const lod of ['lod0', 'lod1', 'lod2'] as const) {
    let canonical: string | undefined;
    for (const id of ['amb.dog', 'inf.dog']) for (const coat of [undefined, 'black', 'cream']) {
      const def = manifest.find(d => d.id === id)!;
      const root = await load(variantPath((lod === 'lod0' ? def.glb : def.lods![lod])!, coat));
      const body = root.getObjectByName('skin_body') as SkinnedMesh, hash = createHash('sha256');
      const rows: string[] = [];
      for (let i = 0; i < body.geometry.getAttribute('position').count; i++) rows.push(['position', 'uv', 'skinIndex', 'skinWeight'].flatMap(name => {
        const attribute = body.geometry.getAttribute(name);
        return Array.from({ length: attribute.itemSize }, (_, k) => Math.round(attribute.getComponent(i, k) * 1e6));
      }).join(','));
      hash.update(rows.sort().join('\n')); hash.update(body.skeleton.bones.map(b => b.name).join(','));
      const actual = hash.digest('hex'); canonical ??= actual;
      expect(actual, `${id}.${coat ?? 'brown'}/${lod}`).toBe(canonical);
    }
  }
});

test('all L1 compressed deliveries have WebGPU-valid 4x4 texture extents @E17', async () => {
  const io = await assetIO();
  for (const id of ['amb.dog', 'inf.dog', 'char.corgi', 'npc.civilian-elderly', 'npc.depot-clerk', 'npc.lab-tech-a', 'npc.lab-tech-b', 'npc.lab-guard', 'npc.firefighter-alive']) {
    const def = manifest.find(d => d.id === id)!;
    for (const lod of ['lod0', 'lod1', 'lod2'] as const) for (const low of [false, true]) for (const coat of id.endsWith('.dog') ? [undefined, 'black', 'cream'] : [undefined]) {
      const file = variantPath(((lod === 'lod0' ? def.glb : def.lods![lod])!).replace(/\.glb$/, low ? '.low.glb' : '.glb'), coat);
      const doc = await io.read(file);
      for (const texture of doc.getRoot().listTextures()) {
        expect(texture.getMimeType()).toBe('image/ktx2');
        expect(texture.getSize()!.every(n => n % 4 === 0), file).toBe(true);
      }
    }
  }
});
