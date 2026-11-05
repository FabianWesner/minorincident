// ASCII walkability map of the built L5 layout (authoring check): npx tsx tools/l5/map.ts [step] [x0 x1 z0 z1]
// '.' reachable from the metro foot, 'o' walkable but unreachable (islands), '#' blocked, 'D' refuge door, 'R' survivor ring, 'H' hiding place, 'B' burned/wrecked blocker.
import { readFileSync } from 'node:fs';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout, Point } from '../../src/levels/districts/types';
import { levelFiveLayouts } from '../../src/levels/L5/layout';
import { bakeNav } from '../../src/sim/world/NavGrid';

const base = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout;
const [layout] = levelFiveLayouts([base]);
const solid = placementColliders(layout.placements, layout.colliders).filter(c => !c.walkable);
const nav = bakeNav([{ layout, origin: [0, 0], colliders: solid.map(c => c.aabb) }], 1, 0.5);
const start: Point = [layout.anchors['l5-out'].position[0], layout.anchors['l5-out'].position[2]];
const reached = nav.flood(start);
const step = Number(process.argv[2] ?? 2), [x0, x1, z0, z1] = [Number(process.argv[3] ?? -86), Number(process.argv[4] ?? 86), Number(process.argv[5] ?? -66), Number(process.argv[6] ?? 66)];
const marks = (prefix: string) => Object.entries(layout.anchors).filter(([n]) => n.startsWith(prefix)).map(([, a]) => [a.position[0], a.position[2]]);
const doors = marks('refuge-door-'), rings = marks('l5-ring-'), hides = marks('l5-hide-');
const lines: string[] = [];
const has = (list: number[][], x: number, z: number) => list.some(([dx, dz]) => dx >= x && dx < x + step && dz >= z && dz < z + step);
for (let z = z0; z < z1; z += step) {
  let line = '';
  for (let x = x0; x < x1; x += step) {
    const i = nav.index(x + step / 2, z + step / 2);
    line += has(rings, x, z) ? 'R' : has(hides, x, z) ? 'H' : has(doors, x, z) ? 'D' : i < 0 ? ' ' : !nav.cells[i] ? '#' : reached[i] ? '.' : 'o';
  }
  lines.push(`${String(z).padStart(4)} ${line}`);
}
console.log(`x from ${x0} step ${step}`);
console.log(lines.join('\n'));
const at = (x: number, z: number) => { const i = nav.index(x, z); return i >= 0 && reached[i] === 1; };
for (const name of Object.keys(layout.anchors).filter(n => /^(l5-|pair-|photo-l5)/.test(n)).concat(['metro-entrance', 'kessler-cellar-door'])) { const p = layout.anchors[name].position; console.log(name.padEnd(24), p[0].toFixed(1), p[2].toFixed(1), at(p[0], p[2]) ? 'reachable' : 'NOT reachable'); }
