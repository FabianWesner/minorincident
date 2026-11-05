import { readFileSync, writeFileSync } from 'node:fs';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { compositions } from '../../src/levels/compositions';
const world = new SimWorld(); await world.init();
try {
  world.loadComposition(compositions.L7, [JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8'))], 29);
  const positions: [number, number][] = [];
  for (let z = -20; z <= 33; z += 2.5) for (let x = -34; x <= -2; x += 2.5) if (world.infected!.nav.clear(x, z, .6)) positions.push([x, z]);
  const spread = positions.filter((_, i) => i % 2 === 0).concat(positions.filter((_, i) => i % 2 === 1)).slice(0, 200);
  if (spread.length !== 200) throw new Error('District stress needs 200 clear spawn positions');
  writeFileSync('tests/scenes/l7-district/stress-positions.json', JSON.stringify(spread));
} finally { world.dispose(); }
