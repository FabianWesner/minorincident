import { readFileSync } from 'node:fs';
import { DistrictWorld } from '../../src/sim/world/DistrictWorld';
import { compositions } from '../../src/levels/compositions';
import type { DistrictLayout, Point } from '../../src/levels/districts/types';
/** world-fill: walkable nav cells the start cannot reach (closed pockets), with the placements beside them.
 * npx tsx tools/qa/nav-pockets.ts <D-CROSSING|D-CURE> <startX> <startZ> */
const [id, sx, sz] = process.argv.slice(2);
const layout = JSON.parse(readFileSync(`public/assets/layouts/${id}.layout.json`, 'utf8')) as DistrictLayout;
const w = new DistrictWorld(compositions[id], [layout], 31), nav = w.nav as unknown as { cells: Uint8Array; flood(p: Point): Uint8Array; index(x: number, z: number): number; min: Point; cellSize?: number; width?: number };
const reached = nav.flood([Number(sx), Number(sz)]);
const cells: number[] = [];
for (let i = 0; i < nav.cells.length; i++) if (nav.cells[i] && !reached[i]) cells.push(i);
console.log('disconnected', cells.length, Object.keys(nav).join(','));
const pts = new Map<string, number>();
// Recover cell centres by probing the index on a 0.5 m grid near every placement (index is the only public mapping).
const near = new Set(cells);
for (const p of layout.placements) {
  const [x, , z] = p.position;
  for (let dx = -6; dx <= 6; dx += .5) for (let dz = -6; dz <= 6; dz += .5) {
    const i = nav.index(x + dx, z + dz);
    if (near.has(i)) { const k = `${Math.round(x)},${Math.round(z)}`; pts.set(k + ' ' + p.id, (pts.get(k + ' ' + p.id) ?? 0) + 1); }
  }
}
const groups = new Map<string, string[]>();
for (const k of pts.keys()) { const [pos, pid] = k.split(' '); const [x, z] = pos.split(',').map(Number); const g = `${Math.round(x / 20) * 20},${Math.round(z / 20) * 20}`; groups.set(g, [...(groups.get(g) ?? []), pid + '@' + pos]); }
for (const [g, list] of groups) console.log(g, list.slice(0, 8).join(' '));
