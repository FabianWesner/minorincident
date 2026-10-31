import type { Document, Node, Primitive } from '@gltf-transform/core';
import { Matrix4, Vector3 } from 'three';
import { measureFigure } from '../assets/figure-proportions';

export const shortName = (name: string) => name.replace(/^survivor\d+_/, '');
export const worldMatrix = (node: Node) => new Matrix4().fromArray(node.getWorldMatrix());
const ignored = /stump|skin_eyes|iris|pupil|clipboard|rifle|weapon|shield|baton|cane|spatula|cushion|restOnly/i;
export interface Vertex { bindPoint?: Vector3; rigid?: boolean; id: number; point: Vector3; owner: string; jointOwner?: string; influences: { name: string; weight: number }[]; shapeInfluences?: { name: string; weight: number }[] }
export interface Surface { node: Node; primitive: Primitive; vertices: Vertex[] }
export function nodesOf(document: Document, rootName?: string): Node[] {
  if (!rootName) return document.getRoot().listNodes();
  const root = document.getRoot().listNodes().find(n => n.getName() === rootName);
  if (!root) throw Error(`Missing ${rootName}`);
  const nodes: Node[] = []; root.traverse(n => nodes.push(n)); return nodes;
}
function rigidOwner(node: Node) {
  for (let n: Node | null = node; n; n = n.getParentNode()) if (/^(hip|torso|spine|chest|clavicle[LR]|head|neck|arm[LR]|foreArm[LR]|hand[LR]|leg[LR]|shin[LR]|foot[LR]|backpackSocket)$/.test(shortName(n.getName()))) return shortName(n.getName());
  return shortName(node.getName());
}
export function surfacesOf(document: Document, rootName?: string, includeHidden = false): Surface[] {
  const nodes = nodesOf(document, rootName), crawler = nodes.some(n => n.getExtras().q249HeadProfile === 'crawler');
  const surfaces: Surface[] = nodes.filter(n => n.getMesh() && (includeHidden || !ignored.test(n.getName()) && !n.getExtras().hidden)).flatMap(node => node.getMesh()!.listPrimitives().map(primitive => {
    const nodeMatrix = worldMatrix(node), pos = primitive.getAttribute('POSITION')!, ji = primitive.getAttribute('JOINTS_0'), we = primitive.getAttribute('WEIGHTS_0'), skin = node.getSkin(), index = primitive.getIndices();
    const matrices = skin?.listJoints().map((joint, i) => worldMatrix(joint).multiply(new Matrix4().fromArray(skin.getInverseBindMatrices()!.getElement(i, []))));
    const ids = index ? [...new Set(Array.from({ length: index.getCount() }, (_, i) => index.getScalar(i)))] : Array.from({ length: pos.getCount() }, (_, i) => i);
    return { node, primitive, vertices: ids.map(id => {
      const raw = new Vector3().fromArray(pos.getElement(id, [])), completeHead = !!primitive.getAttribute('_Q249_HEAD')?.getScalar(id) || (primitive.getAttribute('_Q249_WEIGHT')?.getScalar(id) ?? 0) > .05 || crawler && raw.x > .18 && raw.y > .36;
      if (!skin || !ji || !we || !matrices) return { rigid: true, id, point: raw.applyMatrix4(nodeMatrix), owner: completeHead ? 'head' : rigidOwner(node), influences: [{ name: rigidOwner(node), weight: 1 }] };
      const js = ji.getElement(id, []) as number[], ws = we.getElement(id, []) as number[];
      const influences = js.map((j, k) => ({ name: shortName(skin.listJoints()[j].getName()), weight: ws[k] }));
      const point = new Vector3(); for (let k = 0; k < ws.length; k++) if (ws[k]) point.add(raw.clone().applyMatrix4(matrices[js[k]]).multiplyScalar(ws[k]));
      return { id, point, owner: completeHead ? 'head' : influences[ws.indexOf(Math.max(...ws))].name, influences };
    }) };
  }));
  const jointPoints = new Map(nodes.map(n => [n.getName(), new Vector3().setFromMatrixPosition(worldMatrix(n))]));
  const pointOf = (name: string) => jointPoints.get(name)?.clone();
  const hip = pointOf('hip'), armL = pointOf('armL'), armR = pointOf('armR');
  if (hip && armL && armR) {
    const shoulder = armL.clone().add(armR).multiplyScalar(.5), height = Math.max(...surfaces.flatMap(s => s.vertices.map(v => v.point.y))) - Math.min(...surfaces.flatMap(s => s.vertices.map(v => v.point.y)));
    const bodyAxis = shoulder.clone().sub(hip).normalize(), halfShoulder = Math.abs(armL.z - armR.z) / 2;
    const courierBag = nodes.some(n => /^char[.]courier-/.test(String(n.getExtras().asset_id ?? '')));
    const chains = ['L', 'R'].flatMap(side => [['arm', 'foreArm'], ['foreArm', 'hand']].flatMap(([part, end]) => { const a = pointOf(part + side), b = pointOf(end + side); if (!a || !b) return []; const axis = b.sub(a), length = axis.length(); return [{ name: part + side, start: a, axis: axis.normalize(), length }]; }));
    for (const surface of surfaces) for (const vertex of surface.vertices) {
      vertex.jointOwner = vertex.owner;
      if (!/^(hip|torso|spine|chest)$/.test(vertex.owner)) continue;
      const p = vertex.point;
      if (courierBag && p.x < hip.x - height * .08) { vertex.owner = 'backpackSocket'; continue; }
      const bodyDelta = p.clone().sub(hip), bodyDistance = bodyDelta.addScaledVector(bodyAxis, -bodyDelta.dot(bodyAxis)).length();
      if (Math.abs(p.z - hip.z) < halfShoulder * .70 && p.x < hip.x + height * .08) continue;
      let nearest: { name: string; distance: number } | undefined;
      for (const chain of chains) {
        const d = p.clone().sub(chain.start), t = d.dot(chain.axis) / chain.length;
        if (t < -.05 || t > 1.05) continue;
        const distance = d.addScaledVector(chain.axis, -d.dot(chain.axis)).length();
        if (distance < bodyDistance * .65 && distance < height * .075 && (!nearest || distance < nearest.distance)) nearest = { name: chain.name, distance };
      }
      if (nearest) { vertex.owner = nearest.name; vertex.shapeInfluences = [{ name: nearest.name, weight: 1 }]; }
    }
  }
  return surfaces;
}
export type BuildReference = Map<string, {owner:string;jointOwner?:string;point:Vector3}>;
const surfacePrefix = (document:Document, surface:Surface) => `${document.getRoot().listNodes().indexOf(surface.node)}:${surface.node.getMesh()!.listPrimitives().indexOf(surface.primitive)}:`;
export function referenceBuild(document:Document,rootName?:string):BuildReference {
  const reference:BuildReference=new Map();for(const surface of surfacesOf(document,rootName)){const prefix=surfacePrefix(document,surface);for(const v of surface.vertices)reference.set(prefix+v.id,{owner:v.owner,jointOwner:v.jointOwner,point:v.point.clone()});}return reference;
}
const quantile = (values: number[], f: number) => { const xs = values.filter(Number.isFinite).sort((a, b) => a - b); return xs.length ? xs[Math.round((xs.length - 1) * f)] : NaN; };
export const extent = (vertices: Vertex[], axis: 'x' | 'y' | 'z', tail = .02) => quantile(vertices.map(v => v.point[axis]), 1 - tail) - quantile(vertices.map(v => v.point[axis]), tail);
export const keys = ['upperArmRadius', 'forearmRadius', 'thighRadius', 'calfRadius', 'torsoWidth', 'torsoDepth', 'shoeLength', 'shoeHeight'] as const;
export type Ratios = Record<typeof keys[number], number>;
export function measureBuild(document: Document, rootName?: string, reference?:BuildReference) {
  const nodes = nodesOf(document, rootName), surfaces = surfacesOf(document, rootName), vertices = surfaces.flatMap(s => s.vertices), figure = measureFigure(document, rootName);
  if(reference)for(const surface of surfaces){const prefix=surfacePrefix(document,surface);for(const v of surface.vertices){const old=reference.get(prefix+v.id);if(!old)throw Error('Missing anatomical reference vertex');v.owner=old.owner;v.jointOwner=old.jointOwner;v.bindPoint=old.point;}}
  const joint = (name: string) => { const n = nodes.find(n => shortName(n.getName()) === name); if (!n) throw Error(`Missing ${name}`); return new Vector3().setFromMatrixPosition(worldMatrix(n)); };
  const spatialFallbacks: string[] = [];
  const radius = (part: string, end: string) => { const values = ['L', 'R'].map(side => {
    const start = joint(part + side), axis = joint(end + side).sub(start), length = axis.length(); axis.normalize();
    const samples = vertices.filter(v => (v.jointOwner ?? v.owner) === part + side || (part === 'foreArm' && (v.jointOwner ?? v.owner) === 'foreArmTwist' + side)).filter(v => { const t = (v.bindPoint ?? v.point).clone().sub(start).dot(axis) / length; return t >= .4 && t <= .6; });
    let available = samples.length ? samples : vertices.filter(v => (v.jointOwner ?? v.owner) === part + side);
    if (!available.length) {
      const other = joint(part + (side === 'L' ? 'R' : 'L')), otherAxis = joint(end + (side === 'L' ? 'R' : 'L')).sub(other).normalize();
      available = vertices.filter(v => {
        if (/head|hand|backpack|pony/.test(v.owner)) return false;
        const d = (v.bindPoint ?? v.point).clone().sub(start), t = d.dot(axis) / length, r = d.addScaledVector(axis, -d.dot(axis)).length();
        const od = (v.bindPoint ?? v.point).clone().sub(other), opposite = od.addScaledVector(otherAxis, -od.dot(otherAxis)).length();
        return t >= .4 && t <= .6 && r < figure.height * .14 && r < opposite;
      });
      if (available.length) spatialFallbacks.push(part + side);
    }
    return quantile(available.map(v => { const d = v.point.clone().sub(start); return d.addScaledVector(axis, -d.dot(axis)).length(); }), .95);
  }).filter(Number.isFinite); return values.length ? Math.max(...values) : NaN; };
  const hip = joint('hip'), shoulderY = (joint('armL').y + joint('armR').y) / 2;
  const torsoBand = [hip.y + .2 * (shoulderY - hip.y), hip.y + .4 * (shoulderY - hip.y)];
  let torso = vertices.filter(v => /^(hip|torso|spine|chest)$/.test(v.owner) && (v.bindPoint ?? v.point).y >= torsoBand[0] && (v.bindPoint ?? v.point).y <= torsoBand[1]);
  if (torso.length < 5) torso = vertices.filter(v => /^(torso|spine)$/.test(v.owner));
  const shoes = ['L', 'R'].map(side => vertices.filter(v => v.owner === 'foot' + side || v.owner === 'toe' + side));
  const dimensions = { upperArmRadius: radius('arm', 'foreArm'), forearmRadius: radius('foreArm', 'hand'), thighRadius: radius('leg', 'shin'), calfRadius: radius('shin', 'foot'), torsoWidth: extent(torso, 'z'), torsoDepth: extent(torso, 'x'), shoeLength: Math.max(...shoes.map(s => extent(s, 'x'))), shoeHeight: Math.max(...shoes.map(s => extent(s, 'y'))) };
  const ratios = Object.fromEntries(keys.map(k => [k, dimensions[k] / figure.height])) as Ratios;
  if (!Number.isFinite(figure.height) || figure.height <= 0) throw Error('Invalid figure height');
  return { heightM: figure.height, groundM: figure.ground, ratios, dimensions, torsoBand, shoulderY, spatialFallbacks, absentParts: keys.filter(k => !Number.isFinite(ratios[k])) };
}
