import type { Vec2 } from '../../input/InputFrame';
import type { FieldCell } from '../interact/FieldFire';

/** Choose a local waypoint around the first burning crop block on a direct route. */
export function avoidFieldFire(from: Vec2, target: Vec2, cells: readonly FieldCell[], clear: (point: Vec2) => boolean): Vec2 | null {
  const dx = target.x - from.x, dz = target.z - from.z, length = Math.hypot(dx, dz);
  if (length < .01) return target;
  const ux = dx / length, uz = dz / length;
  let first: FieldCell | undefined, nearest = Infinity;
  for (const cell of cells) if (cell.state === 'burning') {
    const x = cell.x - from.x, z = cell.z - from.z, along = x * ux + z * uz, side = x * -uz + z * ux;
    if (along >= -7 && along <= length + 7 && Math.abs(side) < 7 && along < nearest) { first = cell; nearest = along; }
  }
  if (!first) return target;
  for (const sign of [-1, 1]) {
    const point = { x: first.x - uz * 8 * sign - ux * 2, z: first.z + ux * 8 * sign - uz * 2 };
    const sx = point.x - from.x, sz = point.z - from.z, length2 = sx * sx + sz * sz;
    const safe = cells.every(cell => {
      if (cell.state !== 'burning') return true;
      const x = cell.x - from.x, z = cell.z - from.z;
      const t = Math.max(0, Math.min(1, (x * sx + z * sz) / length2));
      // An actor already inside fire may move out, but may not go deeper.
      if (Math.hypot(x, z) < 7) return x * sx + z * sz <= 0;
      return Math.hypot(x - sx * t, z - sz * t) >= 7;
    });
    if (safe && clear(point)) return point;
  }
  return null;
}
