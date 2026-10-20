import { staticCollision } from '../assets/staticCollision';
import type { Placement } from './districts/types';

const barriers = new Set(['prop.jersey-barrier', 'prop.privacy-fence', 'prop.picket-fence', 'prop.crowd-fence', 'prop.cure-mil-fence', 'prop.cure-quarantine-fence']);
/** Close small authoring seams, never actor-sized gate openings. Both render and collision consume the returned placements. */
export function closeBarrierJoints(placements: readonly Placement[]): Placement[] {
  const ends: { p: Placement; axis: 0 | 2; length: number; center: number; side: -1 | 1; x: number; z: number; y: number }[] = [];
  for (const p of placements) {
    const shape = barriers.has(p.assetId) && staticCollision[p.collisionId ?? p.assetId];
    if (!shape || !shape.boxes.length) continue;
    const min = [0, 2].map(axis => Math.min(...shape.boxes.map(b => b.min[axis])));
    const max = [0, 2].map(axis => Math.max(...shape.boxes.map(b => b.max[axis])));
    const axis = max[0] - min[0] > max[1] - min[1] ? 0 : 2;
    const length = (max[axis / 2] - min[axis / 2]) * p.scale[axis];
    for (const side of [-1, 1] as const) {
      const end = side < 0 ? min[axis / 2] : max[axis / 2];
      const x = (axis === 0 ? end : (min[0] + max[0]) / 2) * p.scale[0], z = (axis === 2 ? end : (min[1] + max[1]) / 2) * p.scale[2];
      ends.push({ p, axis, length, center: (min[axis / 2] + max[axis / 2]) / 2, side, x: p.position[0] + x * Math.cos(p.yaw) + z * Math.sin(p.yaw), z: p.position[2] - x * Math.sin(p.yaw) + z * Math.cos(p.yaw), y: p.position[1] });
    }
  }
  const extensions = new Map<Placement, { axis: 0 | 2; length: number; center: number; left: number; right: number }>();
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
    const a = ends[i], b = ends[j];
    if (a.p === b.p || Math.abs(a.y - b.y) > .02 || a.p.maxTier < b.p.minTier || b.p.maxTier < a.p.minTier) continue;
    const gap = Math.hypot(a.x - b.x, a.z - b.z);
    if (gap <= .02 || gap > .16) continue;
    const ax = a.side * (a.axis === 0 ? Math.cos(a.p.yaw) : Math.sin(a.p.yaw)), az = a.side * (a.axis === 0 ? -Math.sin(a.p.yaw) : Math.cos(a.p.yaw));
    const bx = b.side * (b.axis === 0 ? Math.cos(b.p.yaw) : Math.sin(b.p.yaw)), bz = b.side * (b.axis === 0 ? -Math.sin(b.p.yaw) : Math.cos(b.p.yaw));
    if ((b.x - a.x) * ax + (b.z - a.z) * az <= 0 || (a.x - b.x) * bx + (a.z - b.z) * bz <= 0) continue;
    const amount = ax * bx + az * bz < -.95 ? gap / 2 + .001 : gap + .002;
    for (const e of [a, b]) {
      const extension = extensions.get(e.p) ?? { axis: e.axis, length: e.length, center: e.center, left: 0, right: 0 };
      const side = e.side < 0 ? 'left' : 'right'; extension[side] = Math.max(extension[side], amount);
      extensions.set(e.p, extension);
    }
  }
  return placements.map(p => {
    const extension = extensions.get(p); if (!extension) return p;
    const { axis, left, right, length, center } = extension;
    const scale: Placement['scale'] = [...p.scale]; scale[axis] *= 1 + (left + right) / length;
    const dx = axis === 0 ? Math.cos(p.yaw) : Math.sin(p.yaw), dz = axis === 0 ? -Math.sin(p.yaw) : Math.cos(p.yaw);
    const shift = (right - left) / 2 + center * (p.scale[axis] - scale[axis]);
    // Move only the joined endpoint; the opposite end may bound an intentional gate.
    const position: Placement['position'] = [p.position[0] + dx * shift, p.position[1], p.position[2] + dz * shift];
    const visualAabb: Placement['visualAabb'] = { ...p.visualAabb, min: [Infinity, p.visualAabb.min[1], Infinity], max: [-Infinity, p.visualAabb.max[1], -Infinity] };
    for (const x of [p.visualAabb.min[0], p.visualAabb.max[0]]) for (const z of [p.visualAabb.min[2], p.visualAabb.max[2]]) {
      const displacement = shift + ((x - p.position[0]) * dx + (z - p.position[2]) * dz) * (scale[axis] / p.scale[axis] - 1);
      for (const [i, value] of [[0, x + dx * displacement], [2, z + dz * displacement]] as const) {
        visualAabb.min[i] = Math.min(visualAabb.min[i], value); visualAabb.max[i] = Math.max(visualAabb.max[i], value);
      }
    }
    return { ...p, scale, position, visualAabb };
  });
}
