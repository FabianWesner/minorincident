import { BufferAttribute, BufferGeometry, Color, Group, Object3D, InterleavedBuffer, InterleavedBufferAttribute } from 'three';
import type { PreparedCivilian } from '../render/npc/prepareCivilianGeometry';

type ArraySpec = { name: string; size: number; length: number; uint?: boolean; normalized?: boolean; stride?: number; offset?: number; shared?: string };
type RigNode = { name: string; position: number[]; rotation: number[]; scale: number[]; matrix: number[]; auto: boolean; worldAuto: boolean; children: RigNode[] };
type Header = { gripReach?: number; rig?: RigNode; version: number; arrays: ArraySpec[]; clip: { parts: string[]; frames: number; duration: number }; shirt?: number[]; doubleSided: boolean; strideScale: number; userData: Record<string, unknown> };
export { decompressCivilianBake } from './bakeCompression';
/** Lossless build output: a small JSON header followed by aligned Float32/Uint32 arrays. */
export function encodeCivilianBake(baked: PreparedCivilian): Uint8Array {
  const arrays: { spec: ArraySpec; data?: Float32Array | Uint32Array }[] = [];
  const shared = new Map<InterleavedBuffer, string>();
  for (const [name, a] of Object.entries(baked.geometry.attributes)) {
    if ('isInterleavedBufferAttribute' in a) {
      const previous = shared.get(a.data); shared.set(a.data, previous ?? name);
      if (!(a.data.array instanceof Float32Array)) throw Error(`Unsupported baked attribute ${name}`);
      arrays.push({ spec: { name, size: a.itemSize, length: previous ? 0 : a.data.array.length, normalized: a.normalized, stride: a.data.stride, offset: a.offset, shared: previous }, data: previous ? undefined : a.data.array });
    } else {
      if (!(a instanceof BufferAttribute) || !(a.array instanceof Float32Array)) throw new Error(`Unsupported baked attribute ${name}`);
      arrays.push({ spec: { name, size: a.itemSize, length: a.array.length, normalized: a.normalized }, data: a.array });
    }
  }
  if (baked.gripTriangles) arrays.push({ spec: { name: 'grip', size: 3, length: baked.gripTriangles.length }, data: baked.gripTriangles });
  if (baked.geometry.index) arrays.push({ spec: { name: 'index', size: 1, length: baked.geometry.index.array.length, uint: true }, data: new Uint32Array(baked.geometry.index.array) });
  arrays.push({ spec: { name: 'poses', size: 16, length: baked.clip.matrices.length }, data: new Float32Array(baked.clip.matrices) });
  const header: Header = { gripReach: baked.gripReach, rig: baked.rig ? encodeRig(baked.rig, baked.clip.parts) : undefined, version: 1, arrays: arrays.map(a => a.spec), clip: { parts: baked.clip.parts, frames: baked.clip.frames, duration: baked.clip.duration }, shirt: baked.shirtColor?.toArray(), doubleSided: baked.doubleSided, strideScale: baked.strideScale, userData: baked.geometry.userData };
  const json = new TextEncoder().encode(JSON.stringify(header)), start = 4 + Math.ceil(json.length / 4) * 4;
  const bytes = new Uint8Array(start + arrays.reduce((n, a) => n + (a.data?.byteLength ?? 0), 0));
  new DataView(bytes.buffer).setUint32(0, json.length, true); bytes.set(json, 4);
  let offset = start;
  for (const { data } of arrays) { if (!data) continue; bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), offset); offset += data.byteLength; }
  return bytes;
}
export function decodeCivilianBake(bytes: ArrayBuffer): PreparedCivilian {
  const length = new DataView(bytes).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 4, length))) as Header;
  if (header.version !== 1) throw new Error('Unknown civilian bake version');
  const geometry = new BufferGeometry(); geometry.userData = header.userData;
  let offset = 4 + Math.ceil(length / 4) * 4, matrices: Float32Array | undefined, grip: Float32Array | undefined;
  const buffers = new Map<string, InterleavedBuffer>();
  for (const spec of header.arrays) {
    if (spec.shared) {
      const buffer = buffers.get(spec.shared); if (!buffer) throw Error('Missing civilian vertex buffer');
      geometry.setAttribute(spec.name, new InterleavedBufferAttribute(buffer, spec.size, spec.offset!, spec.normalized)); continue;
    }
    const data = spec.uint ? new Uint32Array(bytes, offset, spec.length) : new Float32Array(bytes, offset, spec.length);
    offset += data.byteLength;
    if (spec.name === 'grip') grip = data as Float32Array;
    else if (spec.stride) { const buffer = new InterleavedBuffer(data as Float32Array, spec.stride); buffers.set(spec.name, buffer); geometry.setAttribute(spec.name, new InterleavedBufferAttribute(buffer, spec.size, spec.offset!, spec.normalized)); }
    else if (spec.name === 'poses') matrices = data as Float32Array;
    else if (spec.name === 'index') geometry.setIndex(new BufferAttribute(data, 1));
    else geometry.setAttribute(spec.name, new BufferAttribute(data, spec.size, spec.normalized));
  }
  if (!matrices || offset !== bytes.byteLength || matrices.length !== header.clip.parts.length * header.clip.frames * 16) throw new Error('Incomplete civilian bake');
  return { gripTriangles: grip, gripReach: header.gripReach, rig: header.rig ? decodeRig(header.rig) : undefined, geometry, clip: { ...header.clip, matrices }, shirtColor: header.shirt ? new Color().fromArray(header.shirt) : undefined, doubleSided: header.doubleSided, strideScale: header.strideScale };
}
function encodeRig(root: Group, parts: string[]): RigNode {
  const required = new Set<Object3D>([root]);
  for (const name of parts) for (let node = root.getObjectByName(name); node; node = node.parent ?? undefined) { required.add(node); if (node === root) break; }
  const visit = (node: Object3D): RigNode => ({ name: node.name, position: node.position.toArray(), rotation: node.quaternion.toArray(), scale: node.scale.toArray(), matrix: node.matrix.toArray(), auto: node.matrixAutoUpdate, worldAuto: node.matrixWorldAutoUpdate, children: node.children.filter(c => required.has(c)).map(visit) });
  return visit(root);
}
function decodeRig(tree: RigNode): Group {
  const visit = (node: RigNode): Group => {
    const group = new Group(); group.name = node.name; group.position.fromArray(node.position); group.quaternion.fromArray(node.rotation); group.scale.fromArray(node.scale); group.matrix.fromArray(node.matrix); group.matrixAutoUpdate = node.auto; group.matrixWorldAutoUpdate = node.worldAuto;
    if (node.children.length) group.add(...node.children.map(visit)); return group;
  };
  const root = visit(tree); root.updateMatrixWorld(true); return root;
}
