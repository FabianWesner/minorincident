/**
 * skinned-crowd prototype: turn a crowd figure into ONE welded skinned body on the crowd skeleton.
 *
 *   npx tsx tools/assets/skin-crowd-figure.ts --rig <rigid crowd glb> --out <skinned glb> --texture <image>
 *       [--body <welded static glb> --body-scale s --body-rot-y deg]  [--report <json>]
 *
 * Courier-style weighting (heroine/male lanes, adapted to the 16-joint crowd skeleton):
 * 1. The joints, names, hierarchy and sockets are the rigid figure's own (already fitted to the anatomy).
 * 2. The surface is the welded body. Without --body the rigid parts themselves are welded by position
 *    (the suit worker's parts are an ownership partition of one reduced surface: no closure caps).
 *    With --body (wave2 peds: the pre-binding watertight body) the body is placed in game space by the
 *    recorded uniform scale / yaw, fitted to the rigid surface, and every vertex takes the owner of the
 *    nearest rigid-part vertex (semantic ownership: tie on the torso, jaw on the head, shoes on the feet).
 * 3. Ownership is computed per welded vertex (UV duplicates share one weight row). At every parent/child
 *    cut seam the weights blend over a geodesic band along mesh edges (never across a gap in space):
 *    w_other = 0.5 * (1 - smoothstep(0, R, d)), d = edge distance to the seam on either side.
 * 4. Smooth normals come from the welded surface (no lighting seam at UV islands).
 * Output: the same node hierarchy, the rigid meshes removed, one SkinnedMesh `skin_body` (+ `skin_eyes`
 * with an `emi_` material for the infected eye discs), joints = the 16 deforming crowd joints.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Document, NodeIO, type Node as GNode } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Matrix4, Vector3 } from 'three';

class MinHeap {
  private keys: number[] = []; private values: number[] = [];
  get size() { return this.keys.length; }
  push(k: number, v: number) { const ks = this.keys, vs = this.values; let i = ks.length; ks.push(k); vs.push(v); while (i > 0) { const p = (i - 1) >> 1; if (ks[p] <= k) break; ks[i] = ks[p]; vs[i] = vs[p]; i = p; } ks[i] = k; vs[i] = v; }
  pop(): [number, number] {
    const ks = this.keys, vs = this.values, top: [number, number] = [ks[0], vs[0]], k = ks.pop()!, v = vs.pop()!;
    if (ks.length) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= ks.length) break; if (c + 1 < ks.length && ks[c + 1] < ks[c]) c++; if (ks[c] >= k) break; ks[i] = ks[c]; vs[i] = vs[c]; i = c; } ks[i] = k; vs[i] = v; }
    return top;
  }
}

const args = process.argv.slice(2);
const arg = (key: string, fallback?: string) => { const i = args.indexOf(key); return i >= 0 ? args[i + 1] : fallback; };
const rigPath = arg('--rig')!, outPath = arg('--out')!, texturePath = arg('--texture'), bodyPath = arg('--body'), reportPath = arg('--report');
if (!rigPath || !outPath) throw new Error('Expected --rig and --out');

const JOINTS = ['root', 'hip', 'torso', 'head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'handL', 'handR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR'] as const;
/** Geodesic blend half-width per child joint (metres at 1.8 m figure height). */
const BAND: Record<string, number> = { hip: .06, torso: .07, head: .035, armL: .06, armR: .06, foreArmL: .05, foreArmR: .05, handL: .03, handR: .03, legL: .07, legR: .07, shinL: .055, shinR: .055, footL: .035, footR: .035 };

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const rig = await io.read(rigPath);
const sceneRoot = rig.getRoot().listScenes()[0];
const world = (node: GNode) => new Matrix4().fromArray(node.getWorldMatrix());
const nodes = rig.getRoot().listNodes();
const jointNode = new Map(JOINTS.map(name => [name, nodes.find(n => n.getName() === name)!] as const));
for (const [name, node] of jointNode) if (!node) throw new Error(`missing joint ${name}`);
const parentJoint = new Map<string, string | null>();
for (const name of JOINTS) {
  let p = jointNode.get(name)!.getParentNode(); while (p && !(JOINTS as readonly string[]).includes(p.getName())) p = p.getParentNode();
  parentJoint.set(name, p ? p.getName() : null);
}

// ---- rigid surface (positions in world space, owner joint) ----------------------------------------
interface Surface { pos: number[]; uv: number[]; owner: number[]; tris: number[] }
const rigid: Surface = { pos: [], uv: [], owner: [], tris: [] };
const eyes: { pos: number[]; owner: number; tris: number[] }[] = [];
let texture: { image: Uint8Array; mime: string } | undefined;
const v = new Vector3();
const hidden = (node: GNode) => { for (let n: GNode | null = node; n; n = n.getParentNode()) if (n.getName().startsWith('stump_') || (n.getExtras() as { hidden?: boolean }).hidden) return true; return false; };
for (const node of nodes) {
  const mesh = node.getMesh(); if (!mesh || hidden(node)) continue;
  let owner: GNode | null = node; while (owner && !(JOINTS as readonly string[]).includes(owner.getName())) owner = owner.getParentNode();
  const ownerIndex = JOINTS.indexOf((owner?.getName() ?? 'root') as typeof JOINTS[number]);
  const m = world(node);
  for (const prim of mesh.listPrimitives()) {
    const position = prim.getAttribute('POSITION')!, uv = prim.getAttribute('TEXCOORD_0'), index = prim.getIndices();
    const map = prim.getMaterial()?.getBaseColorTexture();
    if (map && !texture) texture = { image: map.getImage()!, mime: map.getMimeType() };
    const eye = (node.getExtras() as { crowdEye?: boolean }).crowdEye === true;
    const target = eye ? { pos: [] as number[], owner: ownerIndex, tris: [] as number[] } : undefined;
    const base = eye ? 0 : rigid.pos.length / 3, el: number[] = [];
    for (let i = 0; i < position.getCount(); i++) {
      position.getElement(i, el); v.set(el[0], el[1], el[2]).applyMatrix4(m);
      if (target) { target.pos.push(v.x, v.y, v.z); continue; }
      rigid.pos.push(v.x, v.y, v.z); rigid.owner.push(ownerIndex);
      if (uv) { uv.getElement(i, el); rigid.uv.push(el[0], el[1]); } else rigid.uv.push(0, 0);
    }
    const count = index ? index.getCount() : position.getCount();
    for (let i = 0; i < count; i++) (target ? target.tris : rigid.tris).push((index ? index.getScalar(i) : i) + base);
    if (target) eyes.push(target);
  }
}

// ---- body ---------------------------------------------------------------------------------------
let body: Surface = rigid, fit: Record<string, unknown> = { body: 'rigid parts welded by position' };
if (bodyPath) {
  const doc = await io.read(bodyPath);
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const map = prim.getMaterial()?.getBaseColorTexture(); if (map) texture = { image: map.getImage()!, mime: map.getMimeType() };
  const position = prim.getAttribute('POSITION')!, uv = prim.getAttribute('TEXCOORD_0')!, index = prim.getIndices()!;
  const src: number[] = [], el: number[] = [];
  for (let i = 0; i < position.getCount(); i++) { position.getElement(i, el); src.push(el[0], el[1], el[2]); }
  const scale = Number(arg('--body-scale', '1')), yaw = Number(arg('--body-rot-y', '0'));
  // Place by the recorded scale/yaw, choose the yaw sign that fits the rigid surface, translate by bounds.
  const rigidGrid = grid(rigid.pos, .05);
  let best: { error: number; pos: number[]; yaw: number } | undefined;
  for (const sign of [1, -1]) {
    const a = sign * yaw * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), out: number[] = [];
    for (let i = 0; i < src.length; i += 3) { const x = src[i] * scale, y = src[i + 1] * scale, z = src[i + 2] * scale; out.push(c * x + s * z, y, -s * x + c * z); }
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], rlo = [Infinity, Infinity, Infinity], rhi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < out.length; i++) { lo[i % 3] = Math.min(lo[i % 3], out[i]); hi[i % 3] = Math.max(hi[i % 3], out[i]); }
    for (let i = 0; i < rigid.pos.length; i++) { rlo[i % 3] = Math.min(rlo[i % 3], rigid.pos[i]); rhi[i % 3] = Math.max(rhi[i % 3], rigid.pos[i]); }
    // Feet on the floor (y min), centre of the x/z bounds.
    const t = [(rlo[0] + rhi[0]) / 2 - (lo[0] + hi[0]) / 2, rlo[1] - lo[1], (rlo[2] + rhi[2]) / 2 - (lo[2] + hi[2]) / 2];
    for (let i = 0; i < out.length; i++) out[i] += t[i % 3];
    let error = 0; for (let i = 0; i < out.length; i += 3) error += nearest(rigidGrid, rigid.pos, out[i], out[i + 1], out[i + 2]).distance;
    error /= out.length / 3;
    if (!best || error < best.error) best = { error, pos: out, yaw: sign * yaw };
  }
  const owner: number[] = [];
  for (let i = 0; i < best!.pos.length; i += 3) owner.push(rigid.owner[nearest(rigidGrid, rigid.pos, best!.pos[i], best!.pos[i + 1], best!.pos[i + 2]).index]);
  const uvs: number[] = []; for (let i = 0; i < uv.getCount(); i++) { uv.getElement(i, el); uvs.push(el[0], el[1]); }
  const tris: number[] = []; for (let i = 0; i < index.getCount(); i++) tris.push(index.getScalar(i));
  body = { pos: best!.pos, uv: uvs, owner, tris };
  fit = { body: bodyPath, scale, yaw: best!.yaw, meanDistanceToRigidSurface: best!.error };
}

// ---- weld, graph --------------------------------------------------------------------------------
const n = body.pos.length / 3, weldOf = new Int32Array(n), keys = new Map<string, number>();
let welded = 0;
for (let i = 0; i < n; i++) {
  const key = `${Math.round(body.pos[i * 3] / 2e-4)},${Math.round(body.pos[i * 3 + 1] / 2e-4)},${Math.round(body.pos[i * 3 + 2] / 2e-4)}`;
  let w = keys.get(key); if (w === undefined) { w = welded++; keys.set(key, w); } weldOf[i] = w;
}
const wpos = new Float64Array(welded * 3), owners: Map<number, number>[] = Array.from({ length: welded }, () => new Map());
for (let i = 0; i < n; i++) { const w = weldOf[i]; for (let c = 0; c < 3; c++) wpos[w * 3 + c] = body.pos[i * 3 + c]; owners[w].set(body.owner[i], (owners[w].get(body.owner[i]) ?? 0) + 1); }
const owner = new Int32Array(welded);
// A seam vertex shared by two parts belongs to the parent side; the child blends in from there.
const depth = (j: number) => { let d = 0; for (let p = parentJoint.get(JOINTS[j]); p; p = parentJoint.get(p)) d++; return d; };
for (let w = 0; w < welded; w++) owner[w] = [...owners[w].keys()].sort((a, b) => depth(a) - depth(b))[0];
const neighbours: Set<number>[] = Array.from({ length: welded }, () => new Set());
const edgeUse = new Map<string, number>();
for (let t = 0; t < body.tris.length; t += 3) for (let e = 0; e < 3; e++) {
  const a = weldOf[body.tris[t + e]], b = weldOf[body.tris[t + (e + 1) % 3]]; if (a === b) continue;
  neighbours[a].add(b); neighbours[b].add(a); const key = a < b ? `${a},${b}` : `${b},${a}`; edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
}
const openEdges = [...edgeUse.values()].filter(c => c === 1).length;
const components = (() => { const seen = new Int32Array(welded).fill(-1); let count = 0; for (let s = 0; s < welded; s++) { if (seen[s] >= 0) continue; const stack = [s]; seen[s] = count; while (stack.length) { const i = stack.pop()!; for (const j of neighbours[i]) if (seen[j] < 0) { seen[j] = count; stack.push(j); } } count++; } return count; })();
const dist = (a: number, b: number) => Math.hypot(wpos[a * 3] - wpos[b * 3], wpos[a * 3 + 1] - wpos[b * 3 + 1], wpos[a * 3 + 2] - wpos[b * 3 + 2]);

// ---- weights: geodesic blend across every parent/child seam ------------------------------------------
const height = Math.max(...body.pos.filter((_, i) => i % 3 === 1)) - Math.min(...body.pos.filter((_, i) => i % 3 === 1));
const weights: Map<number, number>[] = Array.from({ length: welded }, (_, w) => new Map([[owner[w], 1]]));
const seams: Record<string, { seamVertices: number; band: number; blended: number }> = {};
let unrelatedSeams = 0;
// Blend across every seam between related owners: ancestor/descendant, or siblings under a joint that owns no
// surface (the suit's hip: the torso part owns the pelvis, the legs hang off the hip). Limbs of different chains
// that touch (a hand on a thigh) are never blended.
const owning = new Set(owner);
const ancestors = (j: number) => { const out: number[] = []; for (let q = parentJoint.get(JOINTS[j]); q; q = parentJoint.get(q)) out.push(JOINTS.indexOf(q as typeof JOINTS[number])); return out; };
const related = (x: number, y: number) => {
  const owningParent = (j: number) => ancestors(j).find(a => owning.has(a));
  if (owningParent(x) === y || owningParent(y) === x) return true;
  const px = ancestors(x)[0], py = ancestors(y)[0];
  return px === py && !owning.has(px);
};
const edgeLengths = [...edgeUse.keys()].map(key => { const [x, y] = key.split(',').map(Number); return dist(x, y); }).sort((x, y) => x - y);
const medianEdge = edgeLengths[edgeLengths.length >> 1];
const pairs = new Map<string, [number, number]>();
for (let w = 0; w < welded; w++) for (const u of neighbours[w]) if (owner[u] !== owner[w]) {
  if (!related(owner[u], owner[w])) { unrelatedSeams++; continue; }
  const lo = Math.min(owner[u], owner[w]), hi = Math.max(owner[u], owner[w]); pairs.set(`${lo},${hi}`, [lo, hi]);
}
for (const [x, y] of pairs.values()) {
  // The deeper joint is the child; its band applies.
  // Coarse LODs: the band always reaches at least the first ring of vertices on each side.
  const [p, c] = ancestors(x).length > ancestors(y).length ? [y, x] : [x, y], child = `${JOINTS[c]}/${JOINTS[p]}`, base = BAND[JOINTS[c]] * height / 1.8, band = Math.max(base, Math.min(medianEdge, 2 * base));
  // Seam = vertices with a neighbour on the other side. Distance d runs along edges on each side.
  const d = new Float64Array(welded).fill(Infinity), heap: [number, number][] = [];
  let seamCount = 0;
  for (let w = 0; w < welded; w++) if (owner[w] === c || owner[w] === p) for (const u of neighbours[w]) if ((owner[w] === c && owner[u] === p) || (owner[w] === p && owner[u] === c)) {
    // Place the seam half-way along the crossing edge.
    const half = dist(w, u) / 2; if (half < d[w]) { d[w] = half; heap.push([half, w]); }
  }
  for (let w = 0; w < welded; w++) if (d[w] < Infinity) seamCount++;
  heap.sort((a, b) => a[0] - b[0]);
  // Small graphs: a sorted frontier (Dijkstra) is fast enough.
  const queue = new MinHeap(); for (const [k, w] of heap) queue.push(k, w);
  while (queue.size) {
    const [k, w] = queue.pop(); if (k > d[w] || k > band) continue;
    for (const u of neighbours[w]) { if (owner[u] !== owner[w]) continue; const nd = k + dist(w, u); if (nd < d[u]) { d[u] = nd; queue.push(nd, u); } }
  }
  let blended = 0;
  for (let w = 0; w < welded; w++) {
    if (d[w] > band) continue;
    const t = Math.min(1, d[w] / band), other = owner[w] === c ? p : c, share = .5 * (1 - t * t * (3 - 2 * t));
    if (share <= 1e-3) continue;
    const own = weights[w].get(owner[w])!; weights[w].set(owner[w], Math.max(0, own - share)); weights[w].set(other, (weights[w].get(other) ?? 0) + share); blended++;
  }
  seams[child] = { seamVertices: seamCount, band, blended };
}
// Top four influences, normalized.
const joints4 = new Uint16Array(welded * 4), weights4 = new Float32Array(welded * 4);
let maxInfluences = 0;
for (let w = 0; w < welded; w++) {
  const sorted = [...weights[w]].filter(([, x]) => x > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
  maxInfluences = Math.max(maxInfluences, sorted.length);
  const sum = sorted.reduce((s, [, x]) => s + x, 0);
  sorted.forEach(([j, x], k) => { joints4[w * 4 + k] = j; weights4[w * 4 + k] = x / sum; });
}

// ---- smooth normals on the welded surface -----------------------------------------------------------
const wnormal = new Float64Array(welded * 3), a = new Vector3(), b = new Vector3(), cvec = new Vector3();
for (let t = 0; t < body.tris.length; t += 3) {
  const [i0, i1, i2] = [weldOf[body.tris[t]], weldOf[body.tris[t + 1]], weldOf[body.tris[t + 2]]];
  a.set(wpos[i1 * 3] - wpos[i0 * 3], wpos[i1 * 3 + 1] - wpos[i0 * 3 + 1], wpos[i1 * 3 + 2] - wpos[i0 * 3 + 2]);
  b.set(wpos[i2 * 3] - wpos[i0 * 3], wpos[i2 * 3 + 1] - wpos[i0 * 3 + 1], wpos[i2 * 3 + 2] - wpos[i0 * 3 + 2]);
  cvec.crossVectors(a, b); // area-weighted
  for (const i of [i0, i1, i2]) { wnormal[i * 3] += cvec.x; wnormal[i * 3 + 1] += cvec.y; wnormal[i * 3 + 2] += cvec.z; }
}

// ---- output document --------------------------------------------------------------------------------
const out = new Document(); out.createBuffer();
const copy = new Map<GNode, GNode>();
const clone = (node: GNode): GNode | null => {
  if (node.getMesh() && !node.getName().startsWith('stump_')) return null; // stump_* stay as hidden empty nodes (required node contract)
  const c = out.createNode(node.getName()).setTranslation(node.getTranslation()).setRotation(node.getRotation()).setScale(node.getScale()).setExtras({ ...node.getExtras() });
  copy.set(node, c); for (const child of node.listChildren()) { const cc = clone(child); if (cc) c.addChild(cc); } return c;
};
const scene = out.createScene('scene');
for (const top of sceneRoot.listChildren()) { const c = clone(top); if (c) scene.addChild(c); }
const outJoints = JOINTS.map(name => copy.get(jointNode.get(name)!)!);
const inverseBinds = new Float32Array(JOINTS.length * 16);
JOINTS.forEach((name, i) => new Matrix4().fromArray(jointNode.get(name)!.getWorldMatrix()).invert().toArray(inverseBinds, i * 16));
const skin = out.createSkin('crowd_skin').setSkeleton(outJoints[0]).setInverseBindMatrices(out.createAccessor().setType('MAT4').setArray(inverseBinds));
for (const j of outJoints) skin.addJoint(j);
const material = out.createMaterial('atlas_body').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1);
let image: Uint8Array | undefined = texturePath ? readFileSync(texturePath) : texture?.image;
let mime = texturePath ? (texturePath.endsWith('.webp') ? 'image/webp' : texturePath.endsWith('.png') ? 'image/png' : 'image/jpeg') : texture?.mime;
const textureMax = arg('--texture-max');
if (image && textureMax) {
  // Low tier: resample to at most N px and store as JPEG (sips, macOS).
  const dir = mkdtempSync(join(tmpdir(), 'skin-crowd-')), input = join(dir, mime === 'image/webp' ? 'in.webp' : mime === 'image/png' ? 'in.png' : 'in.jpg'), output = join(dir, 'out.jpg');
  writeFileSync(input, image);
  execFileSync('sips', ['-Z', textureMax, '-s', 'format', 'jpeg', '-s', 'formatOptions', '88', input, '--out', output], { stdio: 'ignore' });
  image = readFileSync(output); mime = 'image/jpeg'; rmSync(dir, { recursive: true });
}
if (image) material.setBaseColorTexture(out.createTexture('atlas').setImage(new Uint8Array(image)).setMimeType(mime!));
const prim = out.createPrimitive().setMaterial(material);
const positions = new Float32Array(n * 3), normals = new Float32Array(n * 3), uvs = new Float32Array(n * 2), J = new Uint16Array(n * 4), W = new Float32Array(n * 4);
let zeroNormals = 0;
for (let i = 0; i < n; i++) {
  const w = weldOf[i]; const nx = wnormal[w * 3], ny = wnormal[w * 3 + 1], nz = wnormal[w * 3 + 2], len = Math.hypot(nx, ny, nz);
  for (let c = 0; c < 3; c++) positions[i * 3 + c] = body.pos[i * 3 + c];
  // Degenerate welded fans have no area: a zero normal normalizes to NaN on the GPU (black bloom blocks).
  if (len < 1e-12) { normals[i * 3 + 1] = 1; zeroNormals++; } else { normals[i * 3] = nx / len; normals[i * 3 + 1] = ny / len; normals[i * 3 + 2] = nz / len; }
  uvs[i * 2] = body.uv[i * 2]; uvs[i * 2 + 1] = body.uv[i * 2 + 1];
  for (let k = 0; k < 4; k++) { J[i * 4 + k] = joints4[w * 4 + k]; W[i * 4 + k] = weights4[w * 4 + k]; }
}
prim.setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(positions));
prim.setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(normals));
prim.setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(uvs));
prim.setAttribute('JOINTS_0', out.createAccessor().setType('VEC4').setArray(J));
prim.setAttribute('WEIGHTS_0', out.createAccessor().setType('VEC4').setArray(W));
prim.setIndices(out.createAccessor().setType('SCALAR').setArray(n > 65535 ? new Uint32Array(body.tris) : new Uint16Array(body.tris)));
const bodyMesh = out.createMesh('skin_body').addPrimitive(prim);
scene.addChild(out.createNode('skin_body').setMesh(bodyMesh).setSkin(skin));
if (eyes.length) {
  // Infected eye discs: rigid on the head, emissive by material name (bakeInfected's emi_ rule).
  const eyeMaterial = out.createMaterial('emi_eye').setBaseColorFactor([1, .23, .18, 1]).setMetallicFactor(0).setRoughnessFactor(1);
  // The game's radial eye-disc shader is not on main: shrink each disc's square quad to its inner 40 %.
  const pos: number[] = [], tris: number[] = [];
  for (const e of eyes) {
    const base = pos.length / 3, k = e.pos.length / 3, centre = [0, 1, 2].map(c => e.pos.filter((_, i) => i % 3 === c).reduce((x, y) => x + y, 0) / k);
    for (let i = 0; i < e.pos.length; i++) pos.push(centre[i % 3] + (e.pos[i] - centre[i % 3]) * .4);
    tris.push(...e.tris.map(t => t + base));
  }
  const count = pos.length / 3, eyeNormals = new Float32Array(count * 3), j = new Uint16Array(count * 4), wt = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { j[i * 4] = eyes[0].owner; wt[i * 4] = 1; eyeNormals[i * 3] = 1; }
  const ep = out.createPrimitive().setMaterial(eyeMaterial)
    .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(new Float32Array(pos)))
    .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(eyeNormals))
    .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(new Float32Array(count * 2)))
    .setAttribute('JOINTS_0', out.createAccessor().setType('VEC4').setArray(j))
    .setAttribute('WEIGHTS_0', out.createAccessor().setType('VEC4').setArray(wt))
    .setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint16Array(tris)));
  scene.addChild(out.createNode('skin_eyes').setMesh(out.createMesh('skin_eyes').addPrimitive(ep)).setSkin(skin));
}
for (const node of out.getRoot().listNodes()) if (node.getName() === 'root') node.setExtras({ ...node.getExtras(), skinnedCrowd: true });
const bytes = await io.writeBinary(out);
writeFileSync(outPath, bytes);
const report = { rig: rigPath, out: outPath, bytes: bytes.length, ...fit, vertices: n, weldedVertices: welded, triangles: body.tris.length / 3, components, openEdges, unrelatedSeams, maxInfluences, zeroNormals, joints: JOINTS.length, eyes: eyes.length, seams };
if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));

// ---- helpers ----------------------------------------------------------------------------------------
function grid(pos: number[], cell: number) {
  const g = new Map<string, number[]>();
  for (let i = 0; i < pos.length; i += 3) { const k = `${Math.floor(pos[i] / cell)},${Math.floor(pos[i + 1] / cell)},${Math.floor(pos[i + 2] / cell)}`; (g.get(k) ?? g.set(k, []).get(k)!).push(i / 3); }
  return { g, cell };
}
function nearest(index: ReturnType<typeof grid>, pos: number[], x: number, y: number, z: number) {
  const { g, cell } = index, cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
  let best = -1, bestD = Infinity;
  for (let r = 1; r < 40 && best < 0 || r === 1; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
      for (const i of g.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) { const d = Math.hypot(pos[i * 3] - x, pos[i * 3 + 1] - y, pos[i * 3 + 2] - z); if (d < bestD) { bestD = d; best = i; } }
    }
    if (best >= 0) break;
  }
  return { index: best, distance: bestD };
}
