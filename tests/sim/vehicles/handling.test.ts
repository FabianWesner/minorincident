import { expect, test } from 'vitest';
import { Physics } from '../../../src/physics/Physics';
import { vehicleDef } from '../../../src/data/vehicles';
import { VehicleBody } from '../../../src/sim/vehicles/VehicleBody';
async function car() { const physics = new Physics(); await physics.init(); physics.load({ name: 'vehicle-test', ground: { width: 1000, depth: 1000 }, player: { x: -400, y: .7, z: -400 } }); const car = new VehicleBody(vehicleDef('vehicle.sedan'), physics.world!, { x: 0, z: 0 }); return { physics, car, tick() { car.prePhysics(); physics.update(); car.postPhysics(); } }; }
test('T-E09-03 @E09-AC03 sedan acceleration, full-lock radius and slalom stability', async () => {
  const s = await car();
  try {
    for (let i = 0; i < 60; i++) s.tick();
    s.car.intent.throttle = 1; s.car.intent.brake = false;
    for (let i = 0; i < 240; i++) s.tick();
    expect(s.car.speed).toBeGreaterThanOrEqual(14.4);
    // Hold approximately 10 m/s through a real full-lock physics turn.
    s.car.intent.steer = 1;
    let distance = 0, angle = 0, speed = 0;
    for (let i = 0; i < 480; i++) {
      s.car.intent.throttle = Math.max(0, Math.min(1, .3 + (10 - s.car.speed) * .3));
      const yaw = s.car.transform.yaw; s.tick();
      if (i < 180) continue;
      distance += Math.hypot(s.car.transform.x - s.car.previous.x, s.car.transform.z - s.car.previous.z);
      angle += Math.abs(Math.atan2(Math.sin(s.car.transform.yaw - yaw), Math.cos(s.car.transform.yaw - yaw))); speed += s.car.speed;
    }
    console.log({ accelerationSpeed: s.car.speed, radius: distance / angle, turnSpeed: speed / 300 });
    expect(speed / 300).toBeGreaterThan(9); expect(speed / 300).toBeLessThan(11);
    expect(distance / angle).toBeGreaterThanOrEqual(8); expect(distance / angle).toBeLessThanOrEqual(14);
    let maxRoll = 0;
    for (let i = 0; i < 1800; i++) { s.car.intent.throttle = 1; s.car.intent.steer = Math.sin(i / 45); s.tick(); maxRoll = Math.max(maxRoll, Math.abs(s.car.roll)); }
    expect(maxRoll).toBeLessThan(Math.PI / 3);
  } finally { s.physics.dispose(); }
});
test('T-E09-11 @E09-AC11 30 second scripted Rapier drive is deterministic across three worlds', async () => {
  const runs = [];
  for (let run = 0; run < 3; run++) { const s = await car(); try { for (let i = 0; i < 1800; i++) { Object.assign(s.car.intent, { throttle: i % 600 > 500 ? 0 : 1, brake: i % 600 > 500, steer: Math.sin(i / 90) * .6 }); s.tick(); } runs.push({ ...s.car.transform }); } finally { s.physics.dispose(); } }
  for (const actual of runs.slice(1)) for (const key of ['x', 'y', 'z', 'yaw'] as const) expect(Math.abs(actual[key] - runs[0][key])).toBeLessThanOrEqual(1e-4);
});
