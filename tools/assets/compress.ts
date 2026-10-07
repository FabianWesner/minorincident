import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

interface CompressedView { buffer: number; byteOffset: number; byteLength: number; byteStride: number; count: number; mode: 'ATTRIBUTES' | 'TRIANGLES' | 'INDICES'; filter?: 'NONE' | 'OCTAHEDRAL' | 'QUATERNION' | 'EXPONENTIAL' }
interface View { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number; target?: number; extensions?: { EXT_meshopt_compression?: CompressedView } }
interface Accessor { bufferView?: number; byteOffset?: number; sparse?: { indices: { bufferView: number; byteOffset?: number }; values: { bufferView: number; byteOffset?: number } } }
interface GlbJson { buffers: { byteLength: number }[]; bufferViews: View[]; accessors: Accessor[]; images?: { bufferView?: number }[] }

/** Consolidate compatible compressed views while keeping accessor ranges and bounds.
 * The decoded bytes stay identical; no geometry, normals, colors or animation change.
 * NodeIO otherwise emits one compression header per tiny material primitive.
 */
export async function consolidateMeshopt(input: Uint8Array, compact = false): Promise<Uint8Array> {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const glb = Buffer.from(input), jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString()) as GlbJson;
  const binStart = 28 + jsonLength, binary = glb.subarray(binStart);
  if (!json.bufferViews.some(view => view.extensions?.EXT_meshopt_compression)) return input;
  const groups = new Map<string, { view: View; parts: Uint8Array[]; bytes: number; indices: number[] }>();
  for (const [index, view] of json.bufferViews.entries()) {
    const compressed = view.extensions?.EXT_meshopt_compression;
    const key = compressed ? JSON.stringify([view.target, view.byteStride, compressed.byteStride, compressed.mode, compressed.filter ?? 'NONE']) : `plain:${index}`;
    let group = groups.get(key);
    if (!group) { group = { view, parts: [], bytes: 0, indices: [] }; groups.set(key, group); }
    const part = compressed ? new Uint8Array(compressed.count * compressed.byteStride) : binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    if (compressed) {
      // Leave the filter encoded; concatenated filter records remain independent.
      MeshoptDecoder.decodeGltfBuffer(part, compressed.count, compressed.byteStride, binary.subarray(compressed.byteOffset, compressed.byteOffset + compressed.byteLength), compressed.mode);
    }
    group.parts.push(part); group.indices.push(index); group.bytes += part.length;
  }
  const mapping = new Map<number, { view: number; offset: number }>(), views: View[] = [], chunks: Uint8Array[] = [];
  let binaryOffset = 0, fallbackOffset = 0;
  const append = (bytes: Uint8Array): number => {
    const start = binaryOffset; chunks.push(bytes); binaryOffset += bytes.length;
    const padding = (4 - binaryOffset % 4) % 4; if (padding) { chunks.push(new Uint8Array(padding)); binaryOffset += padding; }
    return start;
  };
  for (const group of groups.values()) {
    let offset = 0;
    for (const [i, index] of group.indices.entries()) { mapping.set(index, { view: views.length, offset }); offset += group.parts[i].length; }
    const compressed = group.view.extensions?.EXT_meshopt_compression;
    if (!compressed) { views.push({ ...group.view, byteOffset: append(group.parts[0]) }); continue; }
    const joined = new Uint8Array(group.bytes); offset = 0;
    for (const part of group.parts) { joined.set(part, offset); offset += part.length; }
    const count = joined.length / compressed.byteStride;
    let encoded = MeshoptEncoder.encodeGltfBuffer(joined, count, compressed.byteStride, compressed.mode);
    if (compact && compressed.mode === 'ATTRIBUTES') {
      for (const version of [0, 1]) {
        const candidate = MeshoptEncoder.encodeVertexBufferLevel(joined, count, compressed.byteStride, 3, version);
        if (candidate.length < encoded.length) encoded = candidate;
      }
    }
    const extension = { ...compressed, byteOffset: append(encoded), byteLength: encoded.length, count };
    views.push({ ...group.view, byteOffset: fallbackOffset, byteLength: joined.length, extensions: { EXT_meshopt_compression: extension } });
    fallbackOffset += joined.length; fallbackOffset += (4 - fallbackOffset % 4) % 4;
  }
  const remap = (reference: { bufferView?: number; byteOffset?: number }): void => {
    if (reference.bufferView === undefined) return;
    const mapped = mapping.get(reference.bufferView)!;
    reference.bufferView = mapped.view; reference.byteOffset = (reference.byteOffset ?? 0) + mapped.offset;
  };
  for (const accessor of json.accessors) { remap(accessor); if (accessor.sparse) { remap(accessor.sparse.indices); remap(accessor.sparse.values); } }
  for (const image of json.images ?? []) if (image.bufferView !== undefined) image.bufferView = mapping.get(image.bufferView)!.view;
  json.bufferViews = views; json.buffers[0].byteLength = binaryOffset;
  const fallback = views.find(view => view.extensions?.EXT_meshopt_compression)?.buffer;
  if (fallback !== undefined) json.buffers[fallback].byteLength = fallbackOffset;
  const jsonBytes = Buffer.from(JSON.stringify(json)), jsonPadding = (4 - jsonBytes.length % 4) % 4;
  const output = Buffer.alloc(28 + jsonBytes.length + jsonPadding + binaryOffset);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonBytes.length + jsonPadding, 12); output.writeUInt32LE(0x4e4f534a, 16); jsonBytes.copy(output, 20);
  output.fill(0x20, 20 + jsonBytes.length, 20 + jsonBytes.length + jsonPadding);
  const header = 20 + jsonBytes.length + jsonPadding; output.writeUInt32LE(binaryOffset, header); output.writeUInt32LE(0x004e4942, header + 4);
  offsetCopy(chunks, output, header + 8);
  return output;
}
function offsetCopy(chunks: Uint8Array[], output: Buffer, start: number): void { for (const chunk of chunks) { output.set(chunk, start); start += chunk.length; } }
