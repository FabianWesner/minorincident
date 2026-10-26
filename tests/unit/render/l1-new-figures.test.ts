import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { Box3, BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from '../../../src/assets/manifest.json';
import { stripGlbTextures } from '../helpers/stripGlbTextures';
import { CorgiTongue } from '../../../src/render/characters/CorgiTongue';
import { PawContacts } from '../../../src/render/characters/PawContacts';
import { QuadrupedAnimator } from '../../../src/render/characters/QuadrupedAnimator';
import { variantPath } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';
import { bakedSkull } from '../../../src/render/characters/CrowdAccessories';
import { characterNodes } from '../../../src/data/survivor';
import { authoredClips, sampleClip } from '../../../src/render/characters/clips';

for (const id of ['npc.civilian-elderly', 'npc.depot-clerk', 'npc.lab-tech-a', 'npc.lab-tech-b', 'npc.lab-guard', 'npc.firefighter-alive']) test(`${id}: gestures retain glove seams and physical prop ownership @E08 @E17`, async () => {
  const def = manifest.find(d => d.id === id)!, root = await load(def.glb), body = root.getObjectByName('skin_body') as SkinnedMesh;
  root.updateMatrixWorld(true);
  const rest = Array.from({ length: body.geometry.getAttribute('position').count }, (_, i) => body.getVertexPosition(i, new Vector3()).clone());
  for (const name of ['clipboard', 'clipboard-paper', 'clipboard-clip']) {
    const prop = root.getObjectByName(name); if (!prop) continue;
    let owner = prop.parent; while (owner && !/^hand[LR]$/.test(owner.name)) owner = owner.parent;
    expect(owner, `${id}/${name} hand binding`).toBeTruthy();
    const centre = new Box3().setFromObject(prop).getCenter(new Vector3());
    const other = root.getObjectByName(owner!.name === 'handL' ? 'handR' : 'handL')!;
    expect(centre.distanceTo(owner!.getWorldPosition(new Vector3())), `${id}/${name} nearest physical hand`).toBeLessThanOrEqual(centre.distanceTo(other.getWorldPosition(new Vector3())));
  }
  const stretched: { clip: string; phase: number; before: number; after: number; a: number; b: number }[] = [];
  for (const clip of ['npc-give', 'npc-wave', 'ff-pry']) for (const phase of [.25, .5, .75]) {
    sampleClip(root, clip, authoredClips.get(clip)!.duration * phase); root.updateMatrixWorld(true);
    const posed = rest.map((_, i) => body.getVertexPosition(i, new Vector3()).clone()), index = body.geometry.index!;
    for (let t = 0; t < index.count; t += 3) for (let edge = 0; edge < 3; edge++) {
      const a = index.getX(t + edge), b = index.getX(t + (edge + 1) % 3), before = rest[a].distanceTo(rest[b]), after = posed[a].distanceTo(posed[b]);
      if (after > Math.max(.25, before * 4)) stretched.push({ clip, phase, before, after, a, b });
    }
  }
  stretched.sort((a, b) => b.after - a.after);
  if (stretched.length) console.log(JSON.stringify({ id, worst: stretched[0], vertices: [stretched[0].a, stretched[0].b].map(i => ({ rest: rest[i].toArray(), weights: [0, 1, 2, 3].map(k => [body.skeleton.bones[body.geometry.getAttribute('skinIndex').getComponent(i, k)].name, body.geometry.getAttribute('skinWeight').getComponent(i, k)]) })) }));
  expect(stretched.slice(0, 5), `${id} worst gesture edges`).toEqual([]);
});

test('L1 skinned headwear excludes bun height and glasses while retaining skull depth @E08', () => {
  const geometry = new BufferGeometry(), head = characterNodes.indexOf('head');
  geometry.setAttribute('position', new Float32BufferAttribute([-.1, 1.2, -.15, .15, 1.5, .15, -.4, 1.8, -.4, .4, 2.2, .4, .3, 1.6, .2], 3));
  geometry.setAttribute('_parts', new Float32BufferAttribute([head, -1, 0, 0, head, -1, 0, 0, head, 0, 0, 0, head, 0, 0, 4, head, -6, 0, 0], 4));
  geometry.userData.crowdBinds = Array.from({ length: characterNodes.length }, () => new Matrix4().toArray()).flat();
  const skull = bakedSkull(geometry)!;
  expect(skull.size.x).toBeCloseTo(.8); expect(skull.size.y).toBeCloseTo(.3);
  expect(skull.centre.y).toBeCloseTo(1.35); expect(skull.size.z).toBeCloseTo(.3);
  geometry.dispose();
});

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
