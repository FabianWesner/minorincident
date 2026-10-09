// ASCII walkability map of the built D-FAIR layout (authoring check): npx tsx tools/l4/map.ts [step] [x0 x1 z0 z1]
// '.' reachable from the player start, 'o' walkable but unreachable (islands), '#' blocked, 'D' refuge door, 'S' start.
import { readFileSync } from 'node:fs';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout, Point } from '../../src/levels/districts/types';
import { levelFourLayouts } from '../../src/levels/L4/layout';
import { bakeNav } from '../../src/sim/world/NavGrid';

const base = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout;
const [layout] = levelFourLayouts([base]);
const solid = placementColliders(layout.placements, layout.colliders).filter(c => !c.walkable);
const nav = bakeNav([{ layout, origin: [0, 0], colliders: solid.map(c => c.aabb) }], 1, 0.5);
const start: Point = [layout.anchors['player-start'].position[0], layout.anchors['player-start'].position[2]];
const reached = nav.flood(start);
const step = Number(process.argv[2] ?? 2), [x0, x1, z0, z1] = [Number(process.argv[3] ?? -86), Number(process.argv[4] ?? 86), Number(process.argv[5] ?? -66), Number(process.argv[6] ?? 66)];
const doors = Object.entries(layout.anchors).filter(([n]) => n.startsWith('refuge-door-')).map(([, a]) => [a.position[0], a.position[2]]);
const lines: string[] = [];
for (let z = z0; z < z1; z += step) {
  let line = '';
  for (let x = x0; x < x1; x += step) {
    const i = nav.index(x + step / 2, z + step / 2);
    const door = doors.some(([dx, dz]) => dx >= x && dx < x + step && dz >= z && dz < z + step);
    const isStart = start[0] >= x && start[0] < x + step && start[1] >= z && start[1] < z + step;
    line += isStart ? 'S' : door ? 'D' : i < 0 ? ' ' : !nav.cells[i] ? '#' : reached[i] ? '.' : 'o';
  }
  lines.push(line);
}
console.log(lines.join('\n'));
const at = (x: number, z: number) => { const i = nav.index(x, z); return i >= 0 && reached[i] === 1; };
console.log('start', start, 'doors', doors.length, 'unreachable doors', JSON.stringify(doors.filter(([x, z]) => !at(x, z)).map(([x, z]) => [+x.toFixed(1), +z.toFixed(1)])));
for (const name of Object.keys(layout.anchors).filter(n => !n.startsWith('refuge-door-') && !n.startsWith('photo-'))) { const p = layout.anchors[name].position; console.log(name.padEnd(22), p[0].toFixed(1), p[2].toFixed(1), at(p[0], p[2]) ? 'reachable' : 'NOT reachable'); }
