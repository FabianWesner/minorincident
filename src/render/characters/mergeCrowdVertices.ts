import { BufferAttribute, type BufferGeometry } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** Same weld and first-use vertex order as Three, hashing each source vertex once.
 * Indexed GLBs reuse vertices across triangles; Three otherwise hashes every reference. */
export function mergeCrowdVertices(geometry: BufferGeometry): BufferGeometry {
  const source = geometry.index;
  if (!source) return mergeVertices(geometry);
  const seen = new Uint8Array(geometry.getAttribute('position').count), unique: number[] = [];
  for (let i = 0; i < source.count; i++) {
    const vertex = source.getX(i);
    if (!seen[vertex]) { seen[vertex] = 1; unique.push(vertex); }
  }
  let merged: BufferGeometry;
  try { geometry.setIndex(unique); merged = mergeVertices(geometry); }
  finally { geometry.setIndex(source); }
  const lookup = new Uint32Array(seen.length), welded = merged.index!;
  unique.forEach((vertex, i) => { lookup[vertex] = welded.getX(i); });
  const IndexArray = merged.getAttribute('position').count > 65535 ? Uint32Array : Uint16Array;
  const indices = new IndexArray(source.count);
  for (let i = 0; i < indices.length; i++) indices[i] = lookup[source.getX(i)];
  merged.setIndex(new BufferAttribute(indices, 1));
  return merged;
}
