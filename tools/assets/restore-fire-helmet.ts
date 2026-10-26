/** Q-190: retain PROD's complete helmet/head assembly on the new skinned firefighter. */
import { Matrix4, Vector3 } from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';
import { simplify, weld, joinPrimitives, compactPrimitive, getBounds } from '@gltf-transform/functions';
import { assetIO } from './io';

export async function restoreFireHelmet(path: string, source: string, lod = 0): Promise<void> {
  const io = await assetIO(), doc = await io.read(path), old = await io.read(source);
  if (lod > 0) { await MeshoptSimplifier.ready; await old.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: lod === 2 ? .35 : .55, error: .01 })); }
  const targetBounds = getBounds(doc.getRoot().listNodes().find(node => node.getName() === 'skin_body')!), sourceBounds = getBounds(old.getRoot().listScenes()[0]);
  const scale = (targetBounds.max[1] - targetBounds.min[1]) / (sourceBounds.max[1] - sourceBounds.min[1]);
  const alignment = new Matrix4().makeTranslation(0, targetBounds.min[1] - sourceBounds.min[1] * scale, 0).scale(new Vector3(scale, scale, scale));
  const skin = doc.getRoot().listSkins()[0], headIndex = skin.listJoints().findIndex(n => n.getName() === 'head');
  const helmet = doc.createMesh('prod_fire_helmet'), point = new Vector3(), normal = new Vector3();
  const selected: { node: import('@gltf-transform/core').Node; primitive: import('@gltf-transform/core').Primitive }[] = [];
  let brim = Infinity, neck = Infinity;
  const irises = [new Vector3(-Infinity, 0, 0), new Vector3(-Infinity, 0, 0)];
  for (const node of old.getRoot().listNodes()) if (node.getName().startsWith('head__') || node.getParentNode()?.getName() === 'head') for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const p = primitive.getAttribute('POSITION')!, m = new Matrix4().fromArray(node.getWorldMatrix()).premultiply(alignment);
    if (/pal_(brick|survivorRed)$/.test(primitive.getMaterial()!.getName())) { const indices = primitive.getIndices(); for (let i = 0; i < (indices?.getCount() ?? p.getCount()); i++) brim = Math.min(brim, point.fromArray(p.getElement(indices ? indices.getScalar(i) : i, [])).applyMatrix4(m).y); }
    const indices = primitive.getIndices();
    for (let i = 0; i < (indices?.getCount() ?? p.getCount()); i++) {
      point.fromArray(p.getElement(indices ? indices.getScalar(i) : i, [])).applyMatrix4(m);
      if (/pal_skin/.test(primitive.getMaterial()!.getName())) neck = Math.min(neck, point.y);
      if (/pal_eyeBrown/.test(primitive.getMaterial()!.getName())) irises[point.z < 0 ? 0 : 1].x = Math.max(irises[point.z < 0 ? 0 : 1].x, point.x);
    }
    selected.push({ node, primitive });
  }
  if (!Number.isFinite(brim) || !Number.isFinite(neck)) throw Error('PROD helmet shell is missing');
  const body = doc.getRoot().listNodes().find(n => n.getName() === 'skin_body')!.getMesh()!;
  for (const primitive of body.listPrimitives()) {
    // Keep the original semantic neck boundary, which shares its exact cap.
    // A horizontal clip crosses the shoulder blend and leaves the drooping
    // painted brim below the cut; replacing the complete head avoids both.
    const owners = primitive.getAttribute('_CROWD_PART')!, indices = primitive.getIndices(), kept: number[] = [];
    for (let i = 0; i < (indices?.getCount() ?? owners.getCount()); i += 3) {
      const triangle = [0, 1, 2].map(k => indices ? indices.getScalar(i + k) : i + k);
      if (triangle.some(v => owners.getScalar(v) === headIndex)) continue;
      kept.push(...triangle);
    }
    primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(kept)));
    compactPrimitive(primitive);
    // The removed painted hood left a bronze band across the coat collar.
    // Keep its geometry and use the authored dark PPE collar color instead.
    const p = primitive.getAttribute('POSITION')!, region = primitive.getAttribute('_CROWD_REGION')!, owner = primitive.getAttribute('_CROWD_PART')!, colors = new Float32Array(p.getCount() * 3).fill(1);
    const headY = skin.listJoints()[headIndex].getWorldTranslation()[1], torso = skin.listJoints().findIndex(n => n.getName() === 'torso');
    for (let i = 0; i < p.getCount(); i++) {
      const v = p.getElement(i, []) as number[];
      if (owner.getScalar(i) === torso && v[1] > headY - .03 && Math.abs(v[0]) < .32 && Math.abs(v[2]) < .25) { region.setScalar(i, 3); colors.set([.015, .022, .035], i * 3); }
    }
    primitive.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(colors));
  }
  const headMaterial = doc.createMaterial('pal_picketWhite').setRoughnessFactor(1);
  for (const { node, primitive } of selected) {
    const p = primitive.getAttribute('POSITION')!, n = primitive.getAttribute('NORMAL')!, index = primitive.getIndices()!, matrix = new Matrix4().fromArray(node.getWorldMatrix()).premultiply(alignment);
    const positions: number[] = [], normals: number[] = [], joints: number[] = [], weights: number[] = [], indices: number[] = [];
    for (let i = 0; i < index.getCount(); i += 3) {
      const tri = [0, 1, 2].map(k => index.getScalar(i + k));
      for (const v of tri) {
        indices.push(positions.length / 3); point.fromArray(p.getElement(v, [])).applyMatrix4(matrix).toArray(positions, positions.length);
        normal.fromArray(n.getElement(v, [])).transformDirection(matrix).toArray(normals, normals.length);
        joints.push(headIndex, 0, 0, 0); weights.push(1, 0, 0, 0);
      }
    }
    if (!indices.length) continue;
    const color = primitive.getMaterial()!.getBaseColorFactor().slice(0, 3), colors = Array.from({ length: indices.length }, () => color).flat();
    const result = doc.createPrimitive().setMaterial(headMaterial).setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(new Float32Array(colors)));
    for (const [name, type, array] of [['POSITION', 'VEC3', new Float32Array(positions)], ['NORMAL', 'VEC3', new Float32Array(normals)], ['TEXCOORD_0', 'VEC2', new Float32Array(positions.length / 3 * 2)], ['JOINTS_0', 'VEC4', new Uint16Array(joints)], ['WEIGHTS_0', 'VEC4', new Float32Array(weights)]] as const) result.setAttribute(name, doc.createAccessor().setType(type).setArray(array));
    result.setAttribute('_CROWD_PART', doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(indices.length).fill(headIndex)));
    result.setAttribute('_CROWD_REGION', doc.createAccessor().setType('SCALAR').setArray(new Float32Array(indices.length).fill(/^pal_skin/.test(primitive.getMaterial()!.getName()) ? 1 : 0)));
    result.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices))); helmet.addPrimitive(result);
  }
  const pieces = helmet.listPrimitives(), joined = joinPrimitives(pieces);
  for (const piece of pieces) { helmet.removePrimitive(piece); piece.dispose(); }
  helmet.addPrimitive(joined);
  doc.getRoot().listNodes().find(node => node.getName() === 'skin_body')!.addChild(doc.createNode('prod_fire_helmet').setMesh(helmet).setSkin(skin));
  // Dormant infected irises stay on the retained authored eyes, not on the removed visor.
  const eyes = doc.getRoot().listNodes().find(node => node.getName() === 'skin_eyes');
  for (const primitive of eyes?.getMesh()?.listPrimitives() ?? []) {
    const p = primitive.getAttribute('POSITION')!;
    for (let i = 0; i < p.getCount(); i++) { const v = p.getElement(i, []) as number[]; v[0] = irises[v[2] < 0 ? 0 : 1].x + .003; p.setElement(i, v); }
  }
  await io.write(path, doc);
}
