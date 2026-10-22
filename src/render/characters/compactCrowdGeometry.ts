import { BufferAttribute, type BufferGeometry, type TypedArray } from 'three';

/** Drop vertices no longer referenced after index-only LOD simplification.
 * Copy raw attribute components: normalized packed colors and part ids retain
 * their exact bytes, and every drawn triangle retains its original order. */
export function compactCrowdGeometry(geometry: BufferGeometry): void {
  const index = geometry.index, position = geometry.getAttribute('position');
  if (!index || !position) return;
  const remap = new Int32Array(position.count).fill(-1), vertices: number[] = [];
  const indices = new Uint32Array(index.count);
  for (let i = 0; i < index.count; i++) {
    const source = index.getX(i);
    if (remap[source] === -1) { remap[source] = vertices.length; vertices.push(source); }
    indices[i] = remap[source];
  }
  if (vertices.length === position.count) return;
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const interleaved = 'data' in attribute;
    const source = interleaved ? attribute.data.array : attribute.array;
    const ArrayType = source.constructor as new (length: number) => TypedArray;
    const array = new ArrayType(vertices.length * attribute.itemSize);
    for (let i = 0; i < vertices.length; i++) {
      const start = vertices[i] * (interleaved ? attribute.data.stride : attribute.itemSize) + (interleaved ? attribute.offset : 0);
      array.set(source.subarray(start, start + attribute.itemSize), i * attribute.itemSize);
    }
    const compact = new BufferAttribute(array, attribute.itemSize, attribute.normalized);
    compact.name = attribute.name;
    compact.setUsage(interleaved ? attribute.data.usage : attribute.usage);
    if (!interleaved) compact.gpuType = attribute.gpuType;
    geometry.setAttribute(name, compact);
  }
  geometry.setIndex(new BufferAttribute(indices, 1));
}
