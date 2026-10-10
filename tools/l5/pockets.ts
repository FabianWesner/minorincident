// Find hiding pockets: reachable cells with room for a vehicle that no road centre line within 40 m can see. npx tsx tools/l5/pockets.ts
import { readFileSync } from 'node:fs';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout, Point } from '../../src/levels/districts/types';
import { levelFiveLayouts } from '../../src/levels/L5/layout';
import { bakeNav } from '../../src/sim/world/NavGrid';

const base = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout;
const [layout] = levelFiveLayouts([base]);
const solid = placementColliders(layout.placements, layout.colliders).filter(c => !c.walkable && c.aabb.max[1] > 1.2).map(c => c.aabb);
const nav = bakeNav([{ layout, origin: [0, 0], colliders: solid }], 1, 0.5);
const start: Point = [layout.anchors['l5-out'].position[0], layout.anchors['l5-out'].position[2]];
const reached = nav.flood(start);
const blocked = (x: number, z: number) => solid.some(a => x >= a.min[0] && x <= a.max[0] && z >= a.min[2] && z <= a.max[2]);
const see = (a: Point, b: Point) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5); for (let i = 1; i < n; i++) if (blocked(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n)) return false; return true; };
const roads: Point[] = [];
for (const e of layout.roads.edges) for (let i = 1; i < e.points.length; i++) { const [a, b] = [e.points[i - 1], e.points[i]], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2); for (let k = 0; k <= n; k++) roads.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
const clear = (x: number, z: number, r: number) => { for (let dx = -r; dx <= r; dx += .5) for (let dz = -r; dz <= r; dz += .5) { const i = nav.index(x + dx, z + dz); if (i < 0 || !nav.cells[i] || !reached[i]) return false; } return true; };
const out: string[] = [];
for (let x = -84; x <= 84; x += 2) for (let z = -62; z <= 62; z += 2) {
  if (!clear(x, z, 1.6)) continue;
  if (roads.some(r => Math.hypot(r[0] - x, r[1] - z) < 40 && see(r, [x, z]))) continue;
  out.push(`${x},${z}`);
}
console.log(out.length, out.join(' '));
