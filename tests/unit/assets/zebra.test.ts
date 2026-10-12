import { readFileSync, statSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AnimationMixer, Matrix4, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Document } from '@gltf-transform/core';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';
import { generateStumpCaps } from '../../../tools/assets/optimize';
import { validateDocument } from '../../../tools/assets/validate';
import { CrowdLocomotion } from '../../../src/render/characters/CrowdLocomotion';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';

const definitions = ['amb.zebra', 'inf.zebra'].map(id => manifest.find(a => a.id === id)! as AssetDef);
/** Compare geometry independent of palette/material grouping and exporter vertex order. */
function surfaces(doc: Document) {
  return doc.getRoot().listNodes().flatMap(node => {
    const triangles: string[] = [];
    const edges = new Map<string, number>();
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const positions = primitive.getAttribute('POSITION')!, indices = primitive.getIndices()!;
      const point: number[] = [];
      for (let i = 0; i < indices.getCount(); i += 3) {
        const corners = [0, 1, 2].map(k => {
          positions.getElement(indices.getScalar(i + k), point);
          return point.map(v => Math.round(v * 10000)).join(',');
        });
        triangles.push(corners.sort().join('|'));
        for (let k = 0; k < 3; k++) {
          const edge = [corners[k], corners[(k + 1) % 3]].sort().join('|');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
    }
    return node.getMesh() ? [{ name: node.getName(), triangles: triangles.sort(), edges }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
}
for (const [lod, budget] of [6000, 2000, 700].entries()) {
  test(`T-E07-01-zebra-asset-lod${lod} @E07-AC01 @E18-AC01 shared zebra anatomy, closed LOD, stripe palette and crowd rig`, async () => {
    const io = await assetIO();
    const docs: Document[] = [];
    for (const def of definitions) {
      const path = lod ? def.lods![lod === 1 ? 'lod1' : 'lod2']! : def.glb;
      const doc = await io.read(path); docs.push(doc);
      const source = await io.read(`assets/${def.id}/model${lod ? `.lod${lod}` : ''}.glb`);
      const materialCount = source.getRoot().listMaterials().length;
      generateStumpCaps(source, def);
      expect(source.getRoot().listMaterials().length, 'authored caps add no unused materials during standard builds').toBe(materialCount);
      expect(validateDocument(doc, def, statSync(path).size, lod, source).errors).toEqual([]);
      const validation = validateDocument(doc, def, statSync(path).size, lod);
      expect(validation.triangles).toBeLessThanOrEqual(budget);
      expect(validation.materials).toBeLessThanOrEqual(4);
      expect(validation.fileKB).toBeLessThanOrEqual(600);
      // Closed source parts prove the authored LOD never became a perforated decimation shell.
      for (const surface of surfaces(source)) expect([...surface.edges.values()].every(n => n === 2), surface.name).toBe(true);
      const names = doc.getRoot().listMaterials().map(m => m.getName());
      expect(names).toContain('pal_uiDark');
      expect(names).toContain(def.id.startsWith('inf.') ? 'pal_infectedSkin' : 'pal_picketWhite');
      expect(names.some(n => n.startsWith('emi_'))).toBe(def.id.startsWith('inf.'));
      const bytes = readFileSync(path);
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
      expect(gltf.animations.map(a => a.name).sort()).toEqual(['zebra-rear-kick', 'zebra-stampede']);
      for (const clip of gltf.animations) {
        const mixer = new AnimationMixer(gltf.scene), leg = gltf.scene.getObjectByName('legBL')!;
        const rest = leg.quaternion.clone(); mixer.clipAction(clip).play(); mixer.setTime(clip.name === 'zebra-rear-kick' ? .7 : 56 / 60);
        expect(leg.quaternion.equals(rest)).toBe(false);
        mixer.stopAllAction();
      }
      gltf.scene.animations = gltf.animations; // Registry retains the GLB's authored special clips.
      const baked = bakeInfected(gltf.scene, def.animatedNodes);
      for (const special of ['zebra-rear-kick', 'zebra-stampede'] as const) {
        const start = infectedClips.indexOf(special) * framesPerClip * baked.clip.parts.length * 16;
        const joint = baked.clip.parts.indexOf('legBL') * 16;
        expect(new Matrix4().fromArray(baked.clip.matrices, start + joint).equals(new Matrix4().fromArray(baked.clip.matrices, start + joint + 14 * baked.clip.parts.length * 16)), special).toBe(false);
      }
      expect(baked.clip.matrices.every(Number.isFinite)).toBe(true);
      const offset = infectedClips.indexOf('run') * framesPerClip * baked.clip.parts.length * 16;
      const leg = baked.clip.parts.indexOf('legFL') * 16;
      expect(new Matrix4().fromArray(baked.clip.matrices, offset + leg).equals(new Matrix4().fromArray(baked.clip.matrices, offset + leg + 6 * baked.clip.parts.length * 16))).toBe(false);
      expect(gltf.scene.getObjectByName('root')!.userData.ss_preserveAnimalJoints).toBe(true);
      const locomotion = new CrowdLocomotion(gltf.scene, baked.clip);
      const width = baked.clip.parts.length * 16;
      const pose = Float32Array.from(baked.clip.matrices.slice(offset + width * 6, offset + width * 7)), original = pose.slice();
      locomotion.correct(1, pose, new Matrix4(), .25, 'run', 1, 6, { lunge: .2, lurch: 1 }, .1);
      expect(pose, 'paw pinning must never translate a zebra shoulder away from its body').toEqual(original);
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
        expect(bottom, 'real hooves stay grounded across the run atlas').toBeGreaterThanOrEqual(-.001);
      }
      const emissive = baked.geometry.getAttribute('_emissive');
      expect(Array.from({ length: emissive.count }, (_, i) => emissive.getX(i)).some(v => v > .5)).toBe(def.id.startsWith('inf.'));
      baked.geometry.dispose();
    }
    const healthy = await io.read(`assets/amb.zebra/model${lod ? `.lod${lod}` : ''}.glb`);
    const infected = await io.read(`assets/inf.zebra/model${lod ? `.lod${lod}` : ''}.glb`);
    expect(surfaces(infected).map(({ name, triangles }) => ({ name, triangles }))).toEqual(surfaces(healthy).map(({ name, triangles }) => ({ name, triangles })));
    expect(docs[1].getRoot().listNodes().map(n => [n.getName(), n.getParentNode()?.getName(), n.getMatrix()]).sort()).toEqual(docs[0].getRoot().listNodes().map(n => [n.getName(), n.getParentNode()?.getName(), n.getMatrix()]).sort());
  });
}
test('T-E07-01-zebra-derivation @E07-AC01 Z-D2 reuses the base builder and actual D-ZOO anchors', () => {
  expect(readFileSync('assets/inf.zebra/build.py', 'utf8')).toContain("'amb.zebra/build.py'");
  const scene = JSON.parse(readFileSync('tests/scenes/zebra-asset/zoo-base.json', 'utf8'));
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-ZOO.layout.json', 'utf8'));
  expect(scene.layout.district).toBe('D-ZOO');
  for (const name of scene.layout.anchors) expect(layout.anchors[name]).toBeTruthy();
  expect(scene.props.some((p: { asset: string }) => p.asset === 'amb.zebra')).toBe(true);
  expect(scene.actors.some((a: { look?: { model?: string } }) => a.look?.model === 'inf.zebra')).toBe(true);
});
