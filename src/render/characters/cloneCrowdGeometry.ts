import { BufferAttribute, BufferGeometry } from 'three';

/** Finished crowd vertex/index arrays are immutable. Give each scene its own
 * attribute wrappers (and therefore GPU resources/disposal) without retaining a
 * second CPU copy in the prepared-batch cache. Per-instance attributes are
 * attached only after this clone and remain scene-owned. */
export function cloneCrowdGeometry(source: BufferGeometry): BufferGeometry {
  const clone = new BufferGeometry();
  clone.name = source.name;
  const attribute = (a: BufferAttribute) => {
    const copy = new BufferAttribute(a.array, a.itemSize, a.normalized);
    copy.name = a.name; copy.setUsage(a.usage); copy.gpuType = a.gpuType;
    return copy;
  };
  if (source.index) clone.setIndex(attribute(source.index));
  for (const [name, a] of Object.entries(source.attributes)) {
    // The bake is deinterleaved before preparation. Preserve clone semantics
    // if a future channel uses an interleaved buffer instead.
    clone.setAttribute(name, 'data' in a ? a.clone() : attribute(a));
  }
  for (const name of ['position', 'normal', 'color'] as const) {
    const channels = source.morphAttributes[name];
    if (channels) clone.morphAttributes[name] = channels.map(a => 'data' in a ? a.clone() : attribute(a));
  }
  clone.morphTargetsRelative = source.morphTargetsRelative;
  for (const group of source.groups) clone.addGroup(group.start, group.count, group.materialIndex);
  clone.setDrawRange(source.drawRange.start, source.drawRange.count);
  clone.boundingBox = source.boundingBox?.clone() ?? null;
  clone.boundingSphere = source.boundingSphere?.clone() ?? null;
  clone.userData = { ...source.userData };
  return clone;
}
