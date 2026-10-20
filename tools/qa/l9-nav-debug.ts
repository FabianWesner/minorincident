/** Print the nav grid around a point of D-CROSSING: '#' blocked, '.' reached from the start, 'o' walkable but unreached.
 * usage: npx tsx tools/qa/l9-nav-debug.ts <x> <z> [radius] */
import { readFileSync } from 'node:fs';
import { crossing } from '../../src/levels/L9/district';
import { DistrictWorld } from '../../src/sim/world/DistrictWorld';
import { compositions } from '../../src/levels/compositions';
import type { DistrictLayout } from '../../src/levels/districts/types';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.layout.json', 'utf8')) as DistrictLayout;
const world = new DistrictWorld(compositions['D-CROSSING'], [layout], 31);
const reached = world.nav.flood(crossing.start);
const [cx, cz, r = 14] = process.argv.slice(2).map(Number);
for (let z = Math.round(cz - r); z <= cz + r; z++) {
  let row = '';
  for (let x = Math.round(cx - r * 1.5); x <= cx + r * 1.5; x++) row += !world.nav.walkable([x, z]) ? '#' : reached[world.nav.index(x, z)] ? '.' : 'o';
  console.log(row);
}
let un = 0;
for (let i = 0; i < world.nav.cells.length; i++) if (world.nav.cells[i] && !reached[i]) un++;
console.log('unreached walkable cells', un);
