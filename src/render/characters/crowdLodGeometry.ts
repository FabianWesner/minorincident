import { BufferAttribute, type BufferGeometry } from 'three';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

/** Rigid-part figures: only indices change. Original vertices, colors, eyes
 * and animation ownership survive; no triangle can span two animated parts. */
export async function simplifyCrowdLod(geometry: BufferGeometry, maxError = .01, ratio = .35): Promise<void> {
  if (!geometry.index) return;
  await MeshoptSimplifier.ready;
  const position = geometry.getAttribute('position'), part = geometry.getAttribute('_part_index');
  const names = ['normal', 'color', '_shirt', '_emissive', ...(geometry.hasAttribute('_vein') ? ['_vein'] : []), ...(geometry.hasAttribute('_gripPosition') ? ['_gripPosition'] : [])];
  const attributes = names.map(name => geometry.getAttribute(name));
  const stride = attributes.reduce((n, a) => n + a.itemSize, 0), values = new Float32Array(position.count * stride), locks = new Uint8Array(position.count);
  for (let i = 0; i < position.count; i++) {
    let offset = i * stride;
    for (const attribute of attributes) for (let c = 0; c < attribute.itemSize; c++) values[offset++] = attribute.getComponent(i, c);
    if (attributes[3].getX(i) > .5) locks[i] = 1; // Preserve the glowing eyes exactly.
  }
  const groups = new Map<number, number[]>(), source = geometry.index;
  for (let i = 0; i < source.count; i += 3) {
    const a = source.getX(i), b = source.getX(i + 1), c = source.getX(i + 2), owner = part.getX(a);
    if (part.getX(b) !== owner || part.getX(c) !== owner) return;
    if (!groups.has(owner)) groups.set(owner, []);
    groups.get(owner)!.push(a, b, c);
  }
  const weights = [.001, .001, .001, .05, .05, .05, .1, 1, ...(geometry.hasAttribute('_vein') ? [1] : []), ...(geometry.hasAttribute('_gripPosition') ? [1, 1, 1] : [])];
  const result: number[] = [];
  let maximumError = 0;
  for (const indices of groups.values()) {
    const [reduced, error] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(indices), position.array as Float32Array, 3, values, stride,
      weights, locks, Math.max(3, Math.floor(indices.length * ratio / 3) * 3), maxError,
      ['Permissive', 'Sparse', 'ErrorAbsolute']);
    maximumError = Math.max(maximumError, error);
    for (const index of reduced) result.push(index);
  }
  geometry.setIndex(new BufferAttribute(new Uint32Array(result), 1));
  geometry.userData.crowdLodError = maximumError;
}
