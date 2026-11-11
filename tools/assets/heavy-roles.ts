/**
 * r33-heavies: own skinned bodies for the heavy infected roles (brute, armored, butcher, screamer, bloated).
 *
 * Every role is derived from an existing, already shipped skinned infected look (same rig, joints, clip set, atlas classes):
 *   1. bind-pose proportion edits (per-joint radial/axial scales, belly bulge, open jaw), then one uniform scale of the
 *      whole rig (vertices, joint translations, inverse binds, sole bounds), so every crowd clip still drives it;
 *   2. extra solid pieces (plates, helmet, apron, cleaver, pustules ...) skinned 100 % to one joint and merged into the
 *      same skin_body primitive, painted from an 8-colour swatch strip appended to the bottom of the atlas;
 *   3. the tinted atlas classes (shirt/trousers/hair) are recoloured to the role's own colours and marked "authored" so the
 *      per-person crowd tint does not wash the identity out.
 * The result goes through compressSkin (KTX2 + meshopt) exactly like the other crowd looks, the manifest entry becomes a
 * crowdSkin asset, and the infected bake is written.
 *
 * Usage: node --import tsx tools/assets/heavy-roles.ts <role|all> [--preview <dir>] [--no-register]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Document, Node, Primitive } from '@gltf-transform/core';
import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Euler, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { PNG } from 'pngjs';
import { getBounds } from '@gltf-transform/functions';
import { assetIO } from './io';
import { compressSkin, decodeSkinImage } from './skin-crowd-compress';
import { skinCrowdBakes } from './skin-crowd-bakes';
import { validateAssets } from './validate';
import type { AssetDef } from '../../src/assets/types';

const BASIS = join('/Users/wesner/Workspace/minorincident_3dpipeline', 'vendor/basis-encoder-2.1');
const AUTHORED = 218; // alpha = (class 5 + 1) / 7
const STRIP = 32;     // swatch strip height (px) appended to the atlas

type V3 = [number, number, number];
const hex = (h: string): V3 => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export interface Piece { joint: string; centre: V3; size: V3; rot?: V3; shape: 'box' | 'sphere' | 'cone' | 'cyl'; colour: string; rel?: boolean; of?: string; lod?: number; seg?: number }
interface Deform { perp?: number; axial?: number; sx?: number; sy?: number; sz?: number }
interface Recolour { cls?: 'hair' | 'skin' | 'shirt' | 'trousers'; parts?: string[]; colour: string }
export interface Role {
  id: string; base: string; scale: number; deform: Record<string, Deform>;
  bulge?: { relativeToHip?: boolean; centre: V3; radius: number; amount: number; joints: string[] };
  jaw?: { drop: number; forward?: number; mouthDy: number; widthDz: number };
  tolerance?: number; drop?: string[]; recolour: Recolour[]; pieces: Piece[]; budget: { triangles: number; lod1: number; lod2: number };
}
const classIndex = { hair: 0, skin: 1, shirt: 2, trousers: 3 } as const;

// Pieces are authored in the BASE figure's world frame at rest (+X front, +Y up, +Z lateral), before the uniform scale.
// Joint positions of each base are printed by `--joints`; offsets here are relative to the named joint.
import { roles } from './heavy-roles-data';

const AXIS: Record<string, string> = { armL: 'foreArmL', foreArmL: 'handL', armR: 'foreArmR', foreArmR: 'handR', legL: 'shinL', shinL: 'footL', legR: 'shinR', shinR: 'footR' };

function jointFrames(doc: Document) {
  const skin = doc.getRoot().listSkins()[0], joints = skin.listJoints(), ibm = skin.getInverseBindMatrices()!;
  const pos = new Map<string, Vector3>(), idx = new Map<string, number>();
  joints.forEach((j, i) => { idx.set(j.getName(), i); pos.set(j.getName(), new Vector3().setFromMatrixPosition(new Matrix4().fromArray(ibm.getElement(i, [])).invert())); });
  return { skin, joints, ibm, pos, idx, names: joints.map(j => j.getName()) };
}

function applyDeform(p: Vector3, name: string, d: Deform, pos: Map<string, Vector3>): Vector3 {
  const a = pos.get(name)!;
  const q = p.clone().sub(a);
  const child = AXIS[name];
  if (child && (d.perp !== undefined || d.axial !== undefined)) {
    const axis = pos.get(child)!.clone().sub(a).normalize();
    const par = axis.clone().multiplyScalar(q.dot(axis)), perp = q.clone().sub(par);
    return a.clone().add(par.multiplyScalar(d.axial ?? 1)).add(perp.multiplyScalar(d.perp ?? 1));
  }
  return a.clone().add(new Vector3(q.x * (d.sx ?? d.perp ?? 1), q.y * (d.sy ?? d.axial ?? 1), q.z * (d.sz ?? d.perp ?? 1)));
}

function geometryFor(piece: Piece, lod: number): BufferGeometry {
  const seg = Math.max(3, Math.round((piece.seg ?? 8) * (lod === 0 ? 1 : lod === 1 ? .7 : .5)));
  const g = piece.shape === 'box' ? new BoxGeometry(1, 1, 1) : piece.shape === 'sphere' ? new SphereGeometry(.5, seg, Math.max(3, Math.round(seg * .7))) : piece.shape === 'cone' ? new ConeGeometry(.5, 1, seg) : new CylinderGeometry(.5, .5, 1, seg);
  return g.toNonIndexed();
}

async function loadBase(io: Awaited<ReturnType<typeof assetIO>>, base: string, lod: number): Promise<Document> {
  const doc = await io.read(`public/assets/models/skinned/${base}.lod${lod}.glb`);
  for (const t of doc.getRoot().listTextures()) if (t.getMimeType() === 'image/ktx2') {
    t.setImage(new Uint8Array(PNG.sync.write(await decodeSkinImage(t.getImage()!, 'image/ktx2', BASIS)))).setMimeType('image/png');
  }
  // meshopt-decoded accessors can be interleaved views; rewrite every accessor as a plain tightly packed array
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const all = [...prim.listSemantics().map(s => prim.getAttribute(s)!), ...(prim.getIndices() ? [prim.getIndices()!] : [])];
    for (const acc of all) {
      const size = acc.getElementSize(), Ctor = (acc.getNormalized() ? Float32Array : acc.getArray()!.constructor) as Float32ArrayConstructor, copy = new Ctor(acc.getCount() * size), tmp: number[] = [];
      for (let i = 0; i < acc.getCount(); i++) { acc.getElement(i, tmp); for (let k = 0; k < size; k++) copy[i * size + k] = tmp[k]; }
      acc.setNormalized(false).setArray(copy);
    }
  }
  return doc;
}

function readAttr(p: Primitive, sem: string): { arr: number[]; size: number } | undefined {
  const a = p.getAttribute(sem); if (!a) return undefined;
  const size = a.getElementSize(), out: number[] = [], tmp: number[] = [];
  for (let i = 0; i < a.getCount(); i++) { a.getElement(i, tmp); for (let k = 0; k < size; k++) out.push(tmp[k]); }
  return { arr: out, size };
}

export async function buildRole(role: Role, lod: number, io: Awaited<ReturnType<typeof assetIO>>): Promise<{ doc: Document; triangles: number }> {
  const doc = await loadBase(io, role.base, lod), root = doc.getRoot();
  const { skin, pos, idx, names, ibm } = jointFrames(doc);
  const bodyNode = root.listNodes().find(n => n.getName() === 'skin_body')!, body = bodyNode.getMesh()!.listPrimitives()[0];
  for (const n of root.listNodes()) if (role.drop?.includes(n.getName())) n.dispose();
  const skinned = root.listNodes().filter(n => n.getMesh() && n.getSkin());

  // 1. bind-pose proportion edits on every skinned primitive (body, eyes, stump caps)
  const pt = new Vector3();
  const origPos = readAttr(bodyNode.getMesh()!.listPrimitives()[0], 'POSITION')!.arr.slice();
  const boxes: Record<string, { min: V3; max: V3 }> = {};
  for (const node of skinned) for (const prim of node.getMesh()!.listPrimitives()) {
    const P = prim.getAttribute('POSITION')!, J = prim.getAttribute('JOINTS_0')!, W = prim.getAttribute('WEIGHTS_0')!;
    const e: number[] = [], j: number[] = [], w: number[] = [];
    for (let i = 0; i < P.getCount(); i++) {
      P.getElement(i, e); J.getElement(i, j); W.getElement(i, w);
      const p0 = new Vector3(e[0], e[1], e[2]); const out = new Vector3(); let total = 0;
      for (let k = 0; k < 4; k++) {
        if (!w[k]) continue; const name = names[j[k]], d = role.deform[name];
        out.add((d ? applyDeform(p0, name, d, pos) : p0.clone()).multiplyScalar(w[k])); total += w[k];
      }
      pt.copy(total ? out.multiplyScalar(1 / total) : p0);
      if (role.bulge) {
        const b = role.bulge, dom = names[j[w.indexOf(Math.max(...w))]];
        if (b.joints.includes(dom)) {
          const c = b.relativeToHip ? pos.get('hip')!.clone().add(new Vector3(...b.centre)) : new Vector3(...b.centre), dv = pt.clone().sub(c), r = dv.length() / b.radius;
          if (r < 1 && dv.x > -.02) pt.add(dv.normalize().multiplyScalar(b.amount * (1 - r * r) ** 1.5));
        }
      }
      if (role.jaw && node === bodyNode) {
        const dom = names[j[w.indexOf(Math.max(...w))]];
        if (dom === 'head') {
          const hp = pos.get('head')!, f = role.jaw, below = (hp.y + f.mouthDy) - pt.y;
          if (below > 0 && pt.x > hp.x - .01 && Math.abs(pt.z - hp.z) < f.widthDz) {
            const t = Math.min(1, below / .08);
            pt.y -= f.drop * t * (1 - Math.min(1, Math.abs(pt.z - hp.z) / f.widthDz) ** 2); pt.x += (f.forward ?? 0) * t;
          }
        }
      }
      P.setElement(i, [pt.x, pt.y, pt.z]);
      if (node === bodyNode) {
        const dom = names[j[w.indexOf(Math.max(...w))]], bb = (boxes[dom] ??= { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] });
        for (let a = 0; a < 3; a++) { bb.min[a] = Math.min(bb.min[a], pt.getComponent(a)); bb.max[a] = Math.max(bb.max[a], pt.getComponent(a)); }
      }
    }
  }
  // bind matrices follow only if joints moved: they do not (edits are in the mesh), so the inverse binds stay.

  // 2. extra pieces, appended to skin_body
  const attrs = { P: readAttr(body, 'POSITION')!, N: readAttr(body, 'NORMAL')!, T: readAttr(body, 'TEXCOORD_0')!, J: readAttr(body, 'JOINTS_0')!, W: readAttr(body, 'WEIGHTS_0')!, C: readAttr(body, '_CROWD_PART')! };
  const known = new Set(['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0', '_CROWD_PART']);
  const extra: Record<string, { arr: number[]; size: number }> = {};
  for (const sem of body.listSemantics()) if (!known.has(sem)) extra[sem] = readAttr(body, sem)!;
  const indexAcc = body.getIndices();
  const indices: number[] = indexAcc ? Array.from(indexAcc.getArray()!) : Array.from({ length: attrs.P.arr.length / 3 }, (_, i) => i);
  // Moved vertices keep stale normals (glassy shards on the bloated belly): rebuild them from the deformed surface, welded by position.
  {
    const acc = new Map<string, number[]>(), key = (i: number) => [0, 1, 2].map(a => Math.round(attrs.P.arr[i * 3 + a] * 2000)).join(',');
    const v = (i: number) => new Vector3(attrs.P.arr[i * 3], attrs.P.arr[i * 3 + 1], attrs.P.arr[i * 3 + 2]);
    for (let t = 0; t + 2 < indices.length; t += 3) {
      const [a, b, c] = [v(indices[t]), v(indices[t + 1]), v(indices[t + 2])], n = b.clone().sub(a).cross(c.clone().sub(a));
      for (const i of [indices[t], indices[t + 1], indices[t + 2]]) { const k = key(i), cur = acc.get(k) ?? [0, 0, 0]; cur[0] += n.x; cur[1] += n.y; cur[2] += n.z; acc.set(k, cur); }
    }
    let fixed = 0;
    for (let i = 0; i < attrs.P.arr.length / 3; i++) {
      const moved = Math.hypot(attrs.P.arr[i * 3] - origPos[i * 3], attrs.P.arr[i * 3 + 1] - origPos[i * 3 + 1], attrs.P.arr[i * 3 + 2] - origPos[i * 3 + 2]);
      const sum = acc.get(key(i)); if (moved < .012 || !sum) continue;
      const len = Math.hypot(sum[0], sum[1], sum[2]); if (len < 1e-12) continue;
      attrs.N.arr[i * 3] = sum[0] / len; attrs.N.arr[i * 3 + 1] = sum[1] / len; attrs.N.arr[i * 3 + 2] = sum[2] / len; fixed++;
    }
    void fixed;
  }
  const texture = body.getMaterial()!.getBaseColorTexture()!;
  const png = PNG.sync.read(Buffer.from(texture.getImage()!));
  const H = png.height, H2 = H + STRIP;
  // existing UVs: v measured from the top, strip appended at the bottom
  for (let i = 0; i < attrs.T.arr.length / 2; i++) attrs.T.arr[i * 2 + 1] *= H / H2;
  const swatches: string[] = [...new Set(role.pieces.map(p => p.colour))];
  const sw = Math.floor(png.width / STRIP);
  if (swatches.length > sw) throw Error('too many swatch colours');
  for (const piece of role.pieces) {
    if (piece.lod !== undefined && lod > piece.lod) continue;
    const g = geometryFor(piece, lod);
    let centre = piece.centre, size = piece.size;
    if (piece.rel) {
      const bb = boxes[piece.of ?? piece.joint]; if (!bb) throw Error(`no vertices owned by ${piece.of ?? piece.joint}`);
      const dim = [0, 1, 2].map(a => bb.max[a] - bb.min[a]);
      centre = [0, 1, 2].map(a => bb.min[a] + piece.centre[a] * dim[a]) as V3; size = [0, 1, 2].map(a => piece.size[a] * dim[a]) as V3;
    }
    const m = new Matrix4().compose(new Vector3(...centre), new Quaternion().setFromEuler(new Euler(...(piece.rot ?? [0, 0, 0]))), new Vector3(...size));
    g.applyMatrix4(m);
    const pp = g.getAttribute('position'), nn = g.getAttribute('normal');
    const si = swatches.indexOf(piece.colour), u = (si * STRIP + STRIP / 2) / png.width, v = (H + STRIP / 2) / H2;
    const n0 = attrs.P.arr.length / 3, jointIndex = idx.get(piece.joint);
    if (jointIndex === undefined) throw Error(`unknown joint ${piece.joint}`);
    for (let i = 0; i < pp.count; i++) {
      attrs.P.arr.push(pp.getX(i), pp.getY(i), pp.getZ(i)); attrs.N.arr.push(nn.getX(i), nn.getY(i), nn.getZ(i));
      attrs.T.arr.push(u, v); attrs.J.arr.push(jointIndex, 0, 0, 0); attrs.W.arr.push(1, 0, 0, 0); attrs.C.arr.push(jointIndex); indices.push(n0 + i);
    }
    for (const o of Object.values(extra)) for (let i = 0; i < pp.count * o.size; i++) o.arr.push(0);
  }

  // 3. atlas: recolour tinted classes, append swatch strip
  const out = new PNG({ width: png.width, height: H2 });
  png.data.copy(out.data, 0, 0, png.data.length);
  const stats: Record<number, { sum: number; n: number }> = {};
  const lum = (r: number, g: number, b: number) => .2126 * r + .7152 * g + .0722 * b;
  for (let i = 0; i < png.data.length; i += 4) {
    const cls = Math.round(png.data[i + 3] * 7 / 255) - 1;
    (stats[cls] ??= { sum: 0, n: 0 }).sum += lum(png.data[i], png.data[i + 1], png.data[i + 2]); stats[cls].n++;
  }
  // per-texel owning joint, rasterised from the (pre-strip) UV triangles
  const partMap = new Int16Array(png.width * png.height).fill(-1), W0 = png.width;
  const uvOf = (v: number): [number, number] => [attrs.T.arr[v * 2] * W0, attrs.T.arr[v * 2 + 1] * H2];
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const ids = [indices[t], indices[t + 1], indices[t + 2]]; if (ids.some(v => v >= attrs.C.arr.length)) continue;
    const [a, b, c] = ids.map(uvOf), part = attrs.C.arr[ids[0]];
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(W0 - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5, l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den, l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den;
      if (l1 >= -.02 && l2 >= -.02 && 1 - l1 - l2 >= -.02) partMap[y * W0 + x] = part;
    }
  }
  const skinLike = (r: number, g: number, b: number) => r > 90 && r > g * 1.05 && g >= b * .92 && g > r * .5 && r < 240 && !(r > g * 1.7 && r > 120) || (Math.max(r, g, b) - Math.min(r, g, b) < 30 && lum(r, g, b) > 135 && r >= b);
  const bloody = (r: number, g: number, b: number) => r > 95 && r > g * 1.9 && r > b * 1.9;
  for (const rc of role.recolour) if (rc.parts) {
    const target = hex(rc.colour), parts = new Set(rc.parts.map(n => idx.get(n)!)), texels: number[] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W0; x++) { const m = y * W0 + x; if (!parts.has(partMap[m])) continue; const o = m * 4; if (!skinLike(png.data[o], png.data[o + 1], png.data[o + 2]) && !bloody(png.data[o], png.data[o + 1], png.data[o + 2])) texels.push(o); }
    const mean = texels.reduce((s, o) => s + lum(png.data[o], png.data[o + 1], png.data[o + 2]), 0) / Math.max(1, texels.length);
    for (const o of texels) {
      const ratio = lum(png.data[o], png.data[o + 1], png.data[o + 2]) / Math.max(1, mean), f = Math.max(.45, Math.min(1.5, 1 + .7 * (ratio - 1)));
      for (let c = 0; c < 3; c++) out.data[o + c] = Math.min(255, Math.round(target[c] * f)); out.data[o + 3] = AUTHORED;
    }
  }
  for (const rc of role.recolour) if (rc.cls) {
    const target = hex(rc.colour), want = classIndex[rc.cls], mean = stats[want] ? stats[want].sum / stats[want].n : 1;
    for (let i = 0; i < out.data.length - STRIP * png.width * 4; i += 4) {
      const cls = Math.round(png.data[i + 3] * 7 / 255) - 1; if (cls !== want) continue;
      const f = Math.max(.35, Math.min(1.7, lum(png.data[i], png.data[i + 1], png.data[i + 2]) / Math.max(1, mean)));
      for (let c = 0; c < 3; c++) out.data[i + c] = Math.min(255, Math.round(target[c] * f));
      out.data[i + 3] = AUTHORED;
    }
  }
  swatches.forEach((s, k) => {
    const c = hex(s);
    for (let y = H; y < H2; y++) for (let x = k * STRIP; x < (k + 1) * STRIP; x++) { const o = (y * out.width + x) * 4; out.data[o] = c[0]; out.data[o + 1] = c[1]; out.data[o + 2] = c[2]; out.data[o + 3] = AUTHORED; }
  });
  // remaining strip pixels: mid grey, authored
  for (let y = H; y < H2; y++) for (let x = swatches.length * STRIP; x < out.width; x++) { const o = (y * out.width + x) * 4; out.data[o] = out.data[o + 1] = out.data[o + 2] = 90; out.data[o + 3] = AUTHORED; }
  texture.setImage(new Uint8Array(PNG.sync.write(out))).setMimeType('image/png');

  // write the primitive back
  const mk = (type: 'VEC3' | 'VEC2' | 'VEC4' | 'SCALAR', arr: number[], ctor: Float32ArrayConstructor | Uint16ArrayConstructor | Uint8ArrayConstructor = Float32Array) => doc.createAccessor().setType(type).setArray(new (ctor as Float32ArrayConstructor)(arr));
  const jointCtor = body.getAttribute('JOINTS_0')!.getArray()!.constructor as Uint16ArrayConstructor;
  const partCtor = body.getAttribute('_CROWD_PART')!.getArray()!.constructor as Uint16ArrayConstructor;
  body.setAttribute('POSITION', mk('VEC3', attrs.P.arr)).setAttribute('NORMAL', mk('VEC3', attrs.N.arr)).setAttribute('TEXCOORD_0', mk('VEC2', attrs.T.arr))
    .setAttribute('JOINTS_0', mk('VEC4', attrs.J.arr, jointCtor)).setAttribute('WEIGHTS_0', mk('VEC4', attrs.W.arr)).setAttribute('_CROWD_PART', mk('SCALAR', attrs.C.arr, partCtor));
  for (const [sem, o] of Object.entries(extra)) body.setAttribute(sem, mk(o.size === 1 ? 'SCALAR' : o.size === 2 ? 'VEC2' : o.size === 3 ? 'VEC3' : 'VEC4', o.arr));
  body.setIndices(doc.createAccessor().setType('SCALAR').setArray(attrs.P.arr.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)));

  // 4. uniform scale of the whole rig
  const k = Number(process.env.HEAVY_SCALE ?? role.scale);
  if (k !== 1) {
    for (const node of skinned) for (const prim of node.getMesh()!.listPrimitives()) {
      const P = prim.getAttribute('POSITION')!, e: number[] = [];
      for (let i = 0; i < P.getCount(); i++) { P.getElement(i, e); P.setElement(i, [e[0] * k, e[1] * k, e[2] * k]); }
    }
    for (const n of root.listNodes()) {
      const t = n.getTranslation(); n.setTranslation([t[0] * k, t[1] * k, t[2] * k]);
      if (n.getMesh() && !n.getSkin()) { const sc = n.getScale(); n.setScale([sc[0] * k, sc[1] * k, sc[2] * k]); } // carried props grow with the figure
    }
    // rebind: the joint chain keeps its rotations/scales, only translations grew, so the bind matrices are the inverse
    // of the new joint world matrices (the mesh nodes sit at identity).
    const m = new Matrix4();
    skin.listJoints().forEach((joint, i) => { m.fromArray(joint.getWorldMatrix()).invert(); ibm.setElement(i, m.toArray()); });
    const rootNode = root.listNodes().find(n => n.getName() === 'root')!, ex = rootNode.getExtras() as Record<string, unknown>;
    if (Array.isArray(ex.soleBounds)) rootNode.setExtras({ ...ex, soleBounds: (ex.soleBounds as number[][]).map(r => r.map(v => v * k)) });
  }
  void skin;
  return { doc, triangles: indices.length / 3 };
}

async function main() {
  const [want, ...flags] = process.argv.slice(2);
  const preview = flags.includes('--preview') ? flags[flags.indexOf('--preview') + 1] : undefined;
  const register = !flags.includes('--no-register');
  const io = await assetIO();
  const ids = want === 'all' ? Object.keys(roles) : [want];
  for (const id of ids) {
    const role = roles[id]; if (!role) throw Error(`unknown role ${id}`);
    const manifestPath = 'src/assets/manifest.json', manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AssetDef[];
    const def = manifest.find(a => a.id === role.id)!; if (!def) throw Error(`no manifest entry ${role.id}`);
    const output = 'public/assets/models/skinned', assets = join('assets', role.id), tmp = join(process.env.TMPDIR ?? '/tmp', `heavy-${role.id}`);
    mkdirSync(assets, { recursive: true }); mkdirSync(tmp, { recursive: true });
    const receipts: Record<string, unknown>[] = [];
    for (const lod of [0, 1, 2]) {
      const { doc, triangles } = await buildRole(role, lod, io);
      const raw = join(tmp, `lod${lod}.raw.glb`);
      for (const e of doc.getRoot().listExtensionsRequired()) e.dispose();
      for (const e of doc.getRoot().listExtensionsUsed()) e.dispose();
      await io.write(raw, doc);
      if (preview && lod === 0) { mkdirSync(preview, { recursive: true }); await io.write(join(preview, `${role.id}.png.glb`), doc); }
      if (!register) { receipts.push({ lod, triangles }); continue; }
      const tiers: Record<string, unknown>[] = [];
      for (const low of [false, true]) {
        const target = join(output, `${role.id}.lod${lod}${low ? '.low' : ''}.glb`);
        const initial = low || lod > 0 ? 512 : 1024;
        await compressSkin(raw, target, BASIS, initial);
        const limit = [600000, 250000, 150000][lod];
        for (const atlas of [512, 256, 128]) { if (readFileSync(target).length <= limit || atlas >= initial) continue; await compressSkin(raw, target, BASIS, atlas); }
        const bytes = readFileSync(target);
        if (bytes.length > limit) throw Error(`${role.id} LOD${lod}${low ? ' low' : ''}: ${bytes.length} B over ${limit}`);
        tiers.push({ low, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex').slice(0, 16) });
        if (lod === 0 && !low) await io.write(join(assets, 'model.skin.glb'), await io.read(raw));
      }
      receipts.push({ lod, triangles, tiers });
    }
    if (!register) { console.log(role.id, JSON.stringify(receipts)); continue; }
    const base = manifest.find(a => a.id === role.base)!;
    const bb = (await io.read(join(output, `${role.id}.lod0.glb`))).getRoot().listNodes().find(n => n.getName() === 'skin_body')!;
    void bb;
    Object.assign(def, {
      status: 'integrated', tier: 'hero', sourceGlb: join(assets, 'model.skin.glb'), glb: join(output, `${role.id}.lod0.glb`),
      lods: { lod1: join(output, `${role.id}.lod1.glb`), lod2: join(output, `${role.id}.lod2.glb`) }, crowdSkin: true, textureMode: 'baseColor',
      budget: { triangles: role.budget.triangles, materials: 2, fileKB: 600, drawCalls: 30 }, authoredLodTriangles: { lod1: role.budget.lod1, lod2: role.budget.lod2 },
      forward: '+X', sourceForward: '+X', sourceScale: 1, animatedNodes: base.animatedNodes, requiredNodes: base.requiredNodes, frontNodes: base.frontNodes, sockets: base.sockets,
    });
    delete (def as Partial<AssetDef>).script; delete (def as Partial<AssetDef>).authoredLodRatios; delete def.textureAtlasLow; delete def.lowGlb;
    // measured dimensions from the delivered LOD0 body bounds
    const meas = await io.read(join(output, `${role.id}.lod0.glb`));
    const bounds = getBounds(meas.getRoot().listScenes()[0]), mn = bounds.min, mx = bounds.max;
    def.dimensions = { x: mx[0] - mn[0], y: mx[1] - mn[1], z: mx[2] - mn[2], tolerance: .15 };
    let validation = await validateAssets([def]);
    // the validator measures the visible scene bounds itself; adopt that measurement, then validate for real
    const measured = validation.find(r => r.id === `${def.id}:lod0`)?.dimensions;
    if (measured?.length === 3) { def.dimensions = { x: measured[0], y: measured[1], z: measured[2], tolerance: role.tolerance ?? .15 }; validation = await validateAssets([def]); }
    if (validation.some(r => r.errors.length)) throw Error(`${role.id}: validator: ${validation.flatMap(r => r.errors).join('; ')}`);
    const bakePath = 'src/assets/civilianBakes.json', bakes = JSON.parse(readFileSync(bakePath, 'utf8')) as Record<string, string>;
    const prepared = await skinCrowdBakes(def);
    for (const key of Object.keys(bakes)) if (key.startsWith(role.id + ':')) { const f = 'public' + bakes[key]; if (!Object.values(prepared).includes(bakes[key]) && existsSync(f)) unlinkSync(f); delete bakes[key]; }
    Object.assign(bakes, prepared);
    const referenced = new Set(Object.values(bakes));
    for (const name of readdirSync('public/assets/civilians')) if (name.startsWith(role.id + '.lod') && name.endsWith('.bin.gz') && !referenced.has('/assets/civilians/' + name)) unlinkSync(join('public/assets/civilians', name));
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n'); writeFileSync(bakePath, JSON.stringify(bakes, null, 2) + '\n');
    writeFileSync(join(assets, 'build-stats.json'), JSON.stringify({ role: role.id, base: role.base, receipts }, null, 2) + '\n');
    console.log(role.id, 'registered', JSON.stringify(receipts));
  }
}
if (process.argv[1]?.endsWith('heavy-roles.ts')) await main();
void (null as unknown as Node);
