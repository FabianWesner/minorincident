// r33-l9polish: where does a restored L9 checkpoint fixture put the APC, and what blocks the lane east of it.
import { loadLevel } from '../../sim-runner/levels';
import { readFixture } from '../fixture-io';
import { decodeSave } from '../../../src/sim/progression/Save';
const name = process.argv[2] ?? 'tests/fixtures/saves/qa/l9-at-bridge.json.br';
const decoded = decodeSave(JSON.stringify(readFixture(name).campaign));
if (decoded.status !== 'ok') throw new Error('decode');
const world = await loadLevel('L9', 1, decoded.save, 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, car = world.vehicles!.cars.get(l9.state.carId)!, p = car.entity.transform, s = l9.driving.state;
  console.log('apc', p.x.toFixed(1), p.z.toFixed(1), 'yaw', p.yaw.toFixed(2), 'evacDone', s.evacuationDone, 'laneClear8(yaw0,no bodies)', l9.driving.laneClear(8, 0, false), 'with bodies', l9.driving.laneClear(8, 0, true));
  const r = car.physics.def.width / 2 + .2;
  for (let d = car.physics.def.length / 2 + r + .5; d <= car.physics.def.length / 2 + r + 8; d += 1) {
    const x = p.x + d, z = p.z;
    console.log(d.toFixed(1), 'x', x.toFixed(1), 'nav', world.infected!.nav.clear(x, z, r), 'solids', world.solids.clear({ x, y: p.y, z }, r, car.entity.id, false));
  }
} finally { world.dispose(); }
