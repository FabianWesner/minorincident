import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { SimWorld } from '../../src/sim/world/SimWorld';
/** Dev aid: nav path lengths between named points (pairs of x,z from argv as "x1,z1:x2,z2"). */
const world = new SimWorld(); await world.init();
const c = compositions.L2;
world.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
const nav = world.infected!.nav;
for (const arg of process.argv.slice(2)) {
  const [a, b] = arg.split(':').map(s => s.split(',').map(Number));
  const from = nav.nearestCell(a[0], a[1]), to = nav.nearestCell(b[0], b[1]);
  const path: number[] = [], ok = nav.path(from, to, path, 400000);
  let length = 0, maxX = -Infinity, minZ = Infinity;
  if (ok) for (let i = 1; i < path.length; i++) { length += Math.hypot(nav.x(path[i]) - nav.x(path[i - 1]), nav.z(path[i]) - nav.z(path[i - 1])); maxX = Math.max(maxX, nav.x(path[i])); minZ = Math.min(minZ, nav.z(path[i])); }
  console.log(arg, ok ? `len ${length.toFixed(1)} cells ${path.length} minZ ${minZ.toFixed(1)}` : 'NO PATH', 'fromBlocked', nav.blocked[nav.cell(a[0], a[1])], 'toBlocked', nav.blocked[nav.cell(b[0], b[1])]);
}
world.dispose();
