/** Keep the authored Mega skull, eyes and variant horns/tusks on the v2 body. */
import { getBounds, compactPrimitive, joinPrimitives } from '@gltf-transform/functions';
import { Matrix4, Vector3 } from 'three';
import { assetIO } from './io';

export async function restoreMegaSkull(path: string, source: string) {
  const io = await assetIO(), doc = await io.read(path), old = await io.read(source);
  const bodyNode = doc.getRoot().listNodes().find(n => n.getName() === 'skin_body')!, skin = doc.getRoot().listSkins()[0];
  const head = skin.listJoints().findIndex(n => n.getName() === 'head');
  const target = getBounds(bodyNode), baseline = getBounds(old.getRoot().listScenes()[0]);
  const scale = (target.max[1] - target.min[1]) / (baseline.max[1] - baseline.min[1]);
  const alignment = new Matrix4().makeTranslation(0, target.min[1] - baseline.min[1] * scale, 0).scale(new Vector3(scale, scale, scale));
  let removedTriangles = 0;
  for (const primitive of bodyNode.getMesh()!.listPrimitives()) {
    const owners = primitive.getAttribute('_CROWD_PART')!, indices = primitive.getIndices(), kept: number[] = [];
    for (let i = 0; i < (indices?.getCount() ?? owners.getCount()); i += 3) {
      const tri = [0, 1, 2].map(k => indices ? indices.getScalar(i + k) : i + k);
      if (tri.some(v => owners.getScalar(v) === head)) removedTriangles++;
      else kept.push(...tri);
    }
    primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(kept))); compactPrimitive(primitive);
  }
  // The same fitted neck boundary used by dismemberment closes the living seam.
  const material = doc.createMaterial('pal_picketWhite').setRoughnessFactor(1), collar = doc.createMesh('mega_neck');
  for (const original of doc.getRoot().listNodes().find(n => n.getName() === 'stump_head')!.getMesh()!.listPrimitives()) {
    const primitive = original.clone().setMaterial(material), count = primitive.getAttribute('POSITION')!.getCount();
    primitive.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(new Float32Array(count * 3).fill(.018)));
    primitive.setAttribute('_CROWD_REGION', doc.createAccessor().setType('SCALAR').setArray(new Float32Array(count)));
    collar.addPrimitive(primitive);
  }
  bodyNode.addChild(doc.createNode('mega_neck').setMesh(collar).setSkin(skin));
  const skull = doc.createMesh('authored_mega_skull'), eyes = doc.createMesh('authored_mega_eyes');
  const point = new Vector3(), normal = new Vector3(); let headTriangles = 0, eyeTriangles = 0;
  for (const node of old.getRoot().listNodes()) {
    let parent = node; while (parent && parent.getName() !== 'head') parent = parent.getParentNode()!;
    if (!parent || node.getName().startsWith('stump_')) continue;
    for (const original of node.getMesh()?.listPrimitives() ?? []) {
      const p = original.getAttribute('POSITION')!, n = original.getAttribute('NORMAL')!, index = original.getIndices();
      const matrix = new Matrix4().fromArray(node.getWorldMatrix()).premultiply(alignment), positions: number[] = [], normals: number[] = [];
      const color = original.getMaterial()!.getBaseColorFactor().slice(0, 3), colors: number[] = [];
      const count = index?.getCount() ?? p.getCount();
      for (let i = 0; i < count; i++) {
        const v = index ? index.getScalar(i) : i; point.fromArray(p.getElement(v, [])).applyMatrix4(matrix).toArray(positions, positions.length);
        normal.fromArray(n.getElement(v, [])).transformDirection(matrix).toArray(normals, normals.length); colors.push(...color);
      }
      const joints = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) { joints[i * 4] = head; weights[i * 4] = 1; }
      const primitive = doc.createPrimitive().setMaterial(material);
      for (const [name, type, array] of [
        ['POSITION', 'VEC3', new Float32Array(positions)], ['NORMAL', 'VEC3', new Float32Array(normals)],
        ['COLOR_0', 'VEC3', new Float32Array(colors)], ['TEXCOORD_0', 'VEC2', new Float32Array(count * 2)],
        ['JOINTS_0', 'VEC4', joints], ['WEIGHTS_0', 'VEC4', weights],
        ['_CROWD_PART', 'SCALAR', new Uint16Array(count).fill(head)], ['_CROWD_REGION', 'SCALAR', new Float32Array(count)],
      ] as const) primitive.setAttribute(name, doc.createAccessor().setType(type).setArray(array));
      primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from({ length: count }, (_, i) => i)));
      if (original.getMaterial()!.getName().startsWith('emi_')) { eyes.addPrimitive(primitive); eyeTriangles += count / 3; }
      else { skull.addPrimitive(primitive); headTriangles += count / 3; }
    }
  }
  if (!eyeTriangles || !headTriangles) throw Error('Mega authored skull/eyes missing');
  for (const mesh of [skull, eyes]) {
    const pieces = mesh.listPrimitives(), joined = joinPrimitives(pieces);
    for (const primitive of pieces) { mesh.removePrimitive(primitive); primitive.dispose(); }
    mesh.addPrimitive(joined);
  }
  bodyNode.addChild(doc.createNode('authored_mega_skull').setMesh(skull).setSkin(skin));
  const eyeNode = doc.getRoot().listNodes().find(n => n.getName() === 'skin_eyes')!;
  eyeNode.setMesh(eyes).setSkin(skin).setExtras({ ...eyeNode.getExtras(), crowdEye: true });
  await io.write(path, doc);
  return { source, scale, removedTriangles, headTriangles, eyeTriangles, retained: 'authored skull/eyes and variant head hardware; reconstructed body retained' };
}
