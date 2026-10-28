/** Small source repairs, replayed by the shared builder: eyes, ivory and the omitted elephant tail. */
import type { Document } from '@gltf-transform/core';
import { getBounds, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { PNG } from 'pngjs';
import { Matrix4, Vector3 } from 'three';
import { assetIO } from './io';

type Fit = { scale: number; yaw: number; translation: number[] };
export type TuskRecipe = { capsules: { a: number[]; b: number[]; radius: number }[] };
/** Paint only UV triangle interiors. No dilation can reach another island (L6 bandage lesson). */
export function paintAnimalDetails(document: Document, naturalEyes: boolean, tusks?: TuskRecipe, fit?: Fit, healEyeMasks = false) {
  const body = document.getRoot().listNodes().find(n => n.getName() === 'skin_body')!;
  const primitive = body.getMesh()!.listPrimitives()[0], texture = primitive.getMaterial()!.getBaseColorTexture()!;
  if (texture.getMimeType() !== 'image/png') throw Error('Animal detail painting requires the uncompressed source PNG');
  const png = PNG.sync.read(Buffer.from(texture.getImage()!)), position = primitive.getAttribute('POSITION')!, uv = primitive.getAttribute('TEXCOORD_0')!, indices = primitive.getIndices();
  const eyes = document.getRoot().listNodes().find(n => n.getName() === 'skin_eyes')!.getMesh()!.listPrimitives()[0].getAttribute('POSITION')!;
  if (naturalEyes && eyes.getCount() !== 12) throw Error('Natural animal eyes require two measured eye quads');
  const centres = naturalEyes ? [0, 1].map(side => {
    const centre = new Vector3(); for (let k = 0; k < 6; k++) centre.add(new Vector3().fromArray(eyes.getElement(side * 6 + k, [])));
    return centre.multiplyScalar(1 / 6);
  }) : [];
  const height = position.getMax([])[1] - position.getMin([])[1], radius = Math.max(.025, height * .0145), eyeTexels = [0, 0];
  const inverse = fit ? new Matrix4().makeRotationY(fit.yaw * Math.PI / 180).scale(new Vector3(fit.scale, fit.scale, fit.scale)).setPosition(new Vector3().fromArray(fit.translation)).invert() : new Matrix4();
  const capsules = tusks?.capsules.map(c => ({ a: new Vector3().fromArray(c.a), b: new Vector3().fromArray(c.b), radius: c.radius })) ?? [];
  const point = new Vector3(), local = new Vector3(), nearest = new Vector3(), axis = new Vector3();
  let ivoryTexels = 0, bleedTexels = 0, healedTexels = 0;
  // Healing a dark source mask needs colour in its UV gutters too. Reserve
  // every island first, so padding can never overwrite another surface.
  const owner = new Int32Array(png.width * png.height).fill(-1);
  if (healEyeMasks) for (let t = 0; t < (indices?.getCount() ?? position.getCount()); t += 3) {
    const u = [0, 1, 2].map(k => uv.getElement(indices ? indices.getScalar(t + k) : t + k, []).map((v, c) => v * (c ? png.height : png.width) - .5));
    const area = (u[1][0] - u[0][0]) * (u[2][1] - u[0][1]) - (u[2][0] - u[0][0]) * (u[1][1] - u[0][1]); if (Math.abs(area) < 1e-9) continue;
    for (let y = Math.max(0, Math.ceil(Math.min(...u.map(v => v[1])))); y <= Math.min(png.height - 1, Math.floor(Math.max(...u.map(v => v[1])))); y++) for (let x = Math.max(0, Math.ceil(Math.min(...u.map(v => v[0])))); x <= Math.min(png.width - 1, Math.floor(Math.max(...u.map(v => v[0])))); x++) {
      const w1 = ((x - u[0][0]) * (u[2][1] - u[0][1]) - (y - u[0][1]) * (u[2][0] - u[0][0])) / area, w2 = ((u[1][0] - u[0][0]) * (y - u[0][1]) - (u[1][1] - u[0][1]) * (x - u[0][0])) / area;
      if (Math.min(1 - w1 - w2, w1, w2) >= -1e-6) owner[y * png.width + x] = t;
    }
  }
  for (let t = 0; t < (indices?.getCount() ?? position.getCount()); t += 3) {
    const ids = [0, 1, 2].map(k => indices ? indices.getScalar(t + k) : t + k), p = ids.map(i => position.getElement(i, [])), u = ids.map(i => uv.getElement(i, []).map((v, c) => v * (c ? png.height : png.width) - .5));
    const area = (u[1][0] - u[0][0]) * (u[2][1] - u[0][1]) - (u[2][0] - u[0][0]) * (u[1][1] - u[0][1]); if (Math.abs(area) < 1e-9) continue;
    const padding = healEyeMasks ? 2 : 0;
    const lo = [0, 1].map(c => Math.max(0, Math.ceil(Math.min(...u.map(v => v[c]))) - padding)), hi = [0, 1].map(c => Math.min((c ? png.height : png.width) - 1, Math.floor(Math.max(...u.map(v => v[c]))) + padding));
    for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) {
      const w1 = ((x - u[0][0]) * (u[2][1] - u[0][1]) - (y - u[0][1]) * (u[2][0] - u[0][0])) / area, w2 = ((u[1][0] - u[0][0]) * (y - u[0][1]) - (u[1][1] - u[0][1]) * (x - u[0][0])) / area, w0 = 1 - w1 - w2;
      let weights = [w0, w1, w2];
      if (healEyeMasks) {
        const owned = owner[y * png.width + x]; if (owned !== -1 && owned !== t) continue;
        if (weights.some((w, k) => w * Math.abs(area) < -1.5 * Math.hypot(u[(k + 1) % 3][0] - u[(k + 2) % 3][0], u[(k + 1) % 3][1] - u[(k + 2) % 3][1]))) continue;
        weights = weights.map(w => Math.max(0, w)); const total = weights.reduce((a, b) => a + b, 0); weights = weights.map(w => w / total);
      } else if (Math.min(w0, w1, w2) < -1e-6) continue;
      point.set(...[0, 1, 2].map(c => p[0][c] * weights[0] + p[1][c] * weights[1] + p[2][c] * weights[2]) as [number, number, number]);
      const pixel = (y * png.width + x) * 4; let colour: number[] | undefined;
      if (capsules.length) {
        local.copy(point).applyMatrix4(inverse);
        const onTusk = capsules.some(c => { axis.subVectors(c.b, c.a); const along = Math.max(0, Math.min(1, nearest.subVectors(local, c.a).dot(axis) / axis.lengthSq())); nearest.copy(c.a).addScaledVector(axis, along); return local.distanceTo(nearest) < c.radius; });
        if (onTusk) { colour = [238, 234, 210]; ivoryTexels++; }
        else if (local.y > -.01 && local.y < .18 && local.z > .18 && Math.abs(local.x) < .24 && png.data[pixel] > 185 && png.data[pixel + 1] > 180 && png.data[pixel + 2] > 150 && png.data[pixel] - png.data[pixel + 2] > 12 && png.data[pixel + 1] - png.data[pixel + 2] > 8) { colour = [145, 139, 150]; bleedTexels++; }
      }
      for (let side = 0; side < centres.length; side++) {
        const distance = point.distanceTo(centres[side]);
        if (healEyeMasks && distance < Math.max(.08, radius * 4) && png.data[pixel] < 100 && png.data[pixel + 1] < 120) { colour = [216, 116, 153]; healedTexels++; }
        if (distance < radius) { colour = distance < radius * .52 ? [18, 21, 24] : [239, 235, 218]; eyeTexels[side]++; }
      }
      if (colour) for (let c = 0; c < 3; c++) png.data[pixel + c] = colour[c];
    }
  }
  if (naturalEyes && eyeTexels.some(n => n < 2)) throw Error(`Natural animal pupil disappeared: ${eyeTexels}`);
  texture.setImage(PNG.sync.write(png)); return { eyeTexels, ivoryTexels, bleedTexels, healedTexels };
}

/** Preserve the authored tail's shape and existing tail joint when the reconstruction omitted it. */
export async function restoreElephantTail(path: string, source: string, lod: number): Promise<void> {
  const io = await assetIO(), document = await io.read(path), old = await io.read(source);
  const tail = old.getRoot().listNodes().find(n => n.getName() === 'tail'); if (!tail) throw Error('Elephant contract has no tail');
  const selected = new Set<typeof tail>(); tail.traverse(n => selected.add(n));
  for (const n of old.getRoot().listNodes()) if (!selected.has(n)) n.setMesh(null);
  if (lod) { await MeshoptSimplifier.ready; await old.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: lod === 2 ? .08 : .4, error: lod === 2 ? .1 : .02 })); }
  const skin = document.getRoot().listSkins()[0], joint = skin.listJoints().findIndex(n => n.getName() === 'tail'); if (joint < 0) throw Error('New elephant has no tail skin joint');
  const alignment = new Matrix4().fromArray(skin.listJoints()[joint].getWorldMatrix()).multiply(new Matrix4().fromArray(tail.getWorldMatrix()).invert());
  const mesh = document.createMesh('retained_elephant_tail'), material = document.createMaterial('pal_sidewalk').setRoughnessFactor(1);
  const point = new Vector3(), normal = new Vector3(); let triangles = 0;
  for (const node of selected) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const p = primitive.getAttribute('POSITION')!, n = primitive.getAttribute('NORMAL')!, index = primitive.getIndices(), matrix = new Matrix4().fromArray(node.getWorldMatrix()).premultiply(alignment), positions: number[] = [], normals: number[] = [], colours: number[] = [];
    const colour = primitive.getMaterial()!.getBaseColorFactor().slice(0, 3), count = index?.getCount() ?? p.getCount();
    for (let i = 0; i < count; i++) { const v = index ? index.getScalar(i) : i; point.fromArray(p.getElement(v, [])).applyMatrix4(matrix).toArray(positions, positions.length); normal.fromArray(n.getElement(v, [])).transformDirection(matrix).toArray(normals, normals.length); colours.push(...colour); }
    const vertices = positions.length / 3, joints = new Uint16Array(vertices * 4), weights = new Float32Array(vertices * 4); for (let i = 0; i < vertices; i++) { joints[i * 4] = joint; weights[i * 4] = 1; }
    const result = document.createPrimitive().setMaterial(material);
    for (const [name, type, array] of [['POSITION', 'VEC3', new Float32Array(positions)], ['NORMAL', 'VEC3', new Float32Array(normals)], ['COLOR_0', 'VEC3', new Float32Array(colours)], ['TEXCOORD_0', 'VEC2', new Float32Array(vertices * 2)], ['JOINTS_0', 'VEC4', joints], ['WEIGHTS_0', 'VEC4', weights], ['_CROWD_PART', 'SCALAR', new Uint16Array(vertices).fill(joint)]] as const) result.setAttribute(name, document.createAccessor().setType(type).setArray(array));
    result.setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint32Array(Array.from({ length: vertices }, (_, i) => i)))); mesh.addPrimitive(result); triangles += vertices / 3;
  }
  if (!triangles) throw Error('Elephant contract tail has no surface');
  const body = document.getRoot().listNodes().find(n => n.getName() === 'skin_body')!; body.addChild(document.createNode('retained_elephant_tail').setMesh(mesh).setSkin(skin));
  // Tail attachment must be inside the new hindquarters, never a floating prop.
  const bounds = getBounds(body); if (!bounds.min.every(Number.isFinite)) throw Error('Invalid fitted elephant tail');
  await io.write(path, document);
}
