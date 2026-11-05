/** Keep the authored Mega skull, eyes and variant horns/tusks on the v2 body. */
import { getBounds, compactPrimitive, joinPrimitives } from '@gltf-transform/functions';
import { Box3, Matrix4, Vector3 } from 'three';
import { assetIO } from './io';

export async function restoreMegaSkull(path: string, source: string) {
  const io = await assetIO(), doc = await io.read(path), old = await io.read(source);
  const bodyNode = doc.getRoot().listNodes().find(n => n.getName() === 'skin_body')!, skin = doc.getRoot().listSkins()[0];
  const head = skin.listJoints().findIndex(n => n.getName() === 'head');
  const target = getBounds(bodyNode), baseline = getBounds(old.getRoot().listScenes()[0]);
  const scale = (target.max[1] - target.min[1]) / (baseline.max[1] - baseline.min[1]);
  const alignment = new Matrix4().makeTranslation(0, target.min[1] - baseline.min[1] * scale, 0).scale(new Vector3(scale, scale, scale));
  // The authored white cores sit just ahead of their red shells. Keep the
  // production eye-core classification when folding the palette into a skin.
  const eyeBounds = [new Box3(), new Box3()], sample = new Vector3();
  for (const node of old.getRoot().listNodes()) {
    let parent = node; while (parent && parent.getName() !== 'head') parent = parent.getParentNode()!;
    if (!parent) continue;
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      if (!primitive.getMaterial()?.getName().startsWith('emi_')) continue;
      const positions = primitive.getAttribute('POSITION')!, matrix = new Matrix4().fromArray(node.getWorldMatrix()).premultiply(alignment);
      for (let i = 0; i < positions.getCount(); i++) {
        sample.fromArray(positions.getElement(i, [])).applyMatrix4(matrix);
        eyeBounds[sample.z < 0 ? 0 : 1].expandByPoint(sample);
      }
    }
  }
  for (const bounds of eyeBounds) { bounds.max.x += .025 * scale; bounds.expandByVector(new Vector3(.002, .004, .004).multiplyScalar(scale)); }
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
    primitive.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(count * 2)));
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
      const isShell = original.getMaterial()!.getName().startsWith('emi_');
      const count = index?.getCount() ?? p.getCount();
      const core: number[] = [], surface: number[] = [];
      for (let i = 0; i < count; i += 3) {
        const triangle = [0, 1, 2].map(k => index ? index.getScalar(i + k) : i + k);
        const isCore = Math.min(...color) > .4 && triangle.every(v => {
          point.fromArray(p.getElement(v, [])).applyMatrix4(matrix);
          return eyeBounds[point.z < 0 ? 0 : 1].containsPoint(point);
        });
        (isShell || isCore ? core : surface).push(...triangle);
      }
      for (const [vertices, eye] of [[surface, false], [core, true]] as const) {
        if (!vertices.length) continue;
        positions.length = 0; normals.length = 0; colors.length = 0;
        for (const v of vertices) {
          point.fromArray(p.getElement(v, [])).applyMatrix4(matrix).toArray(positions, positions.length);
          normal.fromArray(n.getElement(v, [])).transformDirection(matrix).toArray(normals, normals.length); colors.push(...color);
        }
        const length = vertices.length, joints = new Uint16Array(length * 4), weights = new Float32Array(length * 4);
        for (let i = 0; i < length; i++) { joints[i * 4] = head; weights[i * 4] = 1; }
        const primitive = doc.createPrimitive().setMaterial(material);
        for (const [name, type, array] of [
          ['POSITION', 'VEC3', new Float32Array(positions)], ['NORMAL', 'VEC3', new Float32Array(normals)],
          ['COLOR_0', 'VEC3', new Float32Array(colors)], ['TEXCOORD_0', 'VEC2', new Float32Array(length * 2).fill(.5)],
          ['JOINTS_0', 'VEC4', joints], ['WEIGHTS_0', 'VEC4', weights],
          ['_CROWD_PART', 'SCALAR', new Uint16Array(length).fill(head)], ['_CROWD_REGION', 'SCALAR', new Float32Array(length)],
        ] as const) primitive.setAttribute(name, doc.createAccessor().setType(type).setArray(array));
        primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from({ length }, (_, i) => i)));
        if (eye) { eyes.addPrimitive(primitive); eyeTriangles += length / 3; }
        else { skull.addPrimitive(primitive); headTriangles += length / 3; }
      }
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
