/** Shared APC circle/box contact, also used by the static bake and other vehicle hulls. */
export interface SolidBox { x: number; z: number; y: number; halfX: number; halfZ: number; halfY: number; yaw?: number; navBlocker?: boolean }
export interface Contact { depth: number; nx: number; nz: number; inside: boolean }
export function boxContact(box: SolidBox, x: number, z: number, radius: number, out: Contact): Contact {
  const c = Math.cos(box.yaw ?? 0), s = Math.sin(box.yaw ?? 0), dx = x - box.x, dz = z - box.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const ox = lx - Math.max(-box.halfX, Math.min(box.halfX, lx)), oz = lz - Math.max(-box.halfZ, Math.min(box.halfZ, lz));
  const distance = Math.hypot(ox, oz);
  let nx: number, nz: number;
  out.inside = Math.abs(lx) < box.halfX && Math.abs(lz) < box.halfZ;
  if (distance > 0) { out.depth = radius - distance; nx = ox / distance; nz = oz / distance; }
  else if (box.halfX - Math.abs(lx) < box.halfZ - Math.abs(lz)) { out.depth = radius + box.halfX - Math.abs(lx); nx = lx < 0 ? -1 : 1; nz = 0; }
  else { out.depth = radius + box.halfZ - Math.abs(lz); nx = 0; nz = lz < 0 ? -1 : 1; }
  out.nx = c * nx + s * nz; out.nz = -s * nx + c * nz;
  return out;
}
