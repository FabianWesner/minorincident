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

/** Planters baked into a district mesh (Fairhaven's wooden flower boxes) exist only as decoration flowers: 3+ flowers within 1.2 m form one box. */
export function flowerClusterBoxes(decorations: readonly { kind: string; position: readonly number[] }[] | undefined, origin: readonly [number, number]): FlowerBox[] {
  const clusters: (FlowerBox & { n: number })[] = [];
  for (const d of decorations ?? []) if (d.kind === 'flower') {
    const x = d.position[0] + origin[0], z = d.position[2] + origin[1];
    const c = clusters.find(k => x >= k.x0 - 1.2 && x <= k.x1 + 1.2 && z >= k.z0 - 1.2 && z <= k.z1 + 1.2);
    if (c) { c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.z0 = Math.min(c.z0, z); c.z1 = Math.max(c.z1, z); c.n++; } else clusters.push({ x0: x, z0: z, x1: x, z1: z, n: 1 });
  }
  const rim = .28; // half the depth of the flower-box mesh (prop.flower-box 0.56 x 1.26 m): the box edge lies this far outside the flowers
  return clusters.filter(c => c.n >= 3 && c.x1 - c.x0 <= 1.6 && c.z1 - c.z0 <= 1.6).map(({ x0, z0, x1, z1 }) => ({ x0: x0 - rim, z0: z0 - rim, x1: x1 + rim, z1: z1 + rim }));
}
