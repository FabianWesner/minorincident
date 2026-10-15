import { readFileSync, statSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AnimationMixer, Box3, Matrix4, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Document } from '@gltf-transform/core';
import manifest from '../../../src/assets/manifest.json';
import { variantPath, type AssetDef } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';
import { coplanarOverlaps } from '../../../tools/assets/zfight';
import { validateDocument } from '../../../tools/assets/validate';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';

const find = (id: string) => manifest.find(a => a.id === id) as AssetDef;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function load(path: string) {
  const bytes = readFileSync(path);
  return await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
/** Edge multiplicity per node surface (`by: 'node'`, authored dog sweeps shared across palette faces) or per material
 * primitive (`by: 'material'`, the remeshed Mega Alpha solids: neighbouring material pieces may touch, each is closed). */
function surfaces(doc: Document, by: 'node' | 'material') {
  return doc.getRoot().listNodes().flatMap(node => {
    const result: { name: string; edges: Map<string, number> }[] = [];
    const shared = new Map<string, number>();
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const edges = by === 'node' ? shared : new Map<string, number>();
      const positions = primitive.getAttribute('POSITION')!, indices = primitive.getIndices()!;
      const point: number[] = [];
      for (let i = 0; i < indices.getCount(); i += 3) {
        const corners = [0, 1, 2].map(k => { positions.getElement(indices.getScalar(i + k), point); return point.map(v => Math.round(v * 10000)).join(','); });
        for (let k = 0; k < 3; k++) {
          const edge = [corners[k], corners[(k + 1) % 3]].sort().join('|');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      if (by === 'material') result.push({ name: `${node.getName()}/${primitive.getMaterial()?.getName()}`, edges });
    }
    if (by === 'node' && node.getMesh()) result.push({ name: node.getName(), edges: shared });
    return result;
  });
}
const lodPath = (def: AssetDef, lod: number, variant?: string) => variantPath(lod === 0 ? def.glb : def.lods![lod === 1 ? 'lod1' : 'lod2']!, variant);
const sourcePath = (id: string, lod: number, variant?: string) => `assets/${id}/model${variant ? '.' + variant : ''}${lod ? `.lod${lod}` : ''}.glb`;
function bounds(root: Awaited<ReturnType<typeof load>>['scene']) {
  root.traverse(node => { if (node.name.startsWith('stump_')) node.visible = false; });
  return new Box3().setFromObject(root).getSize(new Vector3());
}

// --- Mega Alpha ----------------------------------------------------------------------------------------------------
const mega = find('inf.mega-alpha'), alpha = find('inf.alpha');
for (const [lod, budget] of [16000, 6000, 2000].entries()) {
  test(`T-L10-mega-alpha-lod${lod} @L10 Mega Alpha stays inside its 16k/6k/2k caps, keeps the Alpha rig contract and bakes the shared clips`, async () => {
    const path = lodPath(mega, lod);
    const doc = await (await assetIO()).read(path);
    const validation = validateDocument(doc, mega, statSync(path).size, lod);
    expect(validation.errors).toEqual([]);
    expect(validation.triangles).toBeLessThanOrEqual(budget);
    expect(validation.materials).toBeLessThanOrEqual(6);
    expect(validation.fileKB).toBeLessThanOrEqual(1600);
    expect(coplanarOverlaps(doc), 'no coplanar overlapping surfaces').toEqual([]);
    const gltf = await load(path), alphaGltf = await load(lodPath(alpha, lod));
    const big = bounds(gltf.scene), small = bounds(alphaGltf.scene);
    expect(big.y / small.y, 'same height as the Alpha (PO 10-15)').toBeGreaterThan(.95);
    expect(big.y / small.y).toBeLessThan(1.1);
    expect(big.x / small.x, 'bulkier, not only taller').toBeGreaterThan(big.y / small.y);
    for (const name of mega.requiredNodes) expect(gltf.scene.getObjectByName(name), name).toBeTruthy();
    for (const name of mega.animatedNodes) {
      const joint = gltf.scene.getObjectByName(name)!;
      expect(joint.scale.toArray()).toEqual([1, 1, 1]);
      expect(joint.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    }
    // Same node names and parents as the Alpha: the Alpha special-move clips retarget unchanged.
    const hierarchy = (root: typeof gltf.scene) => { const names: string[] = []; root.traverse(n => { if (n.name && !(n as Mesh).isMesh) names.push(`${n.name}<${n.parent?.name ?? ''}`); }); return names.sort(); };
    expect(hierarchy(gltf.scene)).toEqual(hierarchy(alphaGltf.scene));
    const baked = bakeInfected(gltf.scene, mega.animatedNodes);
    expect(baked.clip.matrices.every(Number.isFinite)).toBe(true);
    for (const clip of ['run', 'swing', 'knockdown', 'get-up']) {
      const offset = infectedClips.indexOf(clip as typeof infectedClips[number]) * framesPerClip * baked.clip.parts.length * 16;
      const foot = baked.clip.parts.indexOf(clip === 'swing' ? 'handR' : 'footL') * 16;
      const first = new Matrix4().fromArray(baked.clip.matrices, offset + foot);
      const later = new Matrix4().fromArray(baked.clip.matrices, offset + foot + 8 * baked.clip.parts.length * 16);
      expect(later.equals(first), clip).toBe(false);
    }
    const emissive = baked.geometry.getAttribute('_emissive');
    expect(Array.from({ length: emissive.count }, (_, i) => emissive.getX(i)).some(v => v > .5), 'glowing eyes').toBe(true);
    baked.geometry.dispose();
    const documentLod = lod ? await (await assetIO()).read(sourcePath(mega.id, lod)) : null;
    // LOD1/LOD2 are closed solids (the lod-objectives method), never perforated decimation shells.
    if (documentLod) for (const surface of surfaces(documentLod, 'material')) expect([...surface.edges.values()].every(n => n % 2 === 0), `${surface.name}: every edge is shared by an even number of faces (separate closed solids may touch)`).toBe(true);
  });
}
test('T-L10-mega-alpha-derivation @L10 Mega Alpha derives from the worker like the Alpha and shares its hidden caps', async () => {
  expect(readFileSync(mega.script!, 'utf8')).toContain("'inf.common-worker/build.py'");
  const gltf = await load(mega.glb);
  for (const name of mega.requiredNodes.filter(n => n.startsWith('stump_'))) expect(gltf.scene.getObjectByName(name)!.userData.hidden, name).toBe(true);
});

// --- Dogs ----------------------------------------------------------------------------------------------------------
const dogs = [find('amb.dog'), find('inf.dog')];
const variants: (string | undefined)[] = [undefined, 'black', 'cream'];
const dogBudget = (def: AssetDef) => def.id === 'amb.dog' ? [4000, 1500, 700] : [5000, 2000, 1000];
for (const lod of [0, 1, 2]) {
  test(`T-L10-dog-assets-lod${lod} @L10 dogs: budgets, closed authored tiers, palette coats, shared quadruped contract and clips`, async () => {
    const io = await assetIO();
    const heights = new Map<string, number>();
    for (const def of dogs) {
      expect(def.decayVariants).toEqual(['black', 'cream']);
      const infected = def.id.startsWith('inf.');
      const mains: string[] = [];
      for (const variant of variants) {
        const path = lodPath(def, lod, variant);
        const doc = await io.read(path);
        const label = `${def.id}${variant ? '.' + variant : ''}:lod${lod}`;
        const validation = validateDocument(doc, def, statSync(path).size, lod);
        expect(validation.errors, label).toEqual([]);
        expect(validation.triangles, label).toBeLessThanOrEqual(dogBudget(def)[lod]);
        expect(validation.materials, label).toBeLessThanOrEqual(infected ? 6 : 4);
        expect(validation.fileKB, label).toBeLessThanOrEqual(500);
        expect(coplanarOverlaps(doc), label).toEqual([]);
        // Authored closed solids at every tier: no perforated decimation shells.
        const source = await io.read(sourcePath(def.id, lod, variant));
        for (const surface of surfaces(source, 'node')) expect([...surface.edges.values()].every(n => n === 2), `${label} ${surface.name}`).toBe(true);
        const names = doc.getRoot().listMaterials().map(m => m.getName());
        expect(names.some(n => n.startsWith('emi_')), label).toBe(infected);
        expect(names, label).toContain('pal_uiDark');
        mains.push(names.filter(n => !n.startsWith('emi_')).sort().join(','));
        const gltf = await load(path);
        expect(gltf.animations.map(a => a.name).sort(), label).toEqual(['dog-gallop', 'dog-lunge-bite']);
        for (const clip of gltf.animations) {
          const mixer = new AnimationMixer(gltf.scene), leg = gltf.scene.getObjectByName('legFL')!, jaw = gltf.scene.getObjectByName('jaw')!;
          const rest = leg.quaternion.clone(), jawRest = jaw.quaternion.clone();
          mixer.clipAction(clip).play(); mixer.setTime(clip.name === 'dog-gallop' ? .1 : .45);
          expect(leg.quaternion.equals(rest), `${label} ${clip.name} moves the foreleg`).toBe(false);
          if (clip.name === 'dog-lunge-bite') { mixer.setTime(26 / 60); expect(jaw.quaternion.equals(jawRest), 'the jaw opens at the strike').toBe(false); }
          mixer.stopAllAction();
        }
        for (const name of def.requiredNodes) expect(gltf.scene.getObjectByName(name), `${label} ${name}`).toBeTruthy();
        expect(gltf.scene.getObjectByName('root')!.userData.ss_preserveAnimalJoints).toBe(true);
        if (!variant) {
          heights.set(def.id, bounds(gltf.scene).y);
          gltf.scene.animations = gltf.animations;
          const baked = bakeInfected(gltf.scene, def.animatedNodes);
          expect(baked.clip.matrices.every(Number.isFinite)).toBe(true);
          const width = baked.clip.parts.length * 16, offset = infectedClips.indexOf('run') * framesPerClip * width;
          const leg = baked.clip.parts.indexOf('legFL') * 16;
          expect(new Matrix4().fromArray(baked.clip.matrices, offset + leg).equals(new Matrix4().fromArray(baked.clip.matrices, offset + leg + 6 * width)), 'the shared run atlas moves the dog legs').toBe(false);
          const points = ['pawFL', 'pawFR', 'pawBL', 'pawBR'].flatMap(name => {
            const paw = gltf.scene.getObjectByName(name)!, result: { part: number; point: Vector3 }[] = [];
            paw.traverse(node => {
              if (!(node instanceof Mesh)) return;
              const positions = node.geometry.getAttribute('position');
              for (let i = 0; i < positions.count; i++) result.push({ part: baked.clip.parts.indexOf(name), point: paw.worldToLocal(new Vector3().fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld)) });
            });
            return result;
          });
          const matrix = new Matrix4(), point = new Vector3();
          for (let frame = 0; frame < framesPerClip; frame++) {
            const bottom = Math.min(...points.map(p => point.copy(p.point).applyMatrix4(matrix.fromArray(baked.clip.matrices, offset + width * frame + p.part * 16)).y));
            expect(bottom, `${label} paws stay grounded across the run atlas`).toBeGreaterThanOrEqual(-.02);
          }
          baked.geometry.dispose();
        }
      }
      expect(new Set(mains).size, `${def.id}: three distinct palette coats`).toBe(3);
    }
    expect(heights.get('inf.dog')! / heights.get('amb.dog')!, 'the infected dog carries a lower stance').toBeLessThan(.85);
    // Same rig: node names and parents are identical between the healthy and infected dog and between coats.
    const hierarchy = async (def: AssetDef, variant?: string) => (await io.read(lodPath(def, lod, variant))).getRoot().listNodes().map(n => `${n.getName()}<${n.getParentNode()?.getName() ?? ''}`).sort();
    expect(await hierarchy(dogs[1])).toEqual(await hierarchy(dogs[0]));
    expect(await hierarchy(dogs[0], 'black')).toEqual(await hierarchy(dogs[0]));
    expect(await hierarchy(dogs[1], 'cream')).toEqual(await hierarchy(dogs[1]));
  });
}
test('T-L10-dog-derivation @L10 the infected dog reuses the dog builder and both are registered with the zoo-animal contract', () => {
  expect(readFileSync('assets/inf.dog/build.py', 'utf8')).toContain("'amb.dog/build.py'");
  expect(dogs.map(d => d.category)).toEqual(['prop', 'infected']);
  const zebra = find('amb.zebra');
  for (const def of dogs) {
    expect(def.animatedNodes).toEqual(zebra.animatedNodes);
    expect(def.forward).toBe('+X');
    expect(def.frontNodes).toEqual(['front']);
  }
});
