import { wreckRoofs } from '../../assets/wreckRoofs';
import type { Placement } from './types';

/** Highest drawn upward surface under a point. No renderer objects enter the sim. */
export function wreckRoofHeight(p: Placement, x: number, z: number): number | undefined {
  const roof = wreckRoofs[`${p.assetId}:${p.decay}`];
  if (!roof) return undefined;
  const dx = x - p.position[0], dz = z - p.position[2], cos = Math.cos(p.yaw), sin = Math.sin(p.yaw);
  const px = (dx * cos - dz * sin) / p.scale[0], pz = (dx * sin + dz * cos) / p.scale[2];
  let height = 0;
  const points = roof.positions;
  for (let i = 0; i < roof.indices.length; i += 3) {
    const a = roof.indices[i] * 3, b = roof.indices[i + 1] * 3, c = roof.indices[i + 2] * 3;
    const ax = points[a], az = points[a + 2], bx = points[b], bz = points[b + 2], cx = points[c], cz = points[c + 2];
    if (px < Math.min(ax, bx, cx) || px > Math.max(ax, bx, cx) || pz < Math.min(az, bz, cz) || pz > Math.max(az, bz, cz)) continue;
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(den) < 1e-10) continue;
    const u = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den;
    const v = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den;
    if (u < -1e-5 || v < -1e-5 || u + v > 1.00001) continue;
    height = Math.max(height, (u * points[a + 1] + v * points[b + 1] + (1 - u - v) * points[c + 1]) * p.scale[1] + p.position[1]);
  }
  return height;
}
