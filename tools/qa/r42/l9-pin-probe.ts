// r42-l9pin native probe: the r41 pin. L9 at-bridge fixture (evacuation done, "Drive onto the bridge"), the APC set at the bay's
// west edge (443.1, 6.3, yaw 0) with the evacuation gate shut, walled in front (pocket like r39) and a pile of N infected around it.
// Driver: W toward the marker with A/D, plus Space (handbrake) 400 of every 1500 ms while boarders ride (--mode hud) or W only (--mode w).
// Prints when the hull is first > 6 m from the start (freed) or never.
// Usage: node --import tsx/esm tools/qa/r42/l9-pin-probe.ts [--mode hud|w] [--pile 50] [--pocket] [--seconds 40]
import { decodeSave } from '../../../src/sim/progression/Save';
import { loadLevel } from '../../sim-runner/levels';
import { emptyInput } from '../../../src/input/InputFrame';
import { markerAnchor } from '../../../src/sim/missions/markerAnchor';
import { readFixture } from '../fixture-io';
import * as RAPIER from '@dimforge/rapier3d-compat';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const mode = arg('--mode', 'hud'), pile = Number(arg('--pile', '50')), seconds = Number(arg('--seconds', '40')), pocket = process.argv.includes('--pocket');
const f = readFixture('tests/fixtures/saves/qa/l9-at-bridge.json.br');
const d = decodeSave(JSON.stringify(f.campaign)); if (d.status !== 'ok') throw new Error('decode');
const world = await loadLevel('L9', 1, d.save);
try {
  const m = world.missions!, l9 = m.l9!, s = l9.driving.state, car = () => world.vehicles!.cars.get(l9.state.carId)!;
  s.gateClosed = true; l9.driving.rebuild();
  const c = car(), x = 443.0949, z = 6.2527, yaw = 0, y = c.physics.def.suspension + c.physics.def.wheelRadius + .15;
  Object.assign(c.entity.transform, { x, y, z, yaw }); Object.assign(c.physics.previous, c.entity.transform);
  c.physics.body.setTranslation({ x, y, z }, true); c.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); c.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  world.spatial.set(c.entity.id, x, z);
  if (pocket) for (const [bx, bz, hx, hz, name] of [[x + 4.5, z, .5, 4, 'front'], [x - 1, z + 2.4, 5, .3, 'left'], [x - 1, z - 2.4, 5, .3, 'right']] as const) {
    world.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(hx, 1.5, hz).setTranslation(bx, 1.5, bz));
    world.solids.setBarrier(`r42.${name}`, { x: bx, y: 1.5, z: bz, halfX: hx, halfY: 1.5, halfZ: hz } as never);
  }
  const ai = world.infected!; let spawned = 0; (ai.director as unknown as { levelCap: number }).levelCap = 2000; // probe-only stress: the pile is on top of the fixture's own horde
  for (let k = 0; k < pile && ai.pool.length && ai.director.count + 4 < 2000; k++) {
    // The r41 pile: the left side and rear, two to three bodies deep, plus a ring through the bay.
    const a = Math.PI * (.4 + 1.2 * (k % 25) / 25), r = 3.2 + Math.floor(k / 25) * 1.1 + (k % 3) * .4;
    const id = ai.spawn(['infected.runner', 'infected.sprinter', 'infected.dog', 'infected.runner', 'infected.armored'][k % 5], { x: x + Math.cos(a) * r, z: z - Math.sin(a) * r }, { state: 'chase' }); ai.pursueTarget(id, 1); spawned++;
  }
  for (let i = 0; i < 60; i++) { world.applyInput(emptyInput(), 'keyboard'); world.update(); }
  let freed = -1, recov = 0, maxD = 0;
  world.events.on('vehicle.recovering', () => recov++);
  for (let i = 0; i < seconds * 60; i++) {
    const p = car().entity.transform, fr = emptyInput(), goal = markerAnchor(m);
    if (goal) { const want = -Math.atan2(goal.z - p.z, goal.x - p.x), delta = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)); fr.drive = { throttle: 1, steer: delta > .06 ? 1 : delta < -.06 ? -1 : 0 }; }
    else fr.drive = { throttle: 1, steer: 0 };
    fr.brake = false;
    if (mode === 'hud' && car().entity.vehicle!.attached.length && (i * 1000 / 60) % 1500 < 400) fr.handbrake = true;
    world.applyInput(fr, 'keyboard'); world.update();
    const dist = Math.hypot(car().entity.transform.x - x, car().entity.transform.z - z); maxD = Math.max(maxD, dist);
    if (freed < 0 && dist > 6) freed = i;
    if (i % 300 === 0) console.log(i, car().entity.transform.x.toFixed(2), car().entity.transform.z.toFixed(2), 'v', car().physics.speed.toFixed(2), 'att', car().entity.vehicle!.attached.length, 'stuck', car().physics.stuck, 'phase', l9.state.phase, l9.driving.text());
    if (l9.state.phase !== 'driving') break;
  }
  console.log(JSON.stringify({ mode, pile: spawned, pocket, freedS: freed < 0 ? null : +(freed / 60).toFixed(1), maxD: +maxD.toFixed(1), recoveries: recov, phase: l9.state.phase }));
} finally { world.dispose(); }
