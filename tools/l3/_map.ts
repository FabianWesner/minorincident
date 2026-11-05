import { readFileSync } from 'node:fs';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout, Point } from '../../src/levels/districts/types';
import { validateLayout } from '../../src/levels/districts/validate';
import { worldAssets } from '../../src/assets/worldDefinitions';
import { bakeNav } from '../../src/sim/world/NavGrid';

const layout = JSON.parse(readFileSync('public/assets/layouts/D-CORRIDOR.layout.json', 'utf8')) as DistrictLayout;
console.log('validate', validateLayout(layout, worldAssets));
const solid = placementColliders(layout.placements, layout.colliders).filter(c => !c.walkable);
const nav = bakeNav([{ layout, origin: [0, 0], colliders: solid.map(c => c.aabb) }], 1, 0.5);
const start: Point = [layout.anchors['player-start'].position[0], layout.anchors['player-start'].position[2]];
const reached = nav.flood(start);
const step = Number(process.argv[2] ?? 2), [x0, x1, z0, z1] = [Number(process.argv[3] ?? -172), Number(process.argv[4] ?? 172), Number(process.argv[5] ?? -46), Number(process.argv[6] ?? 46)];
const doors = Object.entries(layout.anchors).filter(([n]) => n.startsWith('refuge-door-')).map(([, a]) => [a.position[0], a.position[2]]);
const lines: string[] = [];
for (let z = z0; z < z1; z += step) {
  let line = '';
  for (let x = x0; x < x1; x += step) {
    const i = nav.index(x + step / 2, z + step / 2);
    const door = doors.some(([dx, dz]) => dx >= x && dx < x + step && dz >= z && dz < z + step);
    line += door ? 'D' : i < 0 ? ' ' : !nav.cells[i] ? '#' : reached[i] ? '.' : 'o';
  }
  lines.push(line);
}
console.log(lines.join('\n'));
const at = (x: number, z: number) => { const i = nav.index(x, z); return i >= 0 && reached[i] === 1; };
console.log('zone reachable', at(141, 0), 'doors', doors.length, 'placements', layout.placements.length, 'buildings', layout.placements.filter(p => p.assetId.startsWith('bld.')).length);
const unreachable = doors.filter(([x, z]) => !at(x, z));
console.log('unreachable doors', unreachable.length, JSON.stringify(unreachable.slice(0, 20)));
