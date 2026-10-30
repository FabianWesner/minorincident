import type { Document, Node, Primitive } from '@gltf-transform/core';
import { Matrix3, Matrix4, Vector3 } from 'three';
import { adoptStandingBind } from './skin-crowd-standing';

export interface FigureRatios { headHeight: number; headShoulder: number; legHeight: number }
interface Vertex { point: Vector3; owner: string }
const ignored = /stump|skin_eyes|iris|pupil|clipboard|rifle|weapon|shield|baton|cane|spatula|cushion|restOnly/i;
const headOwner = (name: string) => /head|neck|eye|pony|hair|iris/.test(name);
const shortName = (name: string) => name.replace(/^survivor\d+_/, '');
function figureNodes(document: Document, rootName?: string) {
  if (!rootName) return document.getRoot().listNodes();
  const root = document.getRoot().listNodes().find(n => n.getName() === rootName);
  if (!root) throw Error(`Missing figure root ${rootName}`);
  const nodes: Node[] = []; root.traverse(n => nodes.push(n)); return nodes;
}
const world = (node: Node) => new Matrix4().fromArray(node.getWorldMatrix());
function ownerName(node: Node): string {
  for (let parent: Node | null = node; parent; parent = parent.getParentNode()) {
    if (/^(head|hip|torso|arm[LR]|foreArm[LR]|hand[LR]|leg[LR]|shin[LR]|foot[LR])$/.test(shortName(parent.getName()))) return shortName(parent.getName());
  }
  return node.getName();
}
function primitiveVertices(node: Node, primitive: Primitive): Vertex[] {
  const position = primitive.getAttribute('POSITION')!;
  const skin = node.getSkin(), indices = primitive.getAttribute('JOINTS_0'), weights = primitive.getAttribute('WEIGHTS_0');
  const matrices = skin?.listJoints().map((joint, i) => world(joint).multiply(new Matrix4().fromArray(skin.getInverseBindMatrices()!.getElement(i, []))));
  const used = primitive.getIndices() ? new Set(Array.from(primitive.getIndices()!.getArray()!)) : Array.from({ length: position.getCount() }, (_, i) => i);
  const vertices: Vertex[] = [];
  for (const i of used) {
    const raw = new Vector3().fromArray(position.getElement(i, []));
    let point = raw.clone().applyMatrix4(world(node)), owner = ownerName(node);
    if (matrices && indices && weights) {
      const j = indices.getElement(i, []), w = weights.getElement(i, []);
      point = new Vector3(); let dominant = 0;
      for (let k = 0; k < w.length; k++) { if (w[k] > w[dominant]) dominant = k; if (w[k]) point.add(raw.clone().applyMatrix4(matrices[j[k]]).multiplyScalar(w[k])); }
      owner = shortName(skin!.listJoints()[j[dominant]].getName());
    }
    vertices.push({ point, owner });
  }
  return vertices;
}
export function measureFigure(document: Document, rootName?: string) {
  const nodes = figureNodes(document, rootName);
  const joint = (name: string) => { const n = nodes.find(n => shortName(n.getName()) === name); if (!n) throw Error(`Missing anatomy joint ${name}`); return new Vector3().setFromMatrixPosition(world(n)); };
  const head = joint('head'), hip = joint('hip'), shoulderY = (joint('armL').y + joint('armR').y) / 2;
  const body = nodes.filter(n => n.getMesh() && !ignored.test(n.getName()) && !n.getExtras().hidden).flatMap(n => n.getMesh()!.listPrimitives().flatMap(p => primitiveVertices(n, p)));
  const extent = (vertices: Vertex[], axis: 'x' | 'y' | 'z') => { let min = Infinity, max = -Infinity; for (const v of vertices) { min = Math.min(min, v.point[axis]); max = Math.max(max, v.point[axis]); } return { min, max, size: max - min }; };
  const vertical = extent(body, 'y');
  const skull = body.filter(v => v.owner === 'head' && v.point.y >= head.y);
  const crown = extent(skull, 'y').max;
  const skullWidth = extent(skull, 'z');
  const shoulders = extent(body.filter(v => /^(torso|chest|spine|clavicle[LR]|arm[LR])$/.test(v.owner) && Math.abs(v.point.y - shoulderY) <= vertical.size * .035), 'z');
  const ratios: FigureRatios = { headHeight: (crown - head.y) / vertical.size, headShoulder: skullWidth.size / shoulders.size, legHeight: (hip.y - vertical.min) / vertical.size };
  if (!Object.values(ratios).every(v => Number.isFinite(v) && v > 0)) throw Error('Cannot measure anatomy');
  return { ratios, ground: vertical.min, height: vertical.size, crown, head, hip, shoulderY, shoulderWidth: shoulders.size, headCentreZ: (skullWidth.min + skullWidth.max) / 2, headCentreX: (extent(skull, 'x').min + extent(skull, 'x').max) / 2 };
}

/** One offline source operation: mesh and skeleton share the same standing bind
 * frame. Piecewise Y calibration preserves ground/crown and moves hip/neck;
 * the head width tapers into the neck over the lowest 12% of the skull. No
 * runtime scaling, extra mesh, texture, attribute or animation channel is added. */
export function calibrateFigure(document: Document, target: FigureRatios, rootName?: string) {
  // A posed shelter rig must use its standing source frame before rebinding.
  for (const node of document.getRoot().listNodes()) {
    const reset = node.getExtras().ss_standingPose;
    if (typeof reset !== 'string') continue;
    for (const [name, pose] of Object.entries(JSON.parse(reset) as Record<string, { translation: number[]; rotation: number[]; scale: number[] }>)) {
      const joint = document.getRoot().listNodes().find(n => n.getName() === name);
      joint?.setTranslation(pose.translation as [number, number, number]).setRotation(pose.rotation as [number, number, number, number]).setScale(pose.scale as [number, number, number]);
    }
  }
  const before = measureFigure(document, rootName);
  const headY = before.ground + before.height * (1 - target.headHeight), hipY = before.ground + before.height * target.legHeight;
  const width = target.headShoulder / before.ratios.headShoulder;
  const mapY = (y: number) => y <= before.hip.y ? before.ground + (y - before.ground) * (hipY - before.ground) / (before.hip.y - before.ground)
    : y <= before.head.y ? hipY + (y - before.hip.y) * (headY - hipY) / (before.head.y - before.hip.y)
    : headY + (y - before.head.y) * (before.crown - headY) / (before.crown - before.head.y);
  const deform = (p: Vector3, head: boolean) => {
    const t = head ? Math.max(0, Math.min(1, (p.y - before.head.y) / ((before.crown - before.head.y) * .12))) : 0;
    const s = 1 + (width - 1) * t;
    return new Vector3(before.headCentreX + (p.x - before.headCentreX) * s, mapY(p.y), before.headCentreZ + (p.z - before.headCentreZ) * s);
  };
  const nodes = figureNodes(document, rootName), oldWorld = new Map(nodes.map(n => [n, world(n)]));
  const newWorld = new Map(nodes.map(n => {
    const matrix = oldWorld.get(n)!.clone(), point = new Vector3().setFromMatrixPosition(matrix);
    return [n, matrix.setPosition(deform(point, headOwner(ownerName(n))))] as const;
  }));
  // Extract the neutral, evaluated skin before changing any bind matrix.
  const surfaces = nodes.flatMap(node => node.getMesh()?.listPrimitives().map(primitive => ({ node, primitive, vertices: primitiveVertices(node, primitive) })) ?? []);
  for (const node of nodes) {
    const parent = node.getParentNode();
    node.setMatrix((parent ? (newWorld.get(parent) ?? world(parent)).clone().invert().multiply(newWorld.get(node)!) : newWorld.get(node)!).toArray());
  }
  for (const { node, primitive, vertices } of surfaces) {
    const position = primitive.getAttribute('POSITION')!;
    const output = position.clone().setArray(new Float32Array(position.getCount() * 3));
    const index = primitive.getIndices(), ids = index ? [...new Set(Array.from(index.getArray()!))] : Array.from({ length: position.getCount() }, (_, i) => i);
    // Skinned positions live in the skin's global bind frame; rigid geometry
    // is brought back into the new parent-local frame after deformation.
    const local = node.getSkin() ? new Matrix4() : newWorld.get(node)!.clone().invert();
    ids.forEach((id, k) => output.setElement(id, deform(vertices[k].point, headOwner(vertices[k].owner)).applyMatrix4(local).toArray()));
    primitive.setAttribute('POSITION', output);
    const originalNormal = primitive.getAttribute('NORMAL');
    if (originalNormal) {
      const normal = originalNormal.clone().setArray(new Float32Array(originalNormal.getCount() * 3));
      const intoWorld = node.getSkin() ? new Matrix3() : new Matrix3().getNormalMatrix(oldWorld.get(node)!);
      const fromWorld = node.getSkin() ? new Matrix3() : new Matrix3().getNormalMatrix(local);
      ids.forEach((id, k) => {
        const { point, owner } = vertices[k], head = headOwner(owner), base = deform(point, head), epsilon = 1e-4;
        const columns = [new Vector3(epsilon, 0, 0), new Vector3(0, epsilon, 0), new Vector3(0, 0, epsilon)].map(delta => deform(point.clone().add(delta), head).sub(base).divideScalar(epsilon));
        const jacobian = new Matrix3().set(columns[0].x, columns[1].x, columns[2].x, columns[0].y, columns[1].y, columns[2].y, columns[0].z, columns[1].z, columns[2].z).invert().transpose();
        normal.setElement(id, new Vector3().fromArray(originalNormal.getElement(id, [])).applyMatrix3(intoWorld).applyMatrix3(jacobian).applyMatrix3(fromWorld).normalize().toArray());
      });
      primitive.setAttribute('NORMAL', normal).getAttribute('TANGENT') && primitive.setAttribute('TANGENT', null);
    }
  }
  for (const skin of document.getRoot().listSkins()) {
    const matrices = new Float32Array(skin.listJoints().length * 16);
    skin.listJoints().forEach((n, i) => world(n).invert().toArray(matrices, i * 16));
    skin.setInverseBindMatrices(skin.getInverseBindMatrices()!.clone().setArray(matrices));
  }
  adoptStandingBind(document);
  const after = measureFigure(document, rootName);
  return { before: before.ratios, after: after.ratios, target, headBottomBefore: before.head.y, headBottomAfter: after.head.y, widthScale: width };
}
