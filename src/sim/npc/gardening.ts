import type { Point } from './types';

/** World-space footprint of a flower prop: a single flower is a zero-size box, a flower bed its visual AABB. */
export interface FlowerBox { x0: number; z0: number; x1: number; z1: number }

/** Nearest point of the box to p (p itself when inside). */
export function nearestOnBox(b: FlowerBox, p: Point): Point {
  return { x: Math.max(b.x0, Math.min(b.x1, p.x)), z: Math.max(b.z0, Math.min(b.z1, p.z)) };
}

/**
 * A spot to stand and tend a prop: at most `reaches[i]` (default 0.5 m, so never beyond 0.6; larger reaches only as fallbacks for solid props) from the prop and `ok` (clear and reachable).
 * Among the valid spots the one closest to `prefer` wins (the sidewalk side). The facing is the nearest point of the prop.
 * Derived from the prop's live position each time, so moved or removed props can never leave a stale stand point.
 */
export function standNear(box: FlowerBox, ok: (p: Point) => boolean, prefer: Point, reaches: readonly number[] = [.5]): { target: Point; facing: Point } | null {
  for (const reach of reaches) { const found = standAt(box, ok, prefer, reach); if (found) return found; }
  return null;
}
function standAt(box: FlowerBox, ok: (p: Point) => boolean, prefer: Point, reach: number): { target: Point; facing: Point } | null {
  let best: { target: Point; facing: Point } | null = null, bestD = Infinity;
  const step = .1, pad = reach + .1;
  for (let x = box.x0 - pad; x <= box.x1 + pad + 1e-9; x += step) for (let z = box.z0 - pad; z <= box.z1 + pad + 1e-9; z += step) {
    const p = { x, z }, facing = nearestOnBox(box, p), d = Math.hypot(p.x - facing.x, p.z - facing.z);
    if (d < reach - .1 || d > reach + 1e-9 || !ok(p)) continue;
    const score = Math.hypot(p.x - prefer.x, p.z - prefer.z);
    if (score < bestD) { bestD = score; best = { target: p, facing }; }
  }
  return best;
}
