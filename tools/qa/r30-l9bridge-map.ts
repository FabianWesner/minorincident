// Native probe: ASCII map of clear (.) vs blocked (#) cells around the L9 evacuation bay / bridge approach (radius 2 m).
import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel } from '../sim-runner/levels';
import { readFixture } from './fixture-io';
const f = readFixture('tests/fixtures/saves/qa/l9-at-bridge.json.br');
const d = decodeSave(JSON.stringify(f.campaign)); if (d.status !== 'ok') throw new Error('decode');
const world = await loadLevel('L9', 1, d.save);
try {
  for (let i = 0; i < 5; i++) world.update();
  const r = Number(process.argv[2] ?? 2);
  const car = world.vehicles!.cars.get(world.missions!.l9!.state.carId)!;
  const rows: string[] = [];
  for (let z = -24; z <= 24; z += 2) {
    let row = String(z).padStart(4) + ' ';
    for (let x = 420; x <= 500; x += 2) {
      const nav = world.infected!.nav.clear(x, z, r), sol = world.solids.clear({ x, y: 0.7, z }, r, 1, false);
      row += nav && sol ? '.' : nav ? 's' : sol ? 'n' : '#';
    }
    rows.push(row);
  }
  console.log('x=420..500 step 2; . clear, # nav+solid, n nav-blocked, s solid-blocked; apc', car.entity.transform.x.toFixed(1), car.entity.transform.z.toFixed(1));
  console.log(rows.join('\n'));
} finally { world.dispose(); }
