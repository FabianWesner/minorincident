import { preserveTinyTriangles } from './triangle-area';
import type { Document } from '@gltf-transform/core';
import { Matrix3, Matrix4, Vector3 } from 'three';
import { measureFigure } from '../assets/figure-proportions';
import { keys, measureBuild, referenceBuild, nodesOf, shortName, surfacesOf, worldMatrix, type Ratios, type Vertex } from './anatomy';

export type Scales = Record<typeof keys[number], number> & { shoulderGuard?: boolean; shoulderReference?: number };
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
export function planBuild(before: Ratios, target: Ratios): Scales {
  return Object.fromEntries(keys.map(k => [k, Number.isFinite(before[k]) && before[k] > 0 ? Math.max(/Radius/.test(k) ? .65 : .45, Math.min(1, target[k] * 1.12 / before[k])) : 1])) as Record<typeof keys[number], number>;
}
/** Offline vertex edit. Bones, inverse binds, UVs, joint indices and weights stay exact. */
export function slimBuild(doc: Document, scales: Scales, rootName?: string) {
  const reference = referenceBuild(doc,rootName);
  const nodes = nodesOf(doc, rootName), figure = measureFigure(doc, rootName), before = measureBuild(doc, rootName);
  const surfaces = surfacesOf(doc, rootName, true), visible = surfacesOf(doc, rootName).flatMap(s => s.vertices);
  const jointPoints = new Map(nodes.map(n => [shortName(n.getName()), new Vector3().setFromMatrixPosition(worldMatrix(n))]));
  const joint = (name: string) => { const p = jointPoints.get(name); if (!p) throw Error(`Missing joint ${name}`); return p.clone(); };
  const hip = joint('hip'), shoulder = before.shoulderY;
  const shoulderReference = scales.shoulderReference ?? figure.height;
  const protectedShoulderWidth = measureFigure(doc, rootName, shoulderReference).shoulderWidth;
  const protectShoulders = scales.shoulderGuard || measureFigure(doc, rootName, shoulderReference).ratios.headShoulder > .959122 * .9;
  const shoeBounds = Object.fromEntries(['L', 'R'].map(side => {
    const points = visible.filter(v => v.owner === `foot${side}` || v.owner === `toe${side}`).map(v => v.point);
    return [side, points.length ? { centre: new Vector3((Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2, figure.ground, (Math.min(...points.map(p => p.z)) + Math.max(...points.map(p => p.z))) / 2) } : undefined];
  }));
  const deform = (v: Vertex, p: Vector3) => {
    if (/^(head|neck|eye|iris|pony|hair|hand|weapon|backpack)/.test(v.owner)) return p.clone();
    const result = p.clone();
    for (const influence of v.shapeInfluences ?? v.influences) {
      const name = influence.name, side = name.slice(-1), w = influence.weight;
      if (!w) continue;
      if (/^(hip|torso|spine|chest)$/.test(name)) {
        const top = smooth((shoulder + figure.height * .02 - p.y) / (figure.height * .12));
        const fade = top * (v.rigid ? smooth((p.y - hip.y) / (figure.height * .06)) : smooth((p.y - hip.y + figure.height * .25) / (figure.height * .25)));
        result.add(new Vector3((p.x - hip.x) * (scales.torsoDepth - 1), 0, (p.z - hip.z) * (scales.torsoWidth - 1)).multiplyScalar(w * fade));
        continue;
      }
      const part = /^arm[LR]$|^elbow[LR]$/.test(name) ? ['arm', 'foreArm', 'upperArmRadius'] : /^foreArm(?:Twist)?[LR]$/.test(name) ? ['foreArm', 'hand', 'forearmRadius'] : /^leg[LR]$/.test(name) ? ['leg', 'shin', 'thighRadius'] : /^shin[LR]$|^knee[LR]$/.test(name) ? ['shin', 'foot', 'calfRadius'] : undefined;
      if (part) {
        const start = joint(part[0] + side), end = joint(part[1] + side), axis = end.clone().sub(start), length = axis.length(); axis.normalize();
        const d = p.clone().sub(start), axial = d.dot(axis);
        const shoulderKeep = protectShoulders ? smooth((shoulder - shoulderReference * .1001 - p.y) / (figure.height * .04)) : 1;
        const segment = v.rigid ? smooth(axial / length / .20) * smooth((1 - axial / length) / .20) : part[0] === 'arm' ? smooth(axial / length / .15) : 1;
        const fade = segment * shoulderKeep;
        result.addScaledVector(d.addScaledVector(axis, -axial), (scales[part[2] as typeof keys[number]] - 1) * w * fade);
        continue;
      }
      if (/^(foot|toe)[LR]$/.test(name) && shoeBounds[side]) {
        const centre = shoeBounds[side]!.centre, d = p.clone().sub(centre);
        const ankle = joint('foot' + side), keep = v.rigid ? smooth((p.y - ankle.y + figure.height * .02) / (figure.height * .03)) * (1 - smooth((Math.abs(p.x - ankle.x) - figure.height * .025) / (figure.height * .04))) : 0;
        result.add(new Vector3(d.x * (scales.shoeLength - 1), d.y * (scales.shoeHeight - 1), d.z * (Math.min(scales.shoeLength, scales.shoeHeight) - 1)).multiplyScalar(w * (1 - keep)));
      }
    }
    // Keep the authored standing envelope exact, including sole vertices with
    // a small calf influence, while radial edits retain every bone length.
    if (p.y <= figure.ground + .00001 || p.y >= figure.ground + figure.height - .00001) result.y = p.y;
    result.y = Math.max(figure.ground, Math.min(figure.ground + figure.height, result.y));
    if (scales.shoulderGuard) {
      const edge = smooth((Math.abs(p.z - figure.headCentreZ) - protectedShoulderWidth * .28) / (protectedShoulderWidth * .10));
      const band = smooth((p.y - (shoulder - shoulderReference * .10) + figure.height * .025) / (figure.height * .025));
      result.lerp(p, edge * band);
    }
    return result;
  };
  // UV and hard-normal splits must receive the same displacement at a shared
  // bind point, even where the exporter rounded their skin weights differently.
  const pointKey = (p: Vector3) => p.toArray().map(x => Math.round(x * 1e5)).join(',');
  const isFixed = (v: Vertex) => /^(head|neck|eye|iris|pony|hair|hand|weapon|backpack)/.test(v.owner);
  const welded = new Map<string, { point: Vector3; count: number; fixed: boolean }>();
  for (const { vertices } of surfaces) for (const v of vertices) {
    const key = pointKey(v.point), entry = welded.get(key) ?? { point: new Vector3(), count: 0, fixed: false };
    if (isFixed(v)) { entry.point.copy(v.point); entry.fixed = true; }
    else if (!entry.fixed) entry.point.add(deform(v, v.point));
    entry.count++; welded.set(key, entry);
  }
  for (const entry of welded.values()) if (!entry.fixed) entry.point.divideScalar(entry.count);
  for (const { node, primitive, vertices } of surfaces) {
    const position = primitive.getAttribute('POSITION')!, output = position.clone().setArray(new Float32Array(position.getCount() * 3)).setNormalized(false), normal = primitive.getAttribute('NORMAL'), normals = normal?.clone().setArray(normal.getArray()!.slice());
    for (let i = 0; i < position.getCount(); i++) output.setElement(i, position.getElement(i, []));
    if (normal && normals) for (let i = 0; i < normal.getCount(); i++) normals.setElement(i, normal.getElement(i, []));
    const skin = node.getSkin(), indices = primitive.getAttribute('JOINTS_0'), weights = primitive.getAttribute('WEIGHTS_0');
    const bindMatrices = skin?.listJoints().map((n, i) => worldMatrix(n).multiply(new Matrix4().fromArray(skin.getInverseBindMatrices()!.getElement(i, []))));
    for (const v of vertices) {
      if (isFixed(v)) continue;
      let into = worldMatrix(node);
      if (bindMatrices && indices && weights) {
        into = new Matrix4(); into.elements.fill(0); const js = indices.getElement(v.id, []) as number[], ws = weights.getElement(v.id, []) as number[];
        for (let k = 0; k < ws.length; k++) if (ws[k]) for (let j = 0; j < 16; j++) into.elements[j] += bindMatrices[js[k]].elements[j] * ws[k];
      }
      const from = into.clone().invert(), after = welded.get(pointKey(v.point))!.point.clone(); output.setElement(v.id, after.applyMatrix4(from).toArray());
      if (normal && normals) {
        const p = deform(v, v.point), e = 1e-4;
        const cols = [new Vector3(e, 0, 0), new Vector3(0, e, 0), new Vector3(0, 0, e)].map(d => deform(v, v.point.clone().add(d)).sub(p).divideScalar(e));
        const jac = new Matrix3().set(cols[0].x, cols[1].x, cols[2].x, cols[0].y, cols[1].y, cols[2].y, cols[0].z, cols[1].z, cols[2].z).invert().transpose();
        const n = new Vector3().fromArray(normal.getElement(v.id, [])).applyMatrix3(new Matrix3().getNormalMatrix(into)).applyMatrix3(jac).applyMatrix3(new Matrix3().getNormalMatrix(from)).normalize();
        // The exact sole-height clamp has a singular Jacobian. Its authored
        // sole normal remains valid; a zero normal would poison HDR lighting.
        if (!n.toArray().every(Number.isFinite) || n.lengthSq() < 1e-12) n.fromArray(normal.getElement(v.id, [])).normalize();
        normals.setElement(v.id, n.toArray());
      }
    }
    primitive.setAttribute('POSITION', output); preserveTinyTriangles(primitive, position); if (normals) primitive.setAttribute('NORMAL', normals);
  }
  return { before, after: measureBuild(doc, rootName, reference), scales };
}
