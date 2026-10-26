/** Q-190: retain PROD's helmet shell on the new firefighter's skinned body. */
import { Matrix4, Vector3 } from 'three';
import { getBounds } from '@gltf-transform/functions';
import { assetIO } from './io';

export async function restoreFireHelmet(path: string, source: string): Promise<void> {
  const io = await assetIO(), doc = await io.read(path), old = await io.read(source);
  const targetBounds = getBounds(doc.getRoot().listNodes().find(node => node.getName() === 'skin_body')!), sourceBounds = getBounds(old.getRoot().listScenes()[0]);
  const scale = (targetBounds.max[1] - targetBounds.min[1]) / (sourceBounds.max[1] - sourceBounds.min[1]);
  const alignment = new Matrix4().makeTranslation(0, targetBounds.min[1] - sourceBounds.min[1] * scale, 0).scale(new Vector3(scale, scale, scale));
  const skin = doc.getRoot().listSkins()[0], headIndex = skin.listJoints().findIndex(n => n.getName() === 'head');
  const helmet = doc.createMesh('prod_fire_helmet'), point = new Vector3(), normal = new Vector3();
  const selected: { node: import('@gltf-transform/core').Node; primitive: import('@gltf-transform/core').Primitive }[] = [];
  let brim = Infinity;
  for (const node of old.getRoot().listNodes()) if (node.getName().startsWith('head__') || node.getParentNode()?.getName() === 'head') for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    if (!/pal_(brick|survivorRed|schoolBusYellow|silver|uiDark|picketWhite)$/.test(primitive.getMaterial()!.getName())) continue;
    const p = primitive.getAttribute('POSITION')!, m = new Matrix4().fromArray(node.getWorldMatrix()).premultiply(alignment);
    if (/pal_(brick|survivorRed)$/.test(primitive.getMaterial()!.getName())) { const indices = primitive.getIndices(); for (let i = 0; i < (indices?.getCount() ?? p.getCount()); i++) brim = Math.min(brim, point.fromArray(p.getElement(indices ? indices.getScalar(i) : i, [])).applyMatrix4(m).y); }
    selected.push({ node, primitive });
  }
  if (!Number.isFinite(brim)) throw Error('PROD helmet shell is missing');
  const body = doc.getRoot().listNodes().find(n => n.getName() === 'skin_body')!.getMesh()!;
  for (const primitive of body.listPrimitives()) {
    const names = primitive.listSemantics(), attributes = names.map(name => primitive.getAttribute(name)!);
    const position = primitive.getAttribute('POSITION')!, indices = primitive.getIndices(), joints = primitive.getAttribute('JOINTS_0')!;
    const output = names.map(() => [] as number[]), kept: number[] = [], plane = brim - .004;
    type Vertex = number[][];
    const read = (i: number): Vertex => attributes.map(a => a.getElement(i, []) as number[]);
    const pos = names.indexOf('POSITION');
    const interpolate = (a: Vertex, b: Vertex, t: number): Vertex => a.map((values, k) => /^JOINTS_|^_CROWD_PART$/.test(names[k]) ? (t < .5 ? values : b[k]).slice() : values.map((v, c) => v + (b[k][c] - v) * t));
    for (let i = 0; i < (indices?.getCount() ?? position.getCount()); i += 3) {
      const tri = [0, 1, 2].map(k => indices ? indices.getScalar(i + k) : i + k);
      let polygon = tri.map(read);
      if (tri.some(v => (joints.getElement(v, []) as number[]).includes(headIndex))) {
        const clipped: Vertex[] = [];
        for (let k = 0; k < polygon.length; k++) {
          const a = polygon[k], b = polygon[(k + 1) % polygon.length], da = a[pos][1] - plane, db = b[pos][1] - plane;
          if (da <= 0) clipped.push(a);
          if ((da < 0 && db > 0) || (da > 0 && db < 0)) clipped.push(interpolate(a, b, da / (da - db)));
        }
        polygon = clipped;
      }
      for (let k = 1; k + 1 < polygon.length; k++) for (const vertex of [polygon[0], polygon[k], polygon[k + 1]]) {
        kept.push(output[pos].length / 3);
        vertex.forEach((values, channel) => output[channel].push(...values));
      }
    }
    names.forEach((name, k) => primitive.setAttribute(name, doc.createAccessor().setType(attributes[k].getType()).setArray(/^JOINTS_|^_CROWD_PART$/.test(name) ? new Uint16Array(output[k]) : new Float32Array(output[k]))));
    primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(kept)));
  }
  for (const { node, primitive } of selected) {
    const p = primitive.getAttribute('POSITION')!, n = primitive.getAttribute('NORMAL')!, index = primitive.getIndices()!, matrix = new Matrix4().fromArray(node.getWorldMatrix()).premultiply(alignment);
    const positions: number[] = [], normals: number[] = [], joints: number[] = [], weights: number[] = [], indices: number[] = [];
    for (let i = 0; i < index.getCount(); i += 3) {
      const tri = [0, 1, 2].map(k => index.getScalar(i + k));
      if (tri.some(v => point.fromArray(p.getElement(v, [])).applyMatrix4(matrix).y < brim - .002)) continue;
      for (const v of tri) {
        indices.push(positions.length / 3); point.fromArray(p.getElement(v, [])).applyMatrix4(matrix).toArray(positions, positions.length);
        normal.fromArray(n.getElement(v, [])).transformDirection(matrix).toArray(normals, normals.length);
        joints.push(headIndex, 0, 0, 0); weights.push(1, 0, 0, 0);
      }
    }
    if (!indices.length) continue;
    const material = doc.createMaterial(primitive.getMaterial()!.getName()).setBaseColorFactor(primitive.getMaterial()!.getBaseColorFactor()).setRoughnessFactor(1);
    const result = doc.createPrimitive().setMaterial(material);
    for (const [name, type, array] of [['POSITION', 'VEC3', new Float32Array(positions)], ['NORMAL', 'VEC3', new Float32Array(normals)], ['TEXCOORD_0', 'VEC2', new Float32Array(positions.length / 3 * 2)], ['JOINTS_0', 'VEC4', new Uint16Array(joints)], ['WEIGHTS_0', 'VEC4', new Float32Array(weights)]] as const) result.setAttribute(name, doc.createAccessor().setType(type).setArray(array));
    result.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices))); helmet.addPrimitive(result);
  }
  doc.getRoot().listNodes().find(node => node.getName() === 'skin_body')!.addChild(doc.createNode('prod_fire_helmet').setMesh(helmet).setSkin(skin));
  await io.write(path, doc);
}
