import { writeFileSync, readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { SimWorld } from '../../src/sim/world/SimWorld';
/** Dev aid: dumps the walk grid of a composition as a PGM (white = walkable) for level layout work. */
const id = process.argv[2] ?? 'L1', out = process.argv[3] ?? 'test-results/nav.pgm';
const world = new SimWorld(); await world.init();
const c = compositions[id];
world.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
const nav = world.infected!.nav;
const header = `P5\n${nav.width} ${nav.depth}\n255\n`, data = Buffer.alloc(nav.width * nav.depth);
for (let i = 0; i < data.length; i++) data[i] = nav.blocked[i] ? 40 : 230;
writeFileSync(out, Buffer.concat([Buffer.from(header), data]));
console.log(nav.width, nav.depth, nav.x(0), nav.z(0));
world.dispose();
