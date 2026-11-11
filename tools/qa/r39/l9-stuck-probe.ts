// r39-markers native probe: the L9 APC between a front barrier and a rear barrier (open sides) with W held must get out.
import { decodeSave } from '../../../src/sim/progression/Save';
import { loadLevel } from '../../sim-runner/levels';
import { emptyInput } from '../../../src/input/InputFrame';
import { readFixture } from '../fixture-io';
import * as RAPIER from '@dimforge/rapier3d-compat';
const f = readFixture('tests/fixtures/saves/qa/l9-at-bridge.json.br');
const d = decodeSave(JSON.stringify(f.campaign)); if (d.status !== 'ok') throw new Error('decode');
const world = await loadLevel('L9', 1, d.save);
try {
  const l9 = world.missions!.l9!, off = process.argv.includes('--off');
  const car = () => world.vehicles!.cars.get(l9.state.carId)!;
  const p0 = { ...car().entity.transform };
  const x = p0.x, z = p0.z;
  // A tight pocket: front wall, rear wall and side rails 2.3 m off the axis from 5 m behind to 4 m ahead (no room for a three-point turn).
  for (const [bx, bz, hx, hz, name] of [[x + 6, z, .5, 7, 'front'], [x - 8, z, .5, 7, 'rear'], [x - 1, z + 2.6, 7, .3, 'left'], [x - 1, z - 2.6, 7, .3, 'right']] as const) {
    world.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(hx, 1.5, hz).setTranslation(bx, 1.5, bz));
    world.solids.setBarrier(`r39.${name}`, { x: bx, y: 1.5, z: bz, halfX: hx, halfY: 1.5, halfZ: hz } as never);
  }
  console.log('start', x.toFixed(1), z.toFixed(1), 'yaw', p0.yaw.toFixed(2));
  let freed = -1; let maxFromStart = 0;
  for (let i = 0; i < 2400; i++) {
    const fr = emptyInput(); fr.drive = { throttle: 1, steer: 0 } as never; fr.brake = false;
    world.applyInput(fr, 'keyboard'); world.update();
    const t = car().entity.transform; const dist = Math.hypot(t.x - x, t.z - z); maxFromStart = Math.max(maxFromStart, dist);
    if (freed < 0 && dist > 4 && (Math.abs(t.z - z) > 4 || t.x > x + 7 || t.x < x - 9)) freed = i;
    if (i % 300 === 0) console.log(i, t.x.toFixed(1), t.z.toFixed(1), 'yaw', t.yaw.toFixed(2), 'speed', car().physics.speed.toFixed(2), 'phase', l9.state.phase);
  }
  console.log('freedAt', freed, 'maxFromStart', maxFromStart.toFixed(1), off ? '(off)' : '');
} finally { world.dispose(); }
