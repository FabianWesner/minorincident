import { l4 } from './l4';

/** Shared solid collision and visible military line for every actor. */
const p = l4.perimeter;
export const l4PerimeterWalls = [
  { x: (p.x0 + p.x1) / 2, z: p.z0, halfX: (p.x1 - p.x0) / 2 + .2, halfZ: .2 },
  { x: (p.x0 + p.x1) / 2, z: p.z1, halfX: (p.x1 - p.x0) / 2 + .2, halfZ: .2 },
  { x: p.x0, z: (p.z0 + p.z1) / 2, halfX: .2, halfZ: (p.z1 - p.z0) / 2 + .2 },
  { x: p.x1, z: (p.z0 + p.z1) / 2, halfX: .2, halfZ: (p.z1 - p.z0) / 2 + .2 },
].map((wall, side) => ({ ...wall, y: .4, halfY: .4, id: `l4-perimeter-${side}` }));

export const l4PerimeterSegments = l4PerimeterWalls.flatMap((wall, side) => {
  const alongX = wall.halfX > wall.halfZ, half = alongX ? wall.halfX : wall.halfZ, count = Math.ceil(half * 2 / 2.4), length = half * 2 / count;
  return Array.from({ length: count }, (_, i) => ({ side, x: wall.x + (alongX ? -half + length * (i + .5) : 0), z: wall.z + (alongX ? 0 : -half + length * (i + .5)), yaw: alongX ? 0 : Math.PI / 2, length }));
});
