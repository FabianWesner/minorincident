import { BufferAttribute, type BufferGeometry } from 'three';

/** Pack scalar part flags into one location so production crowds fit WebGL2's
 * 16-attribute minimum even with instancing, shaded normals and clip fades. */
export function packCrowdParts(geometry: BufferGeometry): void {
  const names = ['_part_index', '_shirt', '_emissive', '_vein'], count = geometry.getAttribute('position').count;
  const values = new Float32Array(count * 4);
  names.forEach((name, channel) => {
    const source = geometry.getAttribute(name);
    if (source) for (let i = 0; i < count; i++) values[i * 4 + channel] = source.getX(i);
    geometry.deleteAttribute(name);
  });
  geometry.setAttribute('_parts', new BufferAttribute(values, 4));
}
