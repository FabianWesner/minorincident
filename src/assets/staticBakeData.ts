import { Box3, BufferAttribute, BufferGeometry, Group, InterleavedBuffer, InterleavedBufferAttribute, Mesh, Sphere } from 'three/webgpu';
import type { Materials } from '../render/Materials';
import { staticBatchMaterial } from './staticBatch';

type Attribute = { name: string; size: number; normalized: boolean; type: 'float' | 'short' | 'int'; length: number; stride?: number; offset?: number; shared?: string };
type Part = { name: string; matrix: number[]; position: number[]; rotation: number[]; scale: number[]; userData: Record<string, unknown>; shadow: boolean; attributes: Attribute[]; box: number[]; sphere: number[] };
type Header = { version: number; parts: Part[] };
/** Immutable static vertex data; materials remain the renderer's live graphs. */
export function encodeStaticBake(root: Group): Uint8Array {
  const arrays: ArrayBufferView[] = [], parts: Part[] = [];
  for (const mesh of root.children) {
    if (!(mesh instanceof Mesh) || mesh.children.length) throw Error('Static bake requires leaf meshes');
    mesh.updateMatrix(); const geometry = mesh.geometry;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const attributes: Attribute[] = [], buffers = new Map<InterleavedBuffer, string>();
    for (const [name, input] of [...Object.entries(geometry.attributes), ...(geometry.index ? [['index', geometry.index] as const] : [])]) {
      const interleaved = 'isInterleavedBufferAttribute' in input;
      const shared = interleaved ? buffers.get(input.data) : undefined;
      if (interleaved) buffers.set(input.data, shared ?? name);
      const array = input.array;
      if (!(array instanceof Float32Array || array instanceof Uint16Array || array instanceof Uint32Array)) throw Error(`Unsupported static attribute ${name}`);
      attributes.push({ name, size: input.itemSize, normalized: input.normalized, type: array instanceof Float32Array ? 'float' : array instanceof Uint16Array ? 'short' : 'int', length: shared ? 0 : array.length, ...(interleaved ? { stride: input.data.stride, offset: input.offset, shared } : {}) });
      if (!shared) arrays.push(array);
    }
    parts.push({ name: mesh.name, matrix: mesh.matrix.toArray(), position: mesh.position.toArray(), rotation: mesh.quaternion.toArray(), scale: mesh.scale.toArray(), userData: mesh.userData, shadow: mesh.castShadow, attributes, box: [...geometry.boundingBox!.min.toArray(), ...geometry.boundingBox!.max.toArray()], sphere: [...geometry.boundingSphere!.center.toArray(), geometry.boundingSphere!.radius] });
  }
  const json = new TextEncoder().encode(JSON.stringify({ version: 1, parts } satisfies Header)), start = 4 + Math.ceil(json.length / 4) * 4;
  const bytes = new Uint8Array(start + arrays.reduce((sum, array) => sum + Math.ceil(array.byteLength / 4) * 4, 0));
  new DataView(bytes.buffer).setUint32(0, json.length, true); bytes.set(json, 4);
  let offset = start;
  for (const array of arrays) { bytes.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), offset); offset += Math.ceil(array.byteLength / 4) * 4; }
  return bytes;
}
export function decodeStaticBake(bytes: ArrayBuffer, materials: Materials, anchors: boolean): Group {
  const length = new DataView(bytes).getUint32(0, true), header = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 4, length))) as Header;
  if (header.version !== 1) throw Error('Unknown static bake version');
  const root = new Group(); let offset = 4 + Math.ceil(length / 4) * 4;
  for (const part of header.parts) {
    const geometry = new BufferGeometry(), buffers = new Map<string, InterleavedBuffer>();
    for (const attribute of part.attributes) {
      if (attribute.shared) {
        const buffer = buffers.get(attribute.shared); if (!buffer) throw Error('Missing static interleave');
        geometry.setAttribute(attribute.name, new InterleavedBufferAttribute(buffer, attribute.size, attribute.offset!, attribute.normalized)); continue;
      }
      const array = attribute.type === 'float' ? new Float32Array(bytes, offset, attribute.length) : attribute.type === 'short' ? new Uint16Array(bytes, offset, attribute.length) : new Uint32Array(bytes, offset, attribute.length);
      offset += Math.ceil(array.byteLength / 4) * 4;
      if (attribute.name === 'index') geometry.setIndex(new BufferAttribute(array, 1));
      else if (attribute.stride) { const buffer = new InterleavedBuffer(array, attribute.stride); buffers.set(attribute.name, buffer); geometry.setAttribute(attribute.name, new InterleavedBufferAttribute(buffer, attribute.size, attribute.offset!, attribute.normalized)); }
      else geometry.setAttribute(attribute.name, new BufferAttribute(array, attribute.size, attribute.normalized));
    }
    geometry.boundingBox = new Box3(); geometry.boundingBox.min.fromArray(part.box); geometry.boundingBox.max.fromArray(part.box, 3);
    geometry.boundingSphere = new Sphere(); geometry.boundingSphere.center.fromArray(part.sphere); geometry.boundingSphere.radius = part.sphere[3];
    const emissive = ['window-light', 'roof-light'].includes(part.name);
    const mesh = new Mesh(geometry, staticBatchMaterial(materials, emissive, true, anchors, geometry.hasAttribute('_surface'), geometry.hasAttribute('_window')));
    mesh.name = part.name; mesh.userData = part.userData; mesh.castShadow = part.shadow; mesh.receiveShadow = true;
    mesh.matrix.fromArray(part.matrix); mesh.position.fromArray(part.position); mesh.quaternion.fromArray(part.rotation); mesh.scale.fromArray(part.scale); root.add(mesh);
  }
  if (offset !== bytes.byteLength) throw Error('Incomplete static bake');
  return root;
}
