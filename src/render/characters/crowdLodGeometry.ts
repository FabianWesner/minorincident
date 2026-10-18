import { BufferAttribute, Vector3, type BufferGeometry } from 'three';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

/** Rigid-part figures: only indices change. Original vertices, colors, eyes
 * and animation ownership survive; no triangle can span two animated parts.
 * Infected runtime bakes opt into surface retention; civilian shipped bakes
 * retain their existing deterministic reduction. */
export async function simplifyCrowdLod(geometry: BufferGeometry, maxError = .01, ratio = .35, preserveSurface = false): Promise<void> {
  if (!geometry.index) return;
  await MeshoptSimplifier.ready;
  const position = geometry.getAttribute('position'), part = geometry.getAttribute('_part_index');
  const names = ['normal', 'color', '_shirt', '_emissive', ...(geometry.hasAttribute('_vein') ? ['_vein'] : []), ...(geometry.hasAttribute('_gripPosition') ? ['_gripPosition'] : [])];
  const attributes = names.map(name => geometry.getAttribute(name));
  const stride = attributes.reduce((n, a) => n + a.itemSize, 0), values = new Float32Array(position.count * stride), locks = new Uint8Array(position.count);
  const grippedParts = new Set<number>();
  for (let i = 0; i < position.count; i++) {
    let offset = i * stride;
    for (const [a, attribute] of attributes.entries()) for (let c = 0; c < attribute.itemSize; c++) {
      const value = attribute.getComponent(i, c);
      // Position error is already measured by Meshopt. Preserve the grip's
      // deformation without counting unchanged body coordinates a second time.
      const delta = names[a] === '_gripPosition' ? value - position.getComponent(i, c) : value;
      values[offset++] = delta;
      if (names[a] === '_gripPosition' && delta !== 0) grippedParts.add(part.getX(i));
    }
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
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  const area = (indices: ArrayLike<number>) => {
    let sum = 0;
    for (let i = 0; i < indices.length; i += 3) {
      a.fromBufferAttribute(position, indices[i]); b.fromBufferAttribute(position, indices[i + 1]).sub(a); c.fromBufferAttribute(position, indices[i + 2]).sub(a);
      sum += b.cross(c).length() / 2;
    }
    return sum;
  };
  let maximumError = 0;
  for (const [owner, indices] of groups) {
    // The grip tessellator adds thousands of coplanar hand triangles. Let the
    // error bound determine their density, with a tighter 1 mm skin margin.
    const gripped = grippedParts.has(owner);
    const targetRatio = gripped ? .01 : ratio;
    const [reduced, error] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(indices), position.array as Float32Array, 3, values, stride,
      weights, locks, Math.max(3, Math.floor(indices.length * targetRatio / 3) * 3), gripped ? Math.min(maxError, .001) : maxError,
      ['Permissive', 'Sparse', 'ErrorAbsolute']);
    // Position error alone permits thin clothing/limb shells to collapse into
    // disconnected patches. Keep the authored part if its surface erodes;
    // bounds and eye locks cannot detect those missing interior surfaces.
    const keep = preserveSurface && area(reduced) < area(indices) * .85;
    if (!keep) maximumError = Math.max(maximumError, error);
    for (const index of keep ? indices : reduced) result.push(index);
  }
  geometry.setIndex(new BufferAttribute(new Uint32Array(result), 1));
  geometry.userData.crowdLodError = maximumError;
}
