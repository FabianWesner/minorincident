/**
 * Production crowd conversion: turn a crowd figure into ONE welded skinned body on the crowd skeleton.
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
 * with a crowdEye material marker). Humanoids use 16 deforming joints; quadrupeds retain the 28-name contract below.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adoptStandingBind } from './skin-crowd-standing';
import { crowdLimbParts } from '../../src/assets/crowdParts';
import { Document, NodeIO, type Node as GNode } from '@gltf-transform/core';
import { copyToDocument, getBounds, normals as generateNormals, unpartition } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { PNG } from 'pngjs';
import { Box3, Matrix4, Ray, Triangle, Vector3 } from 'three';

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
const rigPath = arg('--rig')!, outPath = arg('--out')!, texturePath = arg('--texture'), reportPath = arg('--report');
let bodyPath = arg('--body');
if (!rigPath || !outPath) throw new Error('Expected --rig and --out');

const HUMANOID = ['root', 'hip', 'torso', 'head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'handL', 'handR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR'];
// Production dog/zebra rigs retain the humanoid aliases on the same leg chains. Lion rigs may omit the paw aliases.
const QUADRUPED = [...HUMANOID, 'body', 'neck', 'jaw', 'tail', 'legFL', 'legFR', 'legBL', 'legBR', 'pawFL', 'pawFR', 'pawBL', 'pawBR', 'tongue'];
/** Geodesic blend half-width per child joint (metres at 1.8 m figure height). */
const BAND: Record<string, number> = { hip: .06, torso: .07, head: .035, armL: .06, armR: .06, foreArmL: .05, foreArmR: .05, handL: .03, handR: .03, legL: .07, legR: .07, shinL: .055, shinR: .055, footL: .035, footR: .035, body: .08, neck: .06, jaw: .025, tail: .035, legFL: .06, legFR: .06, legBL: .06, legBR: .06, pawFL: .035, pawFR: .035, pawBL: .035, pawBR: .035 };
BAND.tongue = .015;

await Promise.all([MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const rig = await io.read(rigPath);
const contractPath = arg('--contract');
const contract = contractPath ? await io.read(contractPath) : undefined;
if (contract) { const metadata = new Map(contract.getRoot().listNodes().map(node => [node.getName(), node.getExtras()])); for (const node of rig.getRoot().listNodes()) node.setExtras({ ...metadata.get(node.getName()), ...node.getExtras() }); }
const sceneRoot = rig.getRoot().listScenes()[0];
const world = (node: GNode) => new Matrix4().fromArray(node.getWorldMatrix());
if (args.includes('--retain-corgi-props')) {
  const head = rig.getRoot().listNodes().find(n => n.getName() === 'head')!;
  head.addChild(rig.createNode('tongue').setExtras({ corgiTongueJoint: true }));
}
const nodes = rig.getRoot().listNodes();
const quadruped = arg('--rig-kind') === 'quadruped' || nodes.some(n => n.getName() === 'body' || n.getName() === 'legFL');
const JOINTS = (quadruped ? QUADRUPED : HUMANOID).filter(name => nodes.some(n => n.getName() === name));
for (const name of quadruped ? ['root', 'body', 'head'] : HUMANOID) if (!JOINTS.includes(name)) throw new Error(`missing joint ${name}`);
const jointNode = new Map(JOINTS.map(name => [name, nodes.find(n => n.getName() === name)!] as const));
for (const [name, node] of jointNode) if (!node) throw new Error(`missing joint ${name}`);
let neutralArm: string | undefined;
let anatomyMaterials: Set<string> | undefined;
if (args.includes('--fit-rig-height') && !quadruped) {
  const drop = (side: string) => new Vector3().setFromMatrixPosition(world(jointNode.get(`arm${side}`)!)).y - new Vector3().setFromMatrixPosition(world(jointNode.get(`hand${side}`)!)).y;
  if (Math.abs(drop('L') - drop('R')) > .035) {
    const side = drop('L') > drop('R') ? 'L' : 'R', other = side === 'L' ? 'R' : 'L';
    const mirror = new Matrix4().makeScale(1, 1, -1).setPosition(0, 0, new Vector3().setFromMatrixPosition(world(jointNode.get('root')!)).z * 2);
    for (const part of ['arm', 'foreArm', 'hand']) {
      const target = jointNode.get(part + other)!, desired = mirror.clone().multiply(world(jointNode.get(part + side)!)).multiply(mirror);
      target.setMatrix(world(target.getParentNode()!).invert().multiply(desired).toArray());
    }
    neutralArm = side;
  }
  const materials = (side: string) => {
    const result = new Set<string>();
    jointNode.get(`arm${side}`)!.traverse(node => { for (const primitive of node.getMesh()?.listPrimitives() ?? []) if (primitive.getMaterial()) result.add(primitive.getMaterial()!.getName()); });
    return result;
  };
  const left = materials('L'), right = materials('R');
  anatomyMaterials = new Set([...left].filter(name => right.has(name)));
  if (!anatomyMaterials.size) throw Error('Cannot separate arm anatomy from carried props');
}
const parentJoint = new Map<string, string | null>();
for (const name of JOINTS) {
  let p = jointNode.get(name)!.getParentNode(); while (p && !(JOINTS as readonly string[]).includes(p.getName())) p = p.getParentNode();
  parentJoint.set(name, p ? p.getName() : null);
}

// ---- rigid surface (positions in world space, owner joint) ----------------------------------------
interface Surface { pos: number[]; uv: number[]; owner: number[]; tris: number[] }
/** Exact anatomical surface distance; vertex density must not make a glove
 * claim the neighbouring sleeve or waist. A small AABB tree bounds the search. */
function surfaceNearest(surface: Surface) {
  type Branch = { box: number[]; faces?: number[]; left?: Branch; right?: Branch };
  const boxes = Array.from({ length: surface.tris.length / 3 }, (_, face) => {
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let k = 0; k < 3; k++) for (let axis = 0; axis < 3; axis++) {
      const value = surface.pos[surface.tris[face * 3 + k] * 3 + axis]; box[axis] = Math.min(box[axis], value); box[axis + 3] = Math.max(box[axis + 3], value);
    }
    return box;
  });
  const build = (faces: number[]): Branch => {
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const face of faces) for (let a = 0; a < 3; a++) { box[a] = Math.min(box[a], boxes[face][a]); box[a + 3] = Math.max(box[a + 3], boxes[face][a + 3]); }
    if (faces.length <= 12) return { box, faces };
    const axis = [0, 1, 2].sort((a, b) => box[b + 3] - box[b] - (box[a + 3] - box[a]))[0];
    faces.sort((a, b) => boxes[a][axis] + boxes[a][axis + 3] - boxes[b][axis] - boxes[b][axis + 3]);
    const middle = Math.floor(faces.length / 2);
    return { box, left: build(faces.slice(0, middle)), right: build(faces.slice(middle)) };
  };
  const tree = build(boxes.map((_, i) => i)), point = new Vector3(), closest = new Vector3(), triangle = new Triangle();
  return (x: number, y: number, z: number) => {
    point.set(x, y, z); let squared = Infinity, index = 0;
    const distance = (box: number[]) => { let total = 0; for (let a = 0; a < 3; a++) { const value = point.getComponent(a), d = Math.max(box[a] - value, 0, value - box[a + 3]); total += d * d; } return total; };
    const visit = (node: Branch): void => {
      if (distance(node.box) > squared) return;
      if (node.faces) for (const face of node.faces) {
        triangle.a.fromArray(surface.pos, surface.tris[face * 3] * 3); triangle.b.fromArray(surface.pos, surface.tris[face * 3 + 1] * 3); triangle.c.fromArray(surface.pos, surface.tris[face * 3 + 2] * 3);
        triangle.closestPointToPoint(point, closest); const d = closest.distanceToSquared(point);
        if (d < squared) { squared = d; index = surface.tris[face * 3]; }
      } else {
        const [first, second] = distance(node.left!.box) < distance(node.right!.box) ? [node.left!, node.right!] : [node.right!, node.left!];
        visit(first); visit(second);
      }
    };
    visit(tree); return { index, distance: Math.sqrt(squared) };
  };
}
const rigid: Surface = { pos: [], uv: [], owner: [], tris: [] };
let removedClosureTriangles = 0, removedDegenerateTriangles = 0;
const eyes: { pos: number[]; uv: number[]; owner: number; tris: number[] }[] = [];
let texture: { image: Uint8Array; mime: string } | undefined;
const v = new Vector3();
const retained = (node: GNode) => {
  if (!args.includes('--retain-corgi-props')) return false;
  for (let n: GNode | null = node; n; n = n.getParentNode()) if (n.getName() === 'packSocket') return true;
  return false;
};
const hidden = (node: GNode) => { for (let n: GNode | null = node; n; n = n.getParentNode()) if (n.getName().startsWith('stump_') || (n.getExtras() as { hidden?: boolean }).hidden) return true; return false; };
for (const node of nodes) {
  const mesh = node.getMesh(); if (!mesh || hidden(node) || retained(node) || args.includes('--retain-corgi-props') && node.getName() === 'head__pal_corgiTongue') continue;
  let owner: GNode | null = node; while (owner && !(JOINTS as readonly string[]).includes(owner.getName())) owner = owner.getParentNode();
  const ownerIndex = JOINTS.indexOf((owner?.getName() ?? 'root') as typeof JOINTS[number]);
  const m = world(node);
  for (const prim of mesh.listPrimitives()) {
    if (anatomyMaterials && /^(arm|foreArm|hand)[LR]$/.test(JOINTS[ownerIndex]) && !anatomyMaterials.has(prim.getMaterial()?.getName() ?? '')) continue;
    const position = prim.getAttribute('POSITION')!, uv = prim.getAttribute('TEXCOORD_0'), index = prim.getIndices();
    const map = prim.getMaterial()?.getBaseColorTexture();
    if (map && !texture) texture = { image: map.getImage()!, mime: map.getMimeType() };
    const eye = (node.getExtras() as { crowdEye?: boolean }).crowdEye === true;
    const target = eye ? { pos: [] as number[], uv: [] as number[], owner: ownerIndex, tris: [] as number[] } : undefined;
    const base = eye ? 0 : rigid.pos.length / 3, el: number[] = [];
    // Indexed palette primitives can share an accessor containing other parts
    // and props. Only referenced vertices belong to this primitive's joint.
    const used = index && args.includes('--fit-rig-height') ? [...new Set(Array.from({ length: index.getCount() }, (_, i) => index.getScalar(i)))] : Array.from({ length: position.getCount() }, (_, i) => i);
    const vertexMap = new Map(used.map((vertex, i) => [vertex, i]));
    for (const i of used) {
      position.getElement(i, el); v.set(el[0], el[1], el[2]).applyMatrix4(m);
      if (target) { target.pos.push(v.x, v.y, v.z); if (uv) { uv.getElement(i, el); target.uv.push(el[0], el[1]); } else target.uv.push(0, 0); continue; }
      rigid.pos.push(v.x, v.y, v.z); rigid.owner.push(ownerIndex);
      if (uv) { uv.getElement(i, el); rigid.uv.push(el[0], el[1]); } else rigid.uv.push(0, 0);
    }
    const count = index ? index.getCount() : position.getCount();
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map(k => index ? index.getScalar(i + k) : i + k);
      if (!target && args.includes('--strip-closures') && uv) {
        const a = uv.getElement(ids[0], []), b = uv.getElement(ids[1], []), c = uv.getElement(ids[2], []);
        // Rigid cut closures are deliberately mapped to a single quiet atlas texel. The original surface has UV area.
        if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-12) { removedClosureTriangles++; continue; }
      }
      const points = target ? target.pos : rigid.pos, offset = target ? 0 : base;
      for (let k = 0; k < 3; k++) ids[k] = vertexMap.get(ids[k])!;
      const [a, b, c] = ids.map(i => new Vector3().fromArray(points, (i + offset) * 3));
      if (b.sub(a).cross(c.sub(a)).length() < 1e-12) { removedDegenerateTriangles++; continue; }
      (target ? target.tris : rigid.tris).push(...ids.map(k => k + base));
    }
    if (target) eyes.push(target);
  }
}

// ---- body ---------------------------------------------------------------------------------------
let recovered: string | undefined;
if (args.includes('--reconstruct-body') && !bodyPath) {
  recovered = mkdtempSync(join(tmpdir(), 'crowd-surface-'));
  const input = join(recovered, 'source.json'); bodyPath = join(recovered, 'body.glb');
  writeFileSync(input, JSON.stringify(rigid));
  execFileSync('python3', ['tools/blender/run.py', 'tools/assets/skin-crowd-surface.py', input, bodyPath], { stdio: 'pipe' });
}
let body: Surface = rigid, fit: Record<string, unknown> = { body: 'rigid parts welded by position' };
let bodyTransform = new Matrix4();
if (bodyPath) {
  const doc = await io.read(bodyPath);
  const prim = (doc.getRoot().listNodes().find(n => n.getName() === 'body' && n.getMesh())?.getMesh() ?? doc.getRoot().listMeshes()[0]).listPrimitives()[0];
  const map = prim.getMaterial()?.getBaseColorTexture(); if (map) texture = { image: map.getImage()!, mime: map.getMimeType() };
  const position = prim.getAttribute('POSITION')!, uv = prim.getAttribute('TEXCOORD_0')!, index = prim.getIndices()!;
  const src: number[] = [], el: number[] = [];
  for (let i = 0; i < position.getCount(); i++) { position.getElement(i, el); src.push(el[0], el[1], el[2]); }
  let scale = Number(arg('--body-scale', '1'));
  const yaw = Number(arg('--body-rot-y', '0'));
  if (args.includes('--fit-rig-height')) {
    const height = (points: number[]) => {
      let low = Infinity, high = -Infinity;
      for (let i = 1; i < points.length; i += 3) { low = Math.min(low, points[i]); high = Math.max(high, points[i]); }
      return high - low;
    };
    // Bind in the retained rig's frame. The game normalizes every adult to
    // 1.8 m afterward; a source's initial calibration must not shorten its bones.
    scale = height(rigid.pos) / height(src);
  }
  // Place by the recorded scale/yaw, choose the yaw sign that fits the rigid surface, translate by bounds.
  const rigidGrid = grid(rigid.pos, .05);
  const closestToRig = args.includes('--fit-rig-height') ? surfaceNearest(rigid) : (x: number, y: number, z: number) => nearest(rigidGrid, rigid.pos, x, y, z);
  let best: { error: number; pos: number[]; yaw: number; translation: number[] } | undefined;
  for (const sign of args.includes('--body-yaw-fixed') ? [1] : [1, -1]) {
    const a = sign * yaw * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), out: number[] = [];
    for (let i = 0; i < src.length; i += 3) { const x = src[i] * scale, y = src[i + 1] * scale, z = src[i + 2] * scale; out.push(c * x + s * z, y, -s * x + c * z); }
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], rlo = [Infinity, Infinity, Infinity], rhi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < out.length; i++) { lo[i % 3] = Math.min(lo[i % 3], out[i]); hi[i % 3] = Math.max(hi[i % 3], out[i]); }
    for (let i = 0; i < rigid.pos.length; i++) { rlo[i % 3] = Math.min(rlo[i % 3], rigid.pos[i]); rhi[i % 3] = Math.max(rhi[i % 3], rigid.pos[i]); }
    // Feet on the floor (y min), centre of the x/z bounds.
    const t = [(rlo[0] + rhi[0]) / 2 - (lo[0] + hi[0]) / 2, rlo[1] - lo[1], (rlo[2] + rhi[2]) / 2 - (lo[2] + hi[2]) / 2];
    for (let i = 0; i < out.length; i++) out[i] += t[i % 3];
    let error = 0; for (let i = 0; i < out.length; i += 3) error += closestToRig(out[i], out[i + 1], out[i + 2]).distance;
    error /= out.length / 3;
    if (!best || error < best.error) best = { error, pos: out, yaw: sign * yaw, translation: t };
  }
  const owner: number[] = [];
  const armBands = args.includes('--fit-rig-height') ? ['L', 'R'].map(side => {
    const shoulder = new Vector3().setFromMatrixPosition(world(jointNode.get(`arm${side}`)!)).y, elbow = new Vector3().setFromMatrixPosition(world(jointNode.get(`foreArm${side}`)!)).y, wrist = new Vector3().setFromMatrixPosition(world(jointNode.get(`hand${side}`)!)).y;
    return { side, sleeve: elbow + (shoulder - elbow) * .25, lowerSleeve: elbow - (shoulder - elbow) * .2, glove: (elbow + wrist) / 2 };
  }) : [];
  for (let i = 0; i < best!.pos.length; i += 3) {
    let part = rigid.owner[closestToRig(best!.pos[i], best!.pos[i + 1], best!.pos[i + 2]).index];
    const name = JOINTS[part], band = armBands.find(b => name.endsWith(b.side));
    // Loose coat sleeves can be nearer a thin template forearm than its upper
    // arm. Respect the neutral rig's elbow/wrist bands at the shoulder opening.
    if (band && /^(foreArm|hand)/.test(name)) {
      if (best!.pos[i + 1] > band.sleeve) part = JOINTS.indexOf(`arm${band.side}`);
      else if (name.startsWith('hand') && best!.pos[i + 1] > band.glove) part = JOINTS.indexOf(`foreArm${band.side}`);
    }
    if (band && /^arm[LR]$/.test(name) && best!.pos[i + 1] < band.lowerSleeve) part = JOINTS.indexOf(`foreArm${band.side}`);
    owner.push(part);
  }
  const uvs: number[] = []; for (let i = 0; i < uv.getCount(); i++) { uv.getElement(i, el); uvs.push(el[0], el[1]); }
  const tris: number[] = []; for (let i = 0; i < index.getCount(); i++) tris.push(index.getScalar(i));
  body = { pos: best!.pos, uv: uvs, owner, tris };
  bodyTransform = new Matrix4().makeRotationY(best!.yaw * Math.PI / 180).scale(new Vector3(scale, scale, scale)).setPosition(new Vector3().fromArray(best!.translation));
  fit = { body: bodyPath, scale, yaw: best!.yaw, translation: best!.translation, meanDistanceToRigidSurface: best!.error, neutralArm, anatomyMaterials: anatomyMaterials ? [...anatomyMaterials] : undefined };
}
if (recovered) { fit.body = 'automatic 512-cell voxel union of closed source partitions'; rmSync(recovered, { recursive: true, force: true }); }
if (args.includes('--atlas-base-half')) {
  // The dog source stacks its emission beneath the base image. Runtime eye
  // emission is separate, so keep the canonical healthy UVs and base half only.
  const png = PNG.sync.read(Buffer.from(texture!.image)), half = new PNG({ width: png.width, height: png.height / 2 });
  half.data.set(png.data.subarray(0, half.data.length)); texture = { image: PNG.sync.write(half), mime: 'image/png' };
  for (let i = 1; i < body.uv.length; i += 2) body.uv[i] *= 2;
  fit.atlasPacking = 'base half of stacked source; canonical healthy-dog UVs';
}
if (arg('--clear-headwear')) {
  // Give painted cap/helmet brims clearance over the face along the game camera's
  // 36-degree elevation. Move welded position groups together, retaining UV seams.
  const directory = mkdtempSync(join(tmpdir(), 'crowd-brim-')), input = join(directory, 'atlas.' + texture!.mime.split('/')[1]), output = join(directory, 'atlas.png');
  writeFileSync(input, texture!.image); execFileSync('sips', ['-s', 'format', 'png', input, '--out', output], { stdio: 'ignore' });
  const png = PNG.sync.read(readFileSync(output)), head = JOINTS.indexOf('head');
  const headVertices = body.owner.flatMap((owner, i) => owner === head ? [i] : []), face: number[] = [], cap: number[] = [];
  const xs = headVertices.map(i => body.pos[i * 3]), ys = headVertices.map(i => body.pos[i * 3 + 1]), zs = headVertices.map(i => body.pos[i * 3 + 2]);
  const centreX = (Math.min(...xs) + Math.max(...xs)) / 2, centreZ = (Math.min(...zs) + Math.max(...zs)) / 2, headWidth = Math.max(...zs) - Math.min(...zs), headHeight = Math.max(...ys) - Math.min(...ys);
  for (const i of headVertices) {
    const x = Math.max(0, Math.min(png.width - 1, Math.floor(body.uv[i * 2] * png.width))), y = Math.max(0, Math.min(png.height - 1, Math.floor(body.uv[i * 2 + 1] * png.height))), offset = (y * png.width + x) * 4;
    const [r, g, b] = png.data.subarray(offset, offset + 3);
    if (body.pos[i * 3] > centreX && Math.abs(body.pos[i * 3 + 2] - centreZ) < headWidth * .3 && r > 140 && g > r * .45 && g < r * .85 && b > r * .25 && b < r * .8) face.push(i);
    if (arg('--clear-headwear') === 'brown' ? r >= 80 && r < 170 && r > g * 1.1 && g > b * 1.05 : arg('--clear-headwear') === 'red' ? r > g * 1.6 && r > b * 1.4 : arg('--clear-headwear') === 'green' ? g > r * 1.1 && g > b * .75 : arg('--clear-headwear') === 'yellow' ? r > 130 && g > 100 && b < Math.min(r, g) * .7 : b > r * 1.1 && b >= g * .9) cap.push(i);
  }
  const pickedEyes = arg('--eyes') ? (JSON.parse(readFileSync(arg('--eyes')!, 'utf8')) as { eye_centers: number[][] }).eye_centers.map(p => new Vector3().fromArray(p).applyMatrix4(bodyTransform)) : undefined;
  if ((!pickedEyes && face.length < 4) || cap.length < 4) throw Error('Cannot measure face/headwear clearance from the source atlas');
  const percentile = (values: number[], p: number) => values.sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];
  let eyeY = pickedEyes ? Math.max(...pickedEyes.map(p => p.y)) : percentile(face.map(i => body.pos[i * 3 + 1]), .72);
  const eyeX = pickedEyes ? pickedEyes.reduce((sum, p) => sum + p.x, 0) / pickedEyes.length : percentile(face.map(i => body.pos[i * 3]), .3);
  if (arg('--clear-headwear') === 'brown') {
    // A fringe can hide the upper face completely, biasing the skin sample to
    // the cheeks. The retained rig's iris meshes give the anatomical eye height.
    const irisY: number[] = [], point = new Vector3();
    for (const node of nodes) for (const primitive of node.getMesh()?.listPrimitives() ?? []) if (primitive.getMaterial()?.getName() === 'pal_eyeBrown') {
      const position = primitive.getAttribute('POSITION')!, matrix = world(node);
      const index = primitive.getIndices(), used = index ? new Set(Array.from({ length: index.getCount() }, (_, i) => index.getScalar(i))) : new Set(Array.from({ length: position.getCount() }, (_, i) => i));
      for (const i of used) irisY.push(point.fromArray(position.getElement(i, [])).applyMatrix4(matrix).y);
    }
    if (irisY.length) eyeY = Math.max(eyeY, percentile(irisY, .5));
  }
  const crown = cap.filter(i => body.pos[i * 3 + 1] > eyeY + headHeight * (arg('--brim-reach-scale') ? -.18 : pickedEyes ? -.25 : arg('--clear-headwear') === 'brown' ? .1 : .05)), brimY = Math.min(...crown.map(i => body.pos[i * 3 + 1]));
  const key = (i: number) => body.pos.slice(i * 3, i * 3 + 3).map(x => Math.round(x / 1e-6)).join(','), lifts = new Map<string, number>(), retractions = new Map<string, number>();
  const forwardMargin = pickedEyes ? .08 : .02, clearance = Number(arg('--brim-clearance', pickedEyes ? '.07' : '.035'));
  const reachScale = Number(arg('--brim-reach-scale', '1'));
  const sightline = Number(arg('--brim-sightline-degrees', '36')) * Math.PI / 180;
  if (!Number.isFinite(clearance) || clearance <= 0 || !Number.isFinite(reachScale) || reachScale <= 0 || reachScale > 1 || !Number.isFinite(sightline) || sightline <= 0 || sightline >= Math.PI / 2) throw Error('Invalid brim clearance, reach scale or sightline');
  const liftFraction = arg('--brim-sightline-degrees') ? .5 : arg('--clear-headwear') === 'brown' ? pickedEyes ? .5 : .35 : pickedEyes || arg('--brim-clearance') ? .3 : .2;
  for (const i of crown) {
    const x = body.pos[i * 3], y = body.pos[i * 3 + 1];
    if (arg('--clear-headwear') !== 'brown' && y > (arg('--brim-reach-scale') ? Math.max(brimY, eyeY) : brimY) + headHeight * (arg('--brim-sightline-degrees') ? .55 : pickedEyes ? .3 : .22) || x < eyeX - forwardMargin) continue;
    // A bound civilian's head leans during infection. Shorten the forward bill
    // around its measured face plane as well as lifting it, retaining the crown.
    const hinge = eyeX + headWidth * .12, forward = reachScale === 1 ? x : Math.min(x, hinge + Math.max(0, x - hinge) * reachScale);
    const delta = Math.min(headHeight * liftFraction, Math.max(0, eyeY + Math.tan(sightline) * (forward - eyeX) + clearance - y));
    lifts.set(key(i), Math.max(lifts.get(key(i)) ?? 0, delta));
    retractions.set(key(i), Math.max(retractions.get(key(i)) ?? 0, x - forward));
  }
  const changes = body.owner.map((_, i) => lifts.get(key(i)) ?? 0);
  const shortened = body.owner.map((_, i) => retractions.get(key(i)) ?? 0);
  for (let i = 0; i < changes.length; i++) { body.pos[i * 3] -= shortened[i]; body.pos[i * 3 + 1] += changes[i]; }
  fit.headwearClearance = { eyeX, eyeY, brimY, vertices: changes.filter((x, i) => x > 0 || shortened[i] > 0).length, maxLift: Math.max(...changes), maxRetraction: Math.max(...shortened) };
  rmSync(directory, { recursive: true, force: true });
}
if (args.includes('--retain-corgi-props')) {
  // The forward pink tongue is anatomical geometry in the continuous source. Give it
  // a head-local joint, so resting/panting retracts it without cutting the body.
  const directory = mkdtempSync(join(tmpdir(), 'corgi-tongue-')), input = join(directory, 'atlas.' + texture!.mime.split('/')[1]), output = join(directory, 'atlas.png');
  writeFileSync(input, texture!.image); execFileSync('sips', ['-s', 'format', 'png', input, '--out', output], { stdio: 'ignore' });
  const png = PNG.sync.read(readFileSync(output)), head = JOINTS.indexOf('head'), tongue = JOINTS.indexOf('tongue');
  const headXs = body.owner.flatMap((owner, i) => owner === head ? [body.pos[i * 3]] : []), front = Math.min(...headXs) + .68 * (Math.max(...headXs) - Math.min(...headXs));
  const points: Vector3[] = [];
  for (let i = 0; i < body.owner.length; i++) {
    if (body.owner[i] !== head || body.pos[i * 3] < front) continue;
    const x = Math.max(0, Math.min(png.width - 1, Math.floor(body.uv[i * 2] * png.width))), y = Math.max(0, Math.min(png.height - 1, Math.floor(body.uv[i * 2 + 1] * png.height))), offset = (y * png.width + x) * 4;
    const [r, g, b] = png.data.subarray(offset, offset + 3);
    if (r > 120 && r > g * 1.4 && b > g * .8 && b < r * .9) { body.owner[i] = tongue; points.push(new Vector3().fromArray(body.pos, i * 3)); }
  }
  if (points.length < 4) throw Error('Cannot identify the corgi tongue in the supplied atlas');
  const lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of points) { lo.min(p); hi.max(p); }
  const pivot = new Vector3(lo.x, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2).applyMatrix4(world(jointNode.get('head')!).invert());
  jointNode.get('tongue')!.setTranslation(pivot.toArray());
  fit.tongue = { vertices: points.length, pivot: pivot.toArray() }; rmSync(directory, { recursive: true, force: true });
}

const bodyBudget = Number(arg('--body-budget') ?? Infinity);
const contactCaps: { centre: number[]; rim: number[][] }[] = [];

if (args.includes('--fit-rig-height')) {
  // TRELLIS sometimes fuses a lowered glove/sleeve to the hip or thigh. That
  // contact is not an anatomical joint: skinning it produces a waist-to-hand
  // web when the hand rises. Remove only the cross-contact strip and close
  // its two original surface boundaries independently, retaining UV paint.
  const key = (i: number) => body.pos.slice(i * 3, i * 3 + 3).map(x => Math.round(x / 1e-6)).join(',');
  const welded = new Map<string, number>(), representatives: number[] = [], weld: number[] = [];
  for (let i = 0; i < body.owner.length; i++) { const k = key(i); if (!welded.has(k)) { welded.set(k, representatives.length); representatives.push(i); } weld.push(welded.get(k)!); }
  body.owner = body.owner.map((_, i) => body.owner[representatives[weld[i]]]);
  const armSide = (part: string) => /^(arm|foreArm|hand)[LR]$/.test(part) ? part.slice(-1) : null;
  // Nearest-surface labels can leave little trouser islands inside a bulky
  // glove. Resolve those enclosed islands before opening the contact seam.
  const links: Set<number>[] = Array.from({ length: representatives.length }, () => new Set());
  for (let t = 0; t < body.tris.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = weld[body.tris[t + e]], b = weld[body.tris[t + (e + 1) % 3]]; links[a].add(b); links[b].add(a);
  }
  const region = representatives.map(i => armSide(JOINTS[body.owner[i]]) ?? 'body'), seen = new Set<number>();
  const groups: number[][] = [];
  for (let start = 0; start < links.length; start++) if (!seen.has(start)) {
    const group: number[] = [], stack = [start]; seen.add(start);
    while (stack.length) { const at = stack.pop()!; group.push(at); for (const to of links[at]) if (!seen.has(to) && region[to] === region[start]) { seen.add(to); stack.push(to); } }
    groups.push(group);
  }
  const largest = new Map<string, number>();
  for (const group of groups) largest.set(region[group[0]], Math.max(largest.get(region[group[0]]) ?? 0, group.length));
  for (const group of groups) {
    const kind = region[group[0]]; if (group.length === largest.get(kind)) continue;
    const neighbours = group.flatMap(at => [...links[at]].filter(to => region[to] !== kind));
    const counts = new Map<number, number>(); for (const to of neighbours) { const owner = body.owner[representatives[to]]; counts.set(owner, (counts.get(owner) ?? 0) + 1); }
    const replacement = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (replacement === undefined) continue;
    const members = new Set(group); for (let i = 0; i < body.owner.length; i++) if (members.has(weld[i])) body.owner[i] = replacement;
  }
  const forbidden = (a: number, b: number) => {
    const x = JOINTS[body.owner[a]], y = JOINTS[body.owner[b]], side = armSide(x);
    return !!side && /^(foreArm|hand)/.test(x) && armSide(y) !== side;
  };
  let kept: number[] = [], removed = 0;
  for (let pass = 0; pass < 3; pass++) {
    kept = []; removed = 0;
    for (let t = 0; t < body.tris.length; t += 3) {
      const face = body.tris.slice(t, t + 3);
      if (face.some(a => face.some(b => forbidden(a, b)))) removed++;
      else kept.push(...face);
    }
    // A bulky glove may contain a small patch nearer the template's thigh.
    // Removing its contact strip exposes that mislabelled island. Flood it
    // back into the surrounding arm instead of deleting painted anatomy.
    const graph: Set<number>[] = Array.from({ length: representatives.length }, () => new Set());
    for (let t = 0; t < kept.length; t += 3) for (let e = 0; e < 3; e++) { const a = weld[kept[t + e]], b = weld[kept[t + (e + 1) % 3]]; graph[a].add(b); graph[b].add(a); }
    const seen = new Set<number>(), groups: number[][] = [];
    for (let start = 0; start < graph.length; start++) if (graph[start].size && !seen.has(start)) {
      const group: number[] = [], stack = [start]; seen.add(start);
      while (stack.length) { const at = stack.pop()!; group.push(at); for (const to of graph[at]) if (!seen.has(to)) { seen.add(to); stack.push(to); } }
      groups.push(group);
    }
    const largest = Math.max(...groups.map(group => group.length)); let changed = false;
    for (const group of groups) {
      if (group.length === largest || group.length > largest * .03) continue;
      const names = group.map(w => JOINTS[body.owner[representatives[w]]]);
      if (!names.every(name => /^(leg|shin)[LR]$/.test(name) && name.endsWith(names[0].slice(-1)))) continue;
      const members = new Set(group), choices = new Map<number, number>();
      for (let t = 0; t < body.tris.length; t += 3) {
        const face = body.tris.slice(t, t + 3); if (!face.some(i => members.has(weld[i]))) continue;
        for (const i of face) if (armSide(JOINTS[body.owner[i]]) === names[0].slice(-1)) choices.set(body.owner[i], (choices.get(body.owner[i]) ?? 0) + 1);
      }
      const replacement = [...choices].sort((a, b) => b[1] - a[1])[0]?.[0]; if (replacement === undefined) continue;
      for (let i = 0; i < body.owner.length; i++) if (members.has(weld[i])) body.owner[i] = replacement;
      changed = true;
    }
    if (!changed) break;
  }
  if (removed) {
    const edges = new Map<string, { a: number; b: number; count: number }>();
    for (let t = 0; t < kept.length; t += 3) for (let e = 0; e < 3; e++) {
      const a = weld[kept[t + e]], b = weld[kept[t + (e + 1) % 3]]; if (a === b) continue;
      const k = a < b ? `${a}/${b}` : `${b}/${a}`, old = edges.get(k);
      if (old) old.count++; else edges.set(k, { a, b, count: 1 });
    }
    const boundary = [...edges.values()].filter(edge => edge.count === 1), next = new Map<number, number[]>();
    for (const edge of boundary) { const targets = next.get(edge.a) ?? []; targets.push(edge.b); next.set(edge.a, targets); }
    let caps = 0;
    while (next.size) {
      const path: number[] = [], seen = new Map<number, number>(); let at = next.keys().next().value!;
      while (!seen.has(at)) {
        seen.set(at, path.length); path.push(at);
        const targets = next.get(at); if (!targets?.length) throw Error('Open fused-contact boundary'); at = targets[0];
      }
      const loop = path.slice(seen.get(at)!);
      if (loop.length < 3) throw Error('Invalid fused-contact boundary');
      for (let i = 0; i < loop.length; i++) {
        const targets = next.get(loop[i])!, to = loop[(i + 1) % loop.length]; targets.splice(targets.indexOf(to), 1);
        if (!targets.length) next.delete(loop[i]);
      }
      const original = loop.map(w => representatives[w]), positions = original.map(i => new Vector3().fromArray(body.pos, i * 3));
      const centre = positions.reduce((p, q) => p.add(q), new Vector3()).multiplyScalar(1 / positions.length), normal = new Vector3();
      for (let i = 0; i < positions.length; i++) normal.add(new Vector3().subVectors(positions[i], centre).cross(new Vector3().subVectors(positions[(i + 1) % positions.length], centre)));
      if (normal.lengthSq() < 1e-14) throw Error('Degenerate fused-contact cap');
      centre.addScaledVector(normal.normalize(), -.0002);
      const colourUV = body.uv.slice(original[0] * 2, original[0] * 2 + 2), duplicates = original.map(i => {
        const index = body.owner.length; body.pos.push(...body.pos.slice(i * 3, i * 3 + 3)); body.uv.push(...colourUV); body.owner.push(body.owner[i]); return index;
      });
      const centreIndex = body.owner.length; body.pos.push(...centre.toArray()); body.uv.push(...colourUV); body.owner.push(body.owner[original[0]]);
      contactCaps.push({ centre: centre.toArray(), rim: positions.map(p => p.toArray()) });
      for (let i = 0; i < duplicates.length; i++) kept.push(duplicates[(i + 1) % duplicates.length], duplicates[i], centreIndex);
      caps++;
    }
    body.tris = kept;
    // A contact strip can leave a closed, sub-millimetre tetrahedron at a
    // pinched vertex. Match the existing surface recovery's 0.1% area rule;
    // never discard a substantial anatomical component.
    const ids = new Map<string, number>(), map = body.owner.map((_, i) => { const k = key(i); if (!ids.has(k)) ids.set(k, ids.size); return ids.get(k)!; });
    const links: Set<number>[] = Array.from({ length: ids.size }, () => new Set());
    for (let t = 0; t < kept.length; t += 3) for (let e = 0; e < 3; e++) { const a = map[kept[t + e]], b = map[kept[t + (e + 1) % 3]]; links[a].add(b); links[b].add(a); }
    const group = new Int32Array(ids.size).fill(-1); let count = 0;
    for (let start = 0; start < links.length; start++) if (group[start] < 0 && links[start].size) {
      const stack = [start]; group[start] = count;
      while (stack.length) for (const next of links[stack.pop()!]) if (group[next] < 0) { group[next] = count; stack.push(next); }
      count++;
    }
    const areas = new Float64Array(count), triangle = new Triangle();
    for (let t = 0; t < kept.length; t += 3) { triangle.a.fromArray(body.pos, kept[t] * 3); triangle.b.fromArray(body.pos, kept[t + 1] * 3); triangle.c.fromArray(body.pos, kept[t + 2] * 3); areas[group[map[kept[t]]]] += triangle.getArea(); }
    const main = areas.indexOf(Math.max(...areas)), totalArea = areas.reduce((a, b) => a + b, 0);
    if ([...areas].some((area, i) => i !== main && area >= totalArea * .001)) throw Error(`Contact repair separated an anatomical component: ${JSON.stringify([...areas].map((area, component) => ({ area, fraction: area / totalArea, bounds: [0, 1, 2].map(axis => { const values = kept.filter(i => group[map[i]] === component).map(i => body.pos[i * 3 + axis]); return [Math.min(...values), Math.max(...values)]; }), owners: [...new Set(kept.filter(i => group[map[i]] === component).map(i => JOINTS[body.owner[i]]))] })))}`);
    const cleaned: number[] = [];
    for (let t = 0; t < kept.length; t += 3) if (group[map[kept[t]]] === main) cleaned.push(...kept.slice(t, t + 3));
    body.tris = cleaned; fit.contactRepair = { removedTriangles: removed, closedBoundaries: caps, removedScrapTriangles: (kept.length - cleaned.length) / 3 };
  }
}

// Repair the full-resolution anatomy before deriving the budgeted tiers.
if (body.tris.length / 3 > bodyBudget) {
  let [indices] = MeshoptSimplifier.simplify(new Uint32Array(body.tris), new Float32Array(body.pos), 3, Math.floor(bodyBudget) * 3, .02, ['Permissive']);
  if (indices.length / 3 > bodyBudget) [indices] = MeshoptSimplifier.simplifySloppy(new Uint32Array(body.tris), new Float32Array(body.pos), 3, null, Math.floor(bodyBudget) * 3, .05);
  if (indices.length / 3 > bodyBudget) throw Error(`Cannot retain silhouette within body budget ${bodyBudget}`);
  body.tris = [...indices];
}
const used = [...new Set(body.tris)], remap = new Map(used.map((v, i) => [v, i]));
body = { pos: used.flatMap(i => body.pos.slice(i * 3, i * 3 + 3)), uv: used.flatMap(i => body.uv.slice(i * 2, i * 2 + 2)), owner: used.map(i => body.owner[i]), tris: body.tris.map(i => remap.get(i)!) };

// ---- weld, graph --------------------------------------------------------------------------------
const n = body.pos.length / 3, weldOf = new Int32Array(n), keys = new Map<string, number>();
let welded = 0;
for (let i = 0; i < n; i++) {
  const key = `${Math.round(body.pos[i * 3] / (bodyPath ? 1e-6 : 2e-4))},${Math.round(body.pos[i * 3 + 1] / (bodyPath ? 1e-6 : 2e-4))},${Math.round(body.pos[i * 3 + 2] / (bodyPath ? 1e-6 : 2e-4))}`;
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
const positionKey = (p: number[]) => p.map(x => Math.round(x / 1e-6)).join(',');
const weldedPositions = new Map(Array.from({ length: welded }, (_, w) => [positionKey(Array.from(wpos.slice(w * 3, w * 3 + 3))), w]));
const capWeights = contactCaps.flatMap(cap => {
  const centre = weldedPositions.get(positionKey(cap.centre));
  const rim = cap.rim.flatMap(p => { const w = weldedPositions.get(positionKey(p)); return w === undefined ? [] : [w]; });
  return centre === undefined || !rim.length ? [] : [{ centre, rim }];
});
const capCentres = new Set(capWeights.map(cap => cap.centre));
const seams: Record<string, { seamVertices: number; band: number; blended: number }> = {};
let unrelatedSeams = 0;
// Blend across every seam between related owners: ancestor/descendant, or siblings under a joint that owns no
// surface (the suit's hip: the torso part owns the pelvis, the legs hang off the hip). Limbs of different chains
// that touch (a hand on a thigh) are never blended.
const owning = new Set(owner);
const ancestors = (j: number) => { const out: number[] = []; for (let q = parentJoint.get(JOINTS[j]); q; q = parentJoint.get(q)) out.push(JOINTS.indexOf(q as typeof JOINTS[number])); return out; };
const related = (x: number, y: number) => {
  if (args.includes('--fit-rig-height') && (ancestors(x).includes(y) || ancestors(y).includes(x))) return true;
  const owningParent = (j: number) => ancestors(j).find(a => owning.has(a));
  if (owningParent(x) === y || owningParent(y) === x) return true;
  const px = ancestors(x)[0], py = ancestors(y)[0];
  return px === py && !owning.has(px);
};
const edgeLengths = [...edgeUse.keys()].map(key => { const [x, y] = key.split(',').map(Number); return dist(x, y); }).sort((x, y) => x - y);
const medianEdge = edgeLengths[edgeLengths.length >> 1];
const pairs = new Map<string, [number, number]>();
for (let w = 0; w < welded; w++) for (const u of neighbours[w]) if (owner[u] !== owner[w]) {
  if (capCentres.has(w) || capCentres.has(u)) continue;
  if (!related(owner[u], owner[w])) { unrelatedSeams++; continue; }
  const lo = Math.min(owner[u], owner[w]), hi = Math.max(owner[u], owner[w]); pairs.set(`${lo},${hi}`, [lo, hi]);
}
for (const [x, y] of pairs.values()) {
  // The deeper joint is the child; its band applies.
  // Coarse LODs: the band always reaches at least the first ring of vertices on each side.
  const [p, c] = ancestors(x).length > ancestors(y).length ? [y, x] : [x, y], child = `${JOINTS[c]}/${JOINTS[p]}`, base = BAND[JOINTS[c]] * height / 1.8;
  let band = Math.max(base, Math.min(medianEdge, 2 * base)), crossingSpan = 0;
  // Seam = vertices with a neighbour on the other side. Distance d runs along edges on each side.
  const d = new Float64Array(welded).fill(Infinity), heap: [number, number][] = [];
  let seamCount = 0;
  for (let w = 0; w < welded; w++) if (owner[w] === c || owner[w] === p) for (const u of neighbours[w]) if ((owner[w] === c && owner[u] === p) || (owner[w] === p && owner[u] === c)) {
    if (capCentres.has(w) || capCentres.has(u)) continue;
    // Place the seam half-way along the crossing edge.
    const span = dist(w, u); crossingSpan = Math.max(crossingSpan, span);
    const half = span / 2; if (half < d[w]) { d[w] = half; heap.push([half, w]); }
  }
  if (args.includes('--fit-rig-height')) band = Math.max(band, Math.min(height * .12, crossingSpan * 2.1));
  for (let w = 0; w < welded; w++) if (d[w] < Infinity) seamCount++;
  heap.sort((a, b) => a[0] - b[0]);
  // Small graphs: a sorted frontier (Dijkstra) is fast enough.
  const queue = new MinHeap(); for (const [k, w] of heap) queue.push(k, w);
  while (queue.size) {
    const [k, w] = queue.pop(); if (k > d[w] || k > band) continue;
    for (const u of neighbours[w]) { if (owner[u] !== owner[w] || capCentres.has(u)) continue; const nd = k + dist(w, u); if (nd < d[u]) { d[u] = nd; queue.push(nd, u); } }
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
// Closure centres interpolate their rim; an arbitrary first vertex must never
// introduce an extra anatomical seam or pull a thigh cap with a raised hand.
for (const cap of capWeights) {
  const average = new Map<number, number>();
  for (const w of cap.rim) for (const [joint, weight] of weights[w]) average.set(joint, (average.get(joint) ?? 0) + weight / cap.rim.length);
  weights[cap.centre] = average;
}
if (args.includes('--fit-rig-height')) {
  // Relax intersecting shoulder/hip blend bands on the surface graph. Local
  // of local passes removes abrupt multi-joint transitions without spatially
  // bleeding a glove into the neighbouring leg across a gap.
  const passes = body.tris.length / 3 < 3000 ? 4 : 2;
  for (let pass = 0; pass < passes; pass++) {
    const next = weights.map((row, w) => {
      if (!neighbours[w].size) return new Map(row);
      const result = new Map([...row].map(([joint, weight]) => [joint, weight * .5]));
      for (const to of neighbours[w]) for (const [joint, weight] of weights[to]) result.set(joint, (result.get(joint) ?? 0) + weight * .5 / neighbours[w].size);
      return result;
    });
    for (let w = 0; w < welded; w++) weights[w] = next[w];
  }
  fit.weightRelaxationPasses = passes;
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
const capMaterial = out.createMaterial('pal_blood').setBaseColorFactor([.4508, .006, .0137, 1]).setMetallicFactor(0).setRoughnessFactor(1);
const clone = (node: GNode, cap = false): GNode | null => {
  if (retained(node)) {
    const c = copyToDocument(out, rig, [node]).get(node) as GNode; copy.set(node, c); return c;
  }
  cap ||= node.getName().startsWith('stump_');
  if (node.getMesh() && !cap) return null;
  const c = out.createNode(node.getName()).setTranslation(node.getTranslation()).setRotation(node.getRotation()).setScale(node.getScale()).setExtras({ ...node.getExtras(), ...(node.getName().startsWith('stump_') ? { hidden: true } : {}) });
  copy.set(node, c);
  if (cap && node.getMesh()) {
    const mesh = out.createMesh(node.getName());
    for (const source of node.getMesh()!.listPrimitives()) {
      const primitive = out.createPrimitive().setMaterial(capMaterial);
      for (const semantic of ['POSITION', 'NORMAL']) { const a = source.getAttribute(semantic); if (a) primitive.setAttribute(semantic, out.createAccessor().setType(a.getType()).setArray(a.getArray()!.slice()).setNormalized(a.getNormalized())); }
      const index = source.getIndices(); if (index) primitive.setIndices(out.createAccessor().setType('SCALAR').setArray(index.getArray()!.slice()));
      mesh.addPrimitive(primitive);
    }
    c.setMesh(mesh);
  }
  for (const child of node.listChildren()) { const cc = clone(child, cap); if (cc) c.addChild(cc); } return c;
};
const scene = out.createScene('scene');
for (const top of sceneRoot.listChildren()) { const c = clone(top); if (c) scene.addChild(c); }
// An alternate fitted template owns its standing bind pose. Imported story
// metadata describes the legacy rig (which may put scale on a different node).
// Restoring that stale pose before civilian baking stretches the new sleeves.
if (contract && rigPath !== contractPath) adoptStandingBind(out);

// Preserve the legacy rest-only pivot contract. Production removes these
// pivots before sampling rest/movement clips, so the new neutral skin carries
// no old rigid cushion geometry.
if (contract) {
  const originalRoot = contract.getRoot().listNodes().find(node => node.getName() === 'root');
  const rawRestOnly = (originalRoot?.getExtras() as { restOnlyNodes?: string[] | string } | undefined)?.restOnlyNodes;
  const restOnly = typeof rawRestOnly === 'string' ? [rawRestOnly] : rawRestOnly ?? [];
  const originalNodes = contract.getRoot().listNodes(), outputNodes = out.getRoot().listNodes();
  for (const name of restOnly) {
    if (outputNodes.some(node => node.getName() === name)) continue;
    const original = originalNodes.find(node => node.getName() === name);
    if (!original) throw new Error(`Missing contract rest-only node ${name}`);
    const parentName = original.getParentNode()?.getName(), parent = outputNodes.find(node => node.getName() === parentName) ?? outputNodes.find(node => node.getName() === 'root');
    if (!parent) throw new Error(`Missing output owner for contract rest-only prop ${name}`);
    // Rest-only props are hidden/removed before the crowd's standing rig and
    // corpse poses run. Preserve their named pivot, not obsolete rigid geometry
    // that would reintroduce the old model or inflate the skinned body bounds.
    const copied = out.createNode(name).setExtras({ ...original.getExtras() });
    copied.setMatrix(new Matrix4().fromArray(parent.getWorldMatrix()).invert().multiply(new Matrix4().fromArray(original.getWorldMatrix())).toArray());
    parent.addChild(copied);
  }
}

if (!out.getRoot().listNodes().some(n => n.getName() === 'front')) {
  const root = copy.get(jointNode.get('root')!)!, front = new Vector3(Math.max(...body.pos.filter((_, i) => i % 3 === 0)), 0, 0).applyMatrix4(world(jointNode.get('root')!).invert());
  root.addChild(out.createNode('front').setTranslation(front.toArray()).setExtras({ front: true }));
}
const propsPath = arg('--props');
if (propsPath) {
  const props = await io.read(propsPath), recipe = JSON.parse(readFileSync(arg('--props-recipe')!, 'utf8')) as { lods: { lod: number; props: { name: string; intended_owner: string; exact_owner?: boolean; bind_matrix?: number[] }[] }[] };
  const entries = recipe.lods.find(l => l.lod === Number(arg('--props-lod', '0')))!.props;
  const selected = props.getRoot().listNodes().filter(n => n.getMesh() && entries.some(e => e.name === n.getName()) && !(args.includes('--retain-corgi-props') && /pack/.test(n.getName())));
  const copied = copyToDocument(out, props, selected);
  for (const source of selected) {
    const entry = entries.find(e => e.name === source.getName())!;
    let owner = jointNode.get(entry.intended_owner) ?? jointNode.get(entry.intended_owner === 'neck' ? 'head' : 'torso') ?? jointNode.get('body');
    if (!owner) throw Error(`No rig owner for prop ${entry.name}`);
    if (/^hand[LR]$/.test(entry.intended_owner) && !entry.exact_owner) {
      const low = new Vector3(Infinity, Infinity, Infinity), high = new Vector3(-Infinity, -Infinity, -Infinity), point = new Vector3();
      for (const primitive of source.getMesh()!.listPrimitives()) {
        const position = primitive.getAttribute('POSITION')!;
        const index = primitive.getIndices(), used = index ? new Set(Array.from({ length: index.getCount() }, (_, i) => index.getScalar(i))) : new Set(Array.from({ length: position.getCount() }, (_, i) => i));
        for (const i of used) { point.fromArray(position.getElement(i, [])); low.min(point); high.max(point); }
      }
      const centre = low.add(high).multiplyScalar(.5).applyMatrix4(bodyTransform.clone().multiply(world(source)));
      owner = ['handL', 'handR'].map(name => jointNode.get(name)!).sort((a, b) => new Vector3().setFromMatrixPosition(world(a)).distanceToSquared(centre) - new Vector3().setFromMatrixPosition(world(b)).distanceToSquared(centre))[0];
    }
    const bindings = (fit.propBindings ??= []) as { prop: string; intended: string; owner: string }[];
    bindings.push({ prop: entry.name, intended: entry.intended_owner, owner: owner.getName() });
    const node = copied.get(source) as GNode;
    for (const primitive of node.getMesh()!.listPrimitives()) {
      primitive.getMaterial()?.setName('tex_baseColor');
      // A carried clipboard follows the hand, but its paint is not skin.
      if (args.includes('--healthy') && /^hand[LR]$/.test(owner.getName())) primitive.setAttribute('_CROWD_REGION', out.createAccessor().setType('SCALAR').setArray(new Float32Array(primitive.getAttribute('POSITION')!.getCount())));
    }
    // Authored rigid attachments retain their joint-local grip/fit when a
    // neutral arm is refitted. Source-space placement alone can float an axe
    // at the former wrist position after that bone moves.
    const binding = entry.bind_matrix ? new Matrix4().fromArray(entry.bind_matrix).invert() : world(owner).invert().multiply(bodyTransform);
    node.setMatrix(binding.multiply(world(source)).toArray());
    copy.get(owner)!.addChild(node);
  }
}
const outJoints = JOINTS.map(name => copy.get(jointNode.get(name)!)!);
const inverseBinds = new Float32Array(JOINTS.length * 16);
JOINTS.forEach((name, i) => new Matrix4().fromArray(jointNode.get(name)!.getWorldMatrix()).invert().toArray(inverseBinds, i * 16));
const skin = out.createSkin('crowd_skin').setSkeleton(outJoints[0]).setInverseBindMatrices(out.createAccessor().setType('MAT4').setArray(inverseBinds));
for (const j of outJoints) skin.addJoint(j);
const material = out.createMaterial('tex_baseColor').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1);
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
if (mime === 'image/ktx2') out.createExtension((await import('@gltf-transform/extensions')).KHRTextureBasisu).setRequired(true);
if (image) material.setBaseColorTexture(out.createTexture('atlas').setImage(new Uint8Array(image)).setMimeType(mime!));
const prim = out.createPrimitive().setMaterial(material);
const positions = new Float32Array(n * 3), normals = new Float32Array(n * 3), uvs = new Float32Array(n * 2), J = new Uint16Array(n * 4), W = new Float32Array(n * 4);
const semanticParts = new Uint16Array(n);
let zeroNormals = 0;
for (let i = 0; i < n; i++) {
  const w = weldOf[i]; const nx = wnormal[w * 3], ny = wnormal[w * 3 + 1], nz = wnormal[w * 3 + 2], len = Math.hypot(nx, ny, nz);
  for (let c = 0; c < 3; c++) positions[i * 3 + c] = body.pos[i * 3 + c];
  // Degenerate welded fans have no area: a zero normal normalizes to NaN on the GPU (black bloom blocks).
  if (len < 1e-12) { normals[i * 3 + 1] = 1; zeroNormals++; } else { normals[i * 3] = nx / len; normals[i * 3 + 1] = ny / len; normals[i * 3 + 2] = nz / len; }
  uvs[i * 2] = body.uv[i * 2]; uvs[i * 2 + 1] = body.uv[i * 2 + 1];
  for (let k = 0; k < 4; k++) { J[i * 4 + k] = joints4[w * 4 + k]; W[i * 4 + k] = weights4[w * 4 + k]; }
  let major = 0; for (let k = 1; k < 4; k++) if (W[i * 4 + k] > W[i * 4 + major]) major = k;
  semanticParts[i] = J[i * 4 + major];
}
if (args.includes('--healthy') && texture && texture.mime !== 'image/ktx2') {
  const directory = mkdtempSync(join(tmpdir(), 'crowd-skin-region-')), input = join(directory, 'image.' + texture.mime.split('/')[1]), output = join(directory, 'image.png');
  writeFileSync(input, texture.image); execFileSync('sips', ['-s', 'format', 'png', input, '--out', output], { stdio: 'ignore' });
  const png = PNG.sync.read(readFileSync(output)), regions = new Float32Array(n);
  const handRatios: number[][] = [];
  for (let i = 0; i < n; i++) if (/^hand[LR]$/.test(JOINTS[body.owner[i]])) {
    const x = Math.max(0, Math.min(png.width - 1, Math.floor(body.uv[i * 2] * png.width))), y = Math.max(0, Math.min(png.height - 1, Math.floor(body.uv[i * 2 + 1] * png.height))), offset = (y * png.width + x) * 4;
    const r = png.data[offset], g = png.data[offset + 1], b = png.data[offset + 2];
    if (r > 64 && g / r > .5 && g / r < .96 && b < r) handRatios.push([g / r, b / r]);
  }
  const skinRatio = [0, 1].map(axis => handRatios.map(rgb => rgb[axis]).sort((a, b) => a - b)[Math.floor(handRatios.length / 2)]);
  // Brown hair shares skin's warm hue. Separate the brighter facial paint from
  // the darker hair before tagging infection and measuring the bare skull.
  const headWarm: number[] = [];
  for (let i = 0; i < n; i++) if (JOINTS[body.owner[i]] === 'head') {
    const x = Math.max(0, Math.min(png.width - 1, Math.floor(body.uv[i * 2] * png.width))), y = Math.max(0, Math.min(png.height - 1, Math.floor(body.uv[i * 2 + 1] * png.height))), offset = (y * png.width + x) * 4;
    const r = png.data[offset], g = png.data[offset + 1], b = png.data[offset + 2];
    if (r > 48 && g / r > .5 && g / r < .96 && b < r * 1.05) headWarm.push(r);
  }
  headWarm.sort((a, b) => a - b);
  // The smooth bun can have twenty times as many vertices as the flat face.
  // Use its bright tail, rather than a density-biased median of the whole head.
  const faceRedMin = (headWarm[Math.floor(headWarm.length * .95)] ?? 0) * .68;
  const faceBounds = new Box3(), point = new Vector3();
  for (const node of nodes) {
    let parent: GNode | null = node; while (parent && parent !== jointNode.get('head')) parent = parent.getParentNode();
    if (!parent) continue;
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) if (/^(pal_)?skin/.test(primitive.getMaterial()?.getName() ?? '')) {
      const position = primitive.getAttribute('POSITION')!, index = primitive.getIndices(), used = index ? new Set(Array.from({ length: index.getCount() }, (_, i) => index.getScalar(i))) : new Set(Array.from({ length: position.getCount() }, (_, i) => i));
      for (const i of used) faceBounds.expandByPoint(point.fromArray(position.getElement(i, [])).applyMatrix4(world(node)));
    }
  }
  const faceRatios: number[][] = [], faceHeight = faceBounds.max.y - faceBounds.min.y, front = (faceBounds.min.x + faceBounds.max.x) / 2;
  for (let i = 0; i < n; i++) if (JOINTS[body.owner[i]] === 'head' && body.pos[i * 3] > front && body.pos[i * 3 + 1] > faceBounds.min.y + faceHeight * .2 && body.pos[i * 3 + 1] < faceBounds.min.y + faceHeight * .75) {
    const x = Math.max(0, Math.min(png.width - 1, Math.floor(body.uv[i * 2] * png.width))), y = Math.max(0, Math.min(png.height - 1, Math.floor(body.uv[i * 2 + 1] * png.height))), offset = (y * png.width + x) * 4;
    const [r, g, b] = png.data.subarray(offset, offset + 3);
    if (r >= faceRedMin && g / r > .5 && g / r < .96 && b < r * 1.05) faceRatios.push([g / r, b / r]);
  }
  if (args.includes('--fit-rig-height') && faceRatios.length < 4) throw Error('Cannot identify exposed face paint for the infection mask');
  const measuredSkin = faceRatios.length >= 4 ? [0, 1].map(axis => faceRatios.map(rgb => rgb[axis]).sort((a, b) => a - b)[Math.floor(faceRatios.length / 2)]) : skinRatio;
  fit.skinPaint = { samples: faceRatios.length, ratios: measuredSkin };
  for (let i = 0; i < n; i++) {
    const part = JOINTS[body.owner[i]];
    if (!args.includes('--fit-rig-height') && /^hand[LR]$/.test(part)) { regions[i] = 1; continue; }
    if (part !== 'head' && !/^(arm|foreArm|hand|leg|shin)[LR]$/.test(part)) continue;
    const x = Math.max(0, Math.min(png.width - 1, Math.floor(body.uv[i * 2] * png.width))), y = Math.max(0, Math.min(png.height - 1, Math.floor(body.uv[i * 2 + 1] * png.height))), offset = (y * png.width + x) * 4;
    const r = png.data[offset], g = png.data[offset + 1], b = png.data[offset + 2];
    // Healthy skin paint is warm and moderately saturated; dark/auburn hair, neutral frames and red wounds stay authored.
    const warm = r > 48 && g / Math.max(1, r) > .5 && g / Math.max(1, r) < .96 && b < r * 1.05;
    const faceBand = part !== 'head' || faceBounds.isEmpty() || body.pos[i * 3 + 1] < faceBounds.max.y + .025;
    regions[i] = Number(warm && (args.includes('--fit-rig-height')
      ? faceBand && Math.abs(g / r - measuredSkin[0]) < .08 && Math.abs(b / r - measuredSkin[1]) < .08 && (part !== 'head' || r >= faceRedMin)
      : part === 'head' ? r >= faceRedMin : handRatios.length && Math.abs(g / r - skinRatio[0]) < .12 && Math.abs(b / r - skinRatio[1]) < .12));
  }
  prim.setAttribute('_CROWD_REGION', out.createAccessor().setType('SCALAR').setArray(regions));
  rmSync(directory, { recursive: true, force: true });
}
prim.setAttribute('_CROWD_PART', out.createAccessor().setType('SCALAR').setArray(semanticParts));
prim.setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(positions));
prim.setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(normals));
prim.setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(uvs));
prim.setAttribute('JOINTS_0', out.createAccessor().setType('VEC4').setArray(J));
prim.setAttribute('WEIGHTS_0', out.createAccessor().setType('VEC4').setArray(W));
prim.setIndices(out.createAccessor().setType('SCALAR').setArray(n > 65535 ? new Uint32Array(body.tris) : new Uint16Array(body.tris)));
const bodyMesh = out.createMesh('skin_body').addPrimitive(prim);
scene.addChild(out.createNode('skin_body').setMesh(bodyMesh).setSkin(skin));
// The rigid export's old discs can lie inside a weighted neck/shoulder.
// Close the actual boundary left when whole triangles of a limb are removed.
// Rim vertices retain the body's weights, so their posed seam stays welded.
const capFits: { part: string; rim: number; triangles: number; loops: number; distance: number; method: string }[] = [];
if (!args.includes('--retain-corgi-props')) {
  const cuts: Record<string, readonly string[]> = { head: ['head'], armL: ['armL', 'foreArmL', 'handL'], armR: ['armR', 'foreArmR', 'handR'], foreArmL: ['foreArmL', 'handL'], foreArmR: ['foreArmR', 'handR'], legL: ['legL', 'shinL', 'footL'], legR: ['legR', 'shinR', 'footR'] };
  for (const parts of crowdLimbParts(quadruped)) cuts[parts[0]] = parts;
  if (quadruped) { cuts.foreArmL = ['foreArmL', 'handL', 'pawFL']; cuts.foreArmR = ['foreArmR', 'handR', 'pawFR']; }
  const representative = new Map<number, number>(); weldOf.forEach((w, i) => representative.set(w, i));
  const owners = Array.from(semanticParts, part => JOINTS[part]);
  const originalEdges = new Map<string, number>();
  for (let t = 0; t < body.tris.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = weldOf[body.tris[t + k]], b = weldOf[body.tris[t + (k + 1) % 3]], key = a < b ? `${a}/${b}` : `${b}/${a}`; originalEdges.set(key, (originalEdges.get(key) ?? 0) + 1);
  }
  const at = (w: number) => new Vector3().fromArray(positions, representative.get(w)! * 3);
  for (const [part, removed] of Object.entries(cuts)) {
    const sourceCap = nodes.find(node => node.getName() === `stump_${part}`);
    let target = sourceCap && copy.get(sourceCap);
    if (!target) {
      target = out.createNode(`stump_${part}`).setExtras({ hidden: true });
      const parent = parentJoint.get(part);
      (parent ? outJoints[JOINTS.indexOf(parent)] : scene).addChild(target);
    }
    const edges = new Map<string, { a: number; b: number; count: number }>();
    for (let t = 0; t < body.tris.length; t += 3) {
      const triangle = body.tris.slice(t, t + 3); if (triangle.some(i => removed.includes(owners[i]))) continue;
      for (let k = 0; k < 3; k++) {
        const a = weldOf[triangle[k]], b = weldOf[triangle[(k + 1) % 3]], key = a < b ? `${a}/${b}` : `${b}/${a}`;
        const edge = edges.get(key); if (edge) edge.count++; else edges.set(key, { a, b, count: 1 });
      }
    }
    const outgoing = new Map<number, { b: number; key: string }[]>();
    for (const [key, edge] of edges) if (edge.count % 2 === 1) {
      outgoing.set(edge.a, [...outgoing.get(edge.a) ?? [], { b: edge.b, key }]);
      outgoing.set(edge.b, [...outgoing.get(edge.b) ?? [], { b: edge.a, key }]);
    }
    const visited = new Set<string>(), loops: number[][] = [];
    const splitLoops = (walk: number[]): void => {
      const seen = new Map<number, number>();
      for (let i = 0; i < walk.length; i++) {
        const previous = seen.get(walk[i]);
        if (previous !== undefined) { splitLoops(walk.slice(previous, i)); splitLoops(walk.slice(0, previous).concat(walk.slice(i))); return; }
        seen.set(walk[i], i);
      }
      if (walk.length >= 3) loops.push(walk);
    };
    for (const [start, choices] of outgoing) for (const first of choices) {
      if (visited.has(first.key)) continue;
      const loop = [start]; let edge = first, current = start;
      while (!visited.has(edge.key)) {
        visited.add(edge.key); current = edge.b; if (current === start) break;
        loop.push(current); const next = outgoing.get(current)?.find(candidate => !visited.has(candidate.key)); if (!next) break; edge = next;
      }
      if (current === start) splitLoops(loop);
    }
    const fresh = (loop: number[]) => loop.filter((a, i) => { const b = loop[(i + 1) % loop.length]; return (originalEdges.get(a < b ? `${a}/${b}` : `${b}/${a}`) ?? 0) > 1; }).length / loop.length;
    const created = loops.filter(loop => fresh(loop) > 0);
    if (created.length) loops.splice(0, loops.length, ...created);
    const cutRoot = quadruped && part === 'head' && jointNode.has('neck') ? 'neck' : part;
    const pivot = new Vector3().setFromMatrixPosition(world(jointNode.get(cutRoot)!));
    const missing = new Vector3(); let count = 0;
    for (let i = 0; i < n; i++) if (removed.includes(owners[i])) { missing.add(new Vector3().fromArray(positions, i * 3)); count++; }
    if (count) missing.divideScalar(count);
    else {
      const parent = parentJoint.get(part), origin = parent ? new Vector3().setFromMatrixPosition(world(jointNode.get(parent)!)) : pivot.clone().add(new Vector3(0, .1, 0));
      missing.copy(pivot).sub(origin).normalize().multiplyScalar(.1).add(pivot);
    }
    const centreOf = (loop: number[]) => loop.reduce((sum, w) => sum.add(at(w)), new Vector3()).divideScalar(loop.length);
    const normalOf = (loop: number[]) => loop.reduce((sum, w, i) => sum.add(at(w).cross(at(loop[(i + 1) % loop.length]))), new Vector3());
    const alignment = (loop: number[]) => Math.abs(normalOf(loop).normalize().dot(missing.clone().sub(centreOf(loop)).normalize()));
    loops.sort((a, b) => centreOf(a).distanceToSquared(pivot) / Math.max(.01, alignment(a) ** 2) - centreOf(b).distanceToSquared(pivot) / Math.max(.01, alignment(b) ** 2));
    let loop = loops[0], centre = loop && centreOf(loop), surface = false;
    if (!created.length && (!loop || centre!.distanceTo(pivot) > .18 || alignment(loop) < .4)) {
      // A legacy rigid partition can already close the retained shoulder.
      // Its nearest outward surface becomes the blood cap, offset by 0.5 mm.
      let best = Infinity;
      const direction = missing.clone().sub(pivot).normalize(), closest = new Vector3(), triangle = new Triangle();
      for (let t = 0; t < body.tris.length; t += 3) {
        const ids = body.tris.slice(t, t + 3); if (ids.some(i => removed.includes(owners[i]))) continue;
        triangle.set(...ids.map(i => new Vector3().fromArray(positions, i * 3)) as [Vector3, Vector3, Vector3]);
        if (triangle.getNormal(new Vector3()).dot(direction) < .4) continue;
        const distance = triangle.closestPointToPoint(pivot, closest).distanceToSquared(pivot);
        if (distance < best) { best = distance; loop = ids.map(i => weldOf[i]); centre = closest.clone(); surface = true; }
      }
    }
    if (!loop || !centre) throw Error(`No retained skin surface for stump_${part}`);
    const distance = centre.distanceTo(pivot); if (!created.length && distance > .35) throw Error(`Distant retained skin surface for stump_${part}: ${distance}`);
    const selected = created.length ? created : [loop];
    const capParts: number[] = [], capPositions: number[] = [], capNormals: number[] = [], capJoints: number[] = [], capWeights: number[] = [], triangles: number[] = [];
    for (const boundary of selected) {
      // Reverse the retained body's oriented boundary. No rigid fan centre: every
      // cap vertex follows the exact same weighted pose as its body counterpart.
      const rim = boundary.slice().reverse();
      if (normalOf(rim).dot(missing.clone().sub(centreOf(rim))) < 0) rim.reverse();
      const normal = normalOf(rim).normalize();
      // The seam is a nonplanar spatial polygon (a planar projection can cross
      // itself and silently lose vertices). Minimize the 3D triangle area over
      // all triangulations while preserving the complete ordered boundary.
      const points = rim.map(at), size = rim.length, costs = new Float64Array(size * size), splits = new Int32Array(size * size), ab = new Vector3(), ac = new Vector3();
      for (let span = 2; span < size; span++) for (let a = 0; a + span < size; a++) {
        const b = a + span; let best = Infinity, split = -1;
        for (let k = a + 1; k < b; k++) {
          const area = ab.subVectors(points[k], points[a]).cross(ac.subVectors(points[b], points[a])).length();
          const cost = area < 1e-10 ? Infinity : costs[a * size + k] + costs[k * size + b] + area;
          if (cost < best) { best = cost; split = k; }
        }
        costs[a * size + b] = best; splits[a * size + b] = split;
      }
      if (!Number.isFinite(costs[size - 1])) throw Error(`Degenerate stump_${part} boundary`);
      const faces: number[][] = [], pending = [[0, size - 1]];
      while (pending.length) {
        const [a, b] = pending.pop()!; if (b - a < 2) continue;
        const k = splits[a * size + b]; faces.push([a, k, b]); pending.push([a, k], [k, b]);
      }
      const edgeCounts = new Map<string, number>();
      for (const face of faces) for (let k = 0; k < 3; k++) { const a = face[k], b = face[(k + 1) % 3], key = a < b ? `${a}/${b}` : `${b}/${a}`; edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1); }
      for (let a = 0; a < rim.length; a++) { const b = (a + 1) % rim.length, key = a < b ? `${a}/${b}` : `${b}/${a}`; if (edgeCounts.get(key) !== 1) throw Error(`Open stump_${part} boundary ${key}`); }
      const base = capParts.length;
      for (const w of rim) {
        const i = representative.get(w)!; at(w).addScaledVector(normal, surface ? .0005 : 0).toArray(capPositions, capPositions.length);
        normal.toArray(capNormals, capNormals.length); capParts.push(semanticParts[i]);
        capJoints.push(...J.subarray(i * 4, i * 4 + 4)); capWeights.push(...W.subarray(i * 4, i * 4 + 4));
      }
      for (const face of faces) {
        const [a, b, c] = face.map(i => at(rim[i]));
        if (b.sub(a).cross(c.sub(a)).dot(normal) < 0) face.reverse();
        triangles.push(...face.map(i => i + base));
      }
    }
    const attribute = (values: number[], type: 'VEC3' | 'VEC4') => out.createAccessor().setType(type).setArray(new Float32Array(values));
    const cap = out.createPrimitive().setMaterial(capMaterial).setAttribute('_CROWD_PART', out.createAccessor().setType('SCALAR').setArray(new Uint16Array(capParts))).setAttribute('POSITION', attribute(capPositions, 'VEC3'))
      .setAttribute('NORMAL', attribute(capNormals, 'VEC3'))
      .setAttribute('JOINTS_0', out.createAccessor().setType('VEC4').setArray(new Uint16Array(capJoints))).setAttribute('WEIGHTS_0', attribute(capWeights, 'VEC4'))
      .setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint32Array(triangles)));
    for (const child of target.listChildren()) child.dispose();
    target.setMesh(out.createMesh(`stump_${part}`).addPrimitive(cap)).setSkin(skin);
    capFits.push({ part, rim: capParts.length, triangles: triangles.length / 3, loops: selected.length, distance, method: surface ? 'closed-part-surface' : created.length ? 'cut-boundary' : 'source-opening' });
  }
}
if (!eyes.length && !args.includes('--no-eye-discs')) {
  // Healthy-source bodies need dormant eye discs too: CivilianMaterial reveals them only as infection takes hold.
  const head = JOINTS.indexOf('head'), inverse = world(jointNode.get('head')!).invert(), rest = inverse.clone().invert();
  const local: Vector3[] = []; for (let i = 0; i < body.owner.length; i++) if (body.owner[i] === head) local.push(new Vector3().fromArray(body.pos, i * 3).applyMatrix4(inverse));
  if (local.length) {
    const lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of local) { lo.min(p); hi.max(p); }
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), hit = new Vector3();
    const paintedEyes = arg('--eyes') ? JSON.parse(readFileSync(arg('--eyes')!, 'utf8')) as { eye_centers: number[][]; radius_extent: number; game_radius?: number } : undefined;
    const authoredIrises = [new Box3(), new Box3()];
    if (!quadruped) {
      const anatomy = contract ?? rig, anatomyNodes = anatomy.getRoot().listNodes();
      const sourceBounds = getBounds(anatomy.getRoot().listScenes()[0]), targetBounds = getBounds(sceneRoot);
      const scale = (targetBounds.max[1] - targetBounds.min[1]) / (sourceBounds.max[1] - sourceBounds.min[1]);
      const placement = new Matrix4().makeScale(scale, scale, scale).setPosition(0, targetBounds.min[1] - sourceBounds.min[1] * scale, 0);
      const white = new Box3(), point = new Vector3();
      const samples: { material: string; point: Vector3 }[] = [];
      for (const node of anatomyNodes) {
        let owner: GNode | null = node; while (owner && owner.getName() !== 'head') owner = owner.getParentNode();
        if (!owner) continue;
        for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
          const material = primitive.getMaterial()?.getName() ?? '', position = primitive.getAttribute('POSITION')!, indices = primitive.getIndices(), matrix = world(node);
          const used = indices ? new Set(Array.from({ length: indices.getCount() }, (_, i) => indices.getScalar(i))) : new Set(Array.from({ length: position.getCount() }, (_, i) => i));
          for (const i of used) {
            point.fromArray(position.getElement(i, [])).applyMatrix4(matrix);
            samples.push({ material, point: point.clone() });
            // The hoodie uses woodWarm for irises as well as hair/beard. Its
            // authored eyeballs isolate those irises from the other brown paint.
            if (node.getName() === 'head__pal_picketWhite') white.expandByPoint(point);
          }
        }
      }
      const brownEyes = samples.some(s => /^(pal_)?eyeBrown$/.test(s.material));
      for (const sample of samples) {
        const p = sample.point;
        const iris = brownEyes ? /^(pal_)?eyeBrown$/.test(sample.material) : sample.material === 'pal_woodWarm' && !white.isEmpty()
          && p.y > white.min.y + (white.max.y - white.min.y) * .52 && p.y <= white.max.y
          && p.x > white.min.x + (white.max.x - white.min.x) * .45 && Math.abs(p.z) < .1;
        if (iris) { point.copy(p).applyMatrix4(placement).applyMatrix4(inverse); authoredIrises[point.z < 0 ? 0 : 1].expandByPoint(point); }
      }
    }
    const anatomicalEyes = authoredIrises.every(box => !box.isEmpty()) ? authoredIrises.map(box => box.getCenter(new Vector3())) : undefined;
    const centres = paintedEyes ? paintedEyes.eye_centers.map(point => new Vector3().fromArray(point).applyMatrix4(bodyTransform).applyMatrix4(inverse)) : anatomicalEyes ?? [-1, 1].map(side => new Vector3(0, lo.y + (hi.y - lo.y) * .61, (lo.z + hi.z) / 2 + side * (hi.z - lo.z) * .19));
    for (const centre of centres) {
      const y = centre.y, z = centre.z;
      const ray = new Ray(new Vector3(hi.x + 1, y, z), new Vector3(-1, 0, 0)); let x = -Infinity;
      for (let t = 0; t < body.tris.length; t += 3) {
        const ids = body.tris.slice(t, t + 3); if (!paintedEyes && !ids.some(i => body.owner[i] === head)) continue;
        [a, b, c].forEach((p, k) => p.fromArray(body.pos, ids[k] * 3).applyMatrix4(inverse));
        if (ray.intersectTriangle(a, b, c, false, hit)) x = Math.max(x, hit.x);
      }
      if (!Number.isFinite(x)) continue;
      const pos: number[] = [], radius = paintedEyes ? paintedEyes.game_radius ?? Math.min(.02, paintedEyes.radius_extent * Number(arg('--body-scale', '1')) * .65) : anatomicalEyes ? Math.min(.024, Math.max(.018, authoredIrises[0].getSize(new Vector3()).y * .5)) : Math.min(.024, (hi.y - lo.y) * .05);
      for (const [dy, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) new Vector3(x + .006, y + dy * radius, z + dz * radius).applyMatrix4(rest).toArray(pos, pos.length);
      eyes.push({ pos, uv: [0, 0, 0, 1, 1, 1, 1, 0], owner: head, tris: [0, 1, 2, 0, 2, 3] });
    }
    if (paintedEyes && eyes.length !== paintedEyes.eye_centers.length) throw Error('A painted eye landmark did not project onto the head surface');
    if (paintedEyes) fit.eyeLandmarks = arg('--eyes');
    else if (anatomicalEyes) fit.eyeLandmarks = { source: 'authored PROD irises projected onto the retained face', centres: anatomicalEyes.map(p => p.toArray()) };
  }
}
if (eyes.length) {
  // Infected eye discs: rigid on the head, emissive by material name (bakeInfected's emi_ rule).
  const eyeMaterial = capMaterial;
  const pos: number[] = [], tris: number[] = [], eyeUV: number[] = [];
  for (const e of eyes) { const base = pos.length / 3; pos.push(...e.pos); eyeUV.push(...e.uv); tris.push(...e.tris.map(t => t + base)); }
  const count = pos.length / 3, eyeNormals = new Float32Array(count * 3), j = new Uint16Array(count * 4), wt = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { j[i * 4] = eyes[0].owner; wt[i * 4] = 1; eyeNormals[i * 3] = 1; }
  const ep = out.createPrimitive().setMaterial(eyeMaterial)
    .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(new Float32Array(pos)))
    .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(eyeNormals))
    .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(new Float32Array(eyeUV)))
    .setAttribute('JOINTS_0', out.createAccessor().setType('VEC4').setArray(j))
    .setAttribute('WEIGHTS_0', out.createAccessor().setType('VEC4').setArray(wt))
    .setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint16Array(tris)));
  scene.addChild(out.createNode('skin_eyes').setExtras({ crowdEye: true }).setMesh(out.createMesh('skin_eyes').addPrimitive(ep)).setSkin(skin));
}
for (const source of rig.getRoot().listAnimations()) {
  const animation = out.createAnimation(source.getName());
  for (const channel of source.listChannels()) {
    const target = copy.get(channel.getTargetNode()!); if (!target) continue;
    const sourceSampler = channel.getSampler()!, input = sourceSampler.getInput()!, output = sourceSampler.getOutput()!;
    const sampler = out.createAnimationSampler().setInterpolation(sourceSampler.getInterpolation())
      .setInput(out.createAccessor().setType(input.getType()).setArray(input.getArray()!.slice()))
      .setOutput(out.createAccessor().setType(output.getType()).setArray(output.getArray()!.slice()));
    animation.addSampler(sampler).addChannel(out.createAnimationChannel().setTargetNode(target).setTargetPath(channel.getTargetPath()!).setSampler(sampler));
  }
}
let spectacleTop: number | undefined;
if (args.includes('--spectacles') && texture && texture.mime !== 'image/ktx2') {
  const directory = mkdtempSync(join(tmpdir(), 'crowd-spectacles-')), input = join(directory, 'image.' + texture.mime.split('/')[1]), output = join(directory, 'image.png');
  writeFileSync(input, texture.image); execFileSync('sips', ['-s', 'format', 'png', input, '--out', output], { stdio: 'ignore' });
  const png = PNG.sync.read(readFileSync(output)), inverse = world(jointNode.get('head')!).invert(), head = JOINTS.indexOf('head');
  const vertices = body.owner.flatMap((owner, i) => owner === head ? [{ i, point: new Vector3().fromArray(body.pos, i * 3).applyMatrix4(inverse) }] : []);
  const lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const { point } of vertices) { lo.min(point); hi.max(point); }
  let candidates = vertices.filter(({ point }) => {
    const y = (point.y - lo.y) / (hi.y - lo.y), z = Math.abs(point.z - (lo.z + hi.z) / 2) / (hi.z - lo.z);
    return y >= .45 && y <= .78 && z >= .25 && point.x >= (lo.x + hi.x) / 2;
  });
  const colorAt = (i: number) => {
    const x = Math.max(0, Math.min(png.width - 1, Math.floor(body.uv[i * 2] * png.width))), row = Math.max(0, Math.min(png.height - 1, Math.floor(body.uv[i * 2 + 1] * png.height)));
    return [...png.data.subarray((row * png.width + x) * 4, (row * png.width + x) * 4 + 3)];
  };
  let samples = candidates.filter(({ i }) => {
    const rgb = colorAt(i); return Math.max(...rgb) < 70 && Math.max(...rgb) - Math.min(...rgb) < 22;
  });
  // Brown frames need a warm dark-paint fallback; neutral temple shadows are excluded.
  if (samples.length < 4) samples = candidates.filter(({ i }) => { const rgb = colorAt(i); return Math.max(...rgb) < 120 && Math.max(...rgb) - Math.min(...rgb) < 55 && rgb[0] > rgb[1] * 1.35; });
  if (samples.length < 4) {
    // The cane-free redraw has a low cap and frames below the old face band.
    candidates = vertices.filter(({ point }) => {
      const y = (point.y - lo.y) / (hi.y - lo.y), z = Math.abs(point.z - (lo.z + hi.z) / 2) / (hi.z - lo.z);
      return y >= .2 && y <= .78 && z >= .2 && point.x >= (lo.x + hi.x) / 2;
    });
    samples = candidates.filter(({ i }) => { const rgb = colorAt(i); return Math.max(...rgb) < 135 && Math.max(...rgb) - Math.min(...rgb) < 60; });
  }
  if (samples.length < 4 && arg('--spectacle-top') === undefined) throw Error('Spectacled source has no detectable frame paint; refusing an unmeasured hat fit');
  {
    spectacleTop = samples.length >= 4 ? Math.max(...samples.map(({ point }) => point.y)) : Number(arg('--spectacle-top'));
    const regions = prim.getAttribute('_CROWD_REGION')!;
    for (const { i } of samples) regions.setScalar(i, 2);
  }
  rmSync(directory, { recursive: true, force: true });
}
const soleBounds = (name: string) => {
  const part = JOINTS.indexOf(name); if (part < 0) return undefined;
  const inverse = world(jointNode.get(name)!).invert(), lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity), point = new Vector3();
  for (let i = 0; i < body.owner.length; i++) if (body.owner[i] === part) { point.fromArray(body.pos, i * 3).applyMatrix4(inverse); lo.min(point); hi.max(point); }
  return Number.isFinite(lo.x) ? [...lo.toArray(), ...hi.toArray()] : undefined;
};
const soleBoxes = ['footL', 'footR'].map(soleBounds);
const animalSoles = Object.fromEntries(['FL', 'FR', 'BL', 'BR'].flatMap(side => {
  const name = JOINTS.includes(`paw${side}`) ? `paw${side}` : `leg${side}`, box = soleBounds(name);
  return box ? [[name, [box[0], box[3]].flatMap(x => [box[2], box[5]].map(z => [x, box[1], z]))]] : [];
}));
for (const node of out.getRoot().listNodes()) if (node.getName() === 'root') node.setExtras({ ...node.getExtras(), skinnedCrowd: true, crowdAtlas: true, ...(spectacleTop !== undefined ? { spectacleTop } : {}), ...(soleBoxes.every(Boolean) ? { meshSoles: true, soleBounds: soleBoxes } : {}), ...(quadruped ? { animalSoles } : {}) });
if (bodyPath && (openEdges > 0 || components !== 1)) {
  const seen = new Set<number>(), groups = [];
  for (let start = 0; start < welded; start++) if (!seen.has(start)) {
    const stack = [start], vertices: number[] = []; seen.add(start);
    while (stack.length) { const w = stack.pop()!; vertices.push(w); for (const u of neighbours[w]) if (!seen.has(u)) { seen.add(u); stack.push(u); } }
    groups.push({ vertices: vertices.length, owners: [...new Set(vertices.map(w => JOINTS[owner[w]]))] });
  }
  console.error(JSON.stringify({ topology: groups }));
  throw new Error(`Continuous source must remain closed and connected: ${components} components, ${openEdges} open edges`);
}
// Old retained props may contain collapsed export triangles; discard only zero-area faces.
for (const node of out.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
  const position = primitive.getAttribute('POSITION')!, index = primitive.getIndices();
  if (!index) continue;
  const kept: number[] = [];
  for (let i = 0; i < index.getCount(); i += 3) {
    const ids = [0, 1, 2].map(k => index.getScalar(i + k)), [a, b, c] = ids.map(i => new Vector3().fromArray(position.getElement(i, [])));
    if (b.sub(a).cross(c.sub(a)).length() >= 1e-12) kept.push(...ids);
  }
  if (kept.length !== index.getCount()) primitive.setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint32Array(kept)));
}
await out.transform(generateNormals({ overwrite: false }), unpartition());
const bytes = await io.writeBinary(out);
writeFileSync(outPath, bytes);
const report = { rig: rigPath, out: outPath, bytes: bytes.length, ...fit, vertices: n, weldedVertices: welded, triangles: body.tris.length / 3, bodyTriangleBudget: Number.isFinite(bodyBudget) ? bodyBudget : null, components, openEdges, unrelatedSeams, maxInfluences, zeroNormals, jointNames: JOINTS, rigKind: quadruped ? 'quadruped' : 'humanoid', capFits, removedClosureTriangles, removedDegenerateTriangles, spectacleTop, joints: JOINTS.length, eyes: eyes.length, seams };
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
