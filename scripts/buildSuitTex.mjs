import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

// Convert a source-rebaked, xatlas-unwrapped static suit LOD into the game's
// rigid infected hierarchy. Usage: node scripts/buildSuitTex.mjs in.glb out.glb
const require = createRequire(resolve(process.cwd(), 'package.json'));
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { MeshoptDecoder } = require('meshoptimizer');
await MeshoptDecoder.ready;
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Expected input and output GLB paths');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(input);
const root = doc.getRoot(), scene = root.listScenes()[0], buffer = root.listBuffers()[0];
const sourceNodes = [...root.listNodes()], sourceRoot = scene.listChildren()[0];
const primitive = root.listMeshes().flatMap(mesh => mesh.listPrimitives())[0];
if (!primitive?.getAttribute('POSITION') || !primitive?.getAttribute('TEXCOORD_0') || !primitive.getMaterial()?.getBaseColorTexture()) throw new Error('Expected a single fresh-UV textured source primitive');
const sourceAttrs = Object.fromEntries(primitive.listSemantics().map(name => [name, primitive.getAttribute(name)]));
const srcIndex = primitive.getIndices();
const indices = srcIndex ? Array.from(srcIndex.getArray()) : Array.from({ length: sourceAttrs.POSITION.getCount() }, (_, i) => i);
const sourcePositions = Array.from({ length: sourceAttrs.POSITION.getCount() }, (_, i) => sourceAttrs.POSITION.getElement(i, []));
const rawMinZ = Math.min(...sourcePositions.map(v => v[2])), rawMaxZ = Math.max(...sourcePositions.map(v => v[2]));
const scale = 1.78 / (rawMaxZ - rawMinZ);
const convert = p => [-p[1] * scale, (p[2] - rawMinZ) * scale, -p[0] * scale];
// Joint landmarks fitted to the source anatomy; the existing named clips
// preserve these bind translations and drive the same rigid hierarchy.
const world = {
  root: [0, 0, 0], hip: [-.18, .74, .05], torso: [0, .14, 0], head: [.11, .36, -.07],
  armL: [-.07, .25, -.26], armR: [.02, .25, .24], foreArmL: [.03, -.20, -.20], foreArmR: [.16, -.18, .14],
  handL: [.07, -.15, -.13], handR: [.18, -.17, .12], legL: [-.04, 0, -.19], legR: [.05, 0, .16],
  shinL: [-.05, -.32, -.07], shinR: [.02, -.32, .08], footL: [.02, -.31, -.08], footR: [.08, -.31, .10],
};
const parent = {
  root: null, hip: 'root', torso: 'hip', head: 'torso', armL: 'torso', armR: 'torso', foreArmL: 'armL', foreArmR: 'armR',
  handL: 'foreArmL', handR: 'foreArmR', legL: 'hip', legR: 'hip', shinL: 'legL', shinR: 'legR', footL: 'shinL', footR: 'shinR',
};
const absolute = { root: world.root };
for (const name of Object.keys(world).slice(1)) {
  const p = parent[name]; absolute[name] = world[name].map((v, i) => v + absolute[p][i]);
}
const distanceToSegment = (point, a, b) => {
  const ab = b.map((v, i) => v - a[i]), ap = point.map((v, i) => v - a[i]);
  const t = Math.max(0, Math.min(1, ap.reduce((v, n, i) => v + n * ab[i], 0) / ab.reduce((v, n) => v + n * n, 0)));
  return Math.hypot(...point.map((v, i) => v - a[i] - t * ab[i]));
};
const segments = [
  ['torso', absolute.hip, absolute.head, .19],
  ...['L', 'R'].flatMap(side => [
    [`arm${side}`, absolute[`arm${side}`], absolute[`foreArm${side}`], .11],
    [`foreArm${side}`, absolute[`foreArm${side}`], absolute[`hand${side}`], .09],
    [`hand${side}`, absolute[`hand${side}`], absolute[`hand${side}`].map((v,i) => v + (i === 1 ? -.16 : i === 2 ? (side === 'L' ? -.06 : .06) : .04)), .10],
    [`leg${side}`, absolute[`leg${side}`], absolute[`shin${side}`], .13],
    [`shin${side}`, absolute[`shin${side}`], absolute[`foot${side}`], .11],
    [`foot${side}`, absolute[`foot${side}`], absolute[`foot${side}`].map((v,i) => v + (i === 0 ? .16 : i === 1 ? -.07 : 0)), .11],
  ]),
];
const assign = point => {
  if (point[1] > 1.24) return 'head';
  if (point[1] < .18) return point[2] < .05 ? 'footL' : 'footR';
  return segments.reduce((best, segment) => {
    const score = distanceToSegment(point, segment[1], segment[2]) / segment[3];
    return score < best.score ? { name: segment[0], score } : best;
  }, { name: 'torso', score: Infinity }).name;
};
const faces = Object.fromEntries(Object.keys(world).map(name => [name, []]));
for (let i = 0; i < indices.length; i += 3) {
  const tri = indices.slice(i, i + 3), center = [0, 0, 0];
  for (const vi of tri) { const v = convert(sourcePositions[vi]); for (let a = 0; a < 3; a++) center[a] += v[a] / 3; }
  faces[assign(center)].push(tri);
}

// Replace the source scene with named, pivoted game joints.
for (const child of [...scene.listChildren()]) scene.removeChild(child);
for (const node of [...root.listNodes()]) if (node.getMesh()) node.setMesh(null);
const joints = { root: sourceRoot.setName('root').setTranslation([0, 0, 0]).setExtras({ meshSoles: true, crowdAtlas: true }) };
scene.addChild(joints.root);
for (const name of Object.keys(world)) {
  if (name === 'root') continue;
  const node = doc.createNode(name).setName(name);
  node.setTranslation(world[name]);
  joints[name] = node;
  if (parent[name]) joints[parent[name]].addChild(node); else scene.addChild(node);
}
const front = doc.createNode('front').setTranslation([.45, 0, 0]); joints.root.addChild(front);
const material = primitive.getMaterial();
material.setName('pal_asphalt').setMetallicFactor(0).setRoughnessFactor(.92);
const addMesh = (name, owner, tris, mat, textured = true) => {
  if (!tris.length) return;
  const semantics = textured ? ['POSITION', 'NORMAL', 'TEXCOORD_0'] : ['POSITION'];
  const attrs = {};
  for (const semantic of semantics) {
    const input = sourceAttrs[semantic];
    const itemSize = input.getType() === 'VEC2' ? 2 : 3;
    const values = [];
    for (const tri of tris) for (const vi of tri) {
      let v = input.getElement(vi, []);
      if (semantic === 'POSITION') { const p = convert(v); v = p.map((n, i) => n - absolute[owner][i]); }
      else if (semantic === 'NORMAL') v = [-v[1], v[2], -v[0]];
      values.push(...v);
    }
    attrs[semantic] = doc.createAccessor(`${name}_${semantic}`).setType(itemSize === 2 ? 'VEC2' : 'VEC3').setArray(new Float32Array(values)).setBuffer(buffer);
  }
  const mesh = doc.createMesh(name), prim = doc.createPrimitive().setMaterial(mat).setMode(4);
  for (const [semantic, accessor] of Object.entries(attrs)) prim.setAttribute(semantic, accessor);
  mesh.addPrimitive(prim);
  const meshNode = doc.createNode(name).setMesh(mesh);
  joints[owner].addChild(meshNode);
};
for (const [owner, tris] of Object.entries(faces)) addMesh(`suit_${owner}`, owner, tris, material);

// Tiny, closed two-triangle hidden caps keep every distance tier within budget.
const capMaterial = doc.createMaterial('pal_blood').setBaseColorFactor([0xB3 / 255, 0x12 / 255, 0x1F / 255, 1]).setMetallicFactor(0).setRoughnessFactor(.95);
const caps = [
  ['head', 'torso', world.head, 'y'],
  ['armL', 'torso', world.armL, 'z'], ['armR', 'torso', world.armR, 'z'],
  ['foreArmL', 'armL', world.foreArmL, 'z'], ['foreArmR', 'armR', world.foreArmR, 'z'],
  ['legL', 'hip', world.legL, 'y'], ['legR', 'hip', world.legR, 'y'],
];
for (const [name, owner, at, axis] of caps) {
  const node = doc.createNode(`stump_${name}`).setName(`stump_${name}`).setTranslation(at).setExtras({ hidden: true, stumpFor: name });
  joints[owner].addChild(node);
  const side = .035, points = axis === 'y' ? [[-side,0,-side],[side,0,-side],[side,0,side],[-side,0,side]] : [[0,-side,-side],[0,side,-side],[0,side,side],[0,-side,side]];
  const pos = doc.createAccessor(`stump_${name}_position`).setType('VEC3').setArray(new Float32Array([...points[0], ...points[1], ...points[2], ...points[0], ...points[2], ...points[3]])).setBuffer(buffer);
  const capMesh = doc.createMesh(`stump_${name}_mesh`), capPrim = doc.createPrimitive().setMaterial(capMaterial).setMode(4).setAttribute('POSITION', pos);
  capMesh.addPrimitive(capPrim); node.setMesh(capMesh);
}
const sockets = doc.createNode('backpackSocket').setTranslation([-.18, .29, 0]); joints.torso.addChild(sockets);
sourceNodes.filter(n => n !== sourceRoot).forEach(n => n.dispose());
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, await io.writeBinary(doc));
console.log(JSON.stringify({ output, triangles: Object.values(faces).reduce((n, f) => n + f.length, 0) + 14, parts: Object.fromEntries(Object.entries(faces).map(([k,v]) => [k,v.length])) }));
