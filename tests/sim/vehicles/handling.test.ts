import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Physics } from '../../../src/physics/Physics';
import { vehicleDef, vehicles } from '../../../src/data/vehicles';
import { VehicleBody } from '../../../src/sim/vehicles/VehicleBody';
async function car(id = 'vehicle.sedan') { const physics = new Physics(); await physics.init(); physics.load({ name: 'vehicle-test', ground: { width: 1000, depth: 1000 }, player: { x: -400, y: .7, z: -400 } }); const car = new VehicleBody(vehicleDef(id), physics.world!, { x: 0, z: 0 }); return { physics, car, tick() { car.prePhysics(); physics.update(); car.postPhysics(); } }; }
test('T-E09-03 @E09-AC03 sedan acceleration, full-lock radius and slalom stability', async () => {
  const s = await car();
  try {
    for (let i = 0; i < 60; i++) s.tick();
    s.car.intent.throttle = 1; s.car.intent.brake = false;
    for (let i = 0; i < 240; i++) s.tick();
    const accelerationSpeed = s.car.speed; expect(accelerationSpeed).toBeGreaterThanOrEqual(14.4);
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
    expect(speed / 300).toBeGreaterThan(9); expect(speed / 300).toBeLessThan(11);
    expect(distance / angle).toBeGreaterThanOrEqual(8); expect(distance / angle).toBeLessThanOrEqual(14);
    let maxRoll = 0;
    for (let i = 0; i < 1800; i++) { s.car.intent.throttle = 1; s.car.intent.steer = Math.sin(i / 45); s.tick(); maxRoll = Math.max(maxRoll, Math.abs(s.car.roll)); }
    expect(maxRoll).toBeLessThan(Math.PI / 3); mkdirSync('test-results/epics/E09', { recursive: true }); writeFileSync('test-results/epics/E09/handling-metrics.json', JSON.stringify({ accelerationSpeed, radius: distance / angle, turnSpeed: speed / 300, maxRollDegrees: maxRoll * 180 / Math.PI }, null, 2));
  } finally { s.physics.dispose(); }
});
test.each(vehicles.map(v => v.id))('T-E09-steering @E09 %s has more steering lock crawling than at top speed', async id => {
  const s = await car(id);
  try {
    for (let i = 0; i < 60; i++) s.tick();
    s.car.intent.steer = 1;
    // Hold the measured speed while letting the fixed-step steering response settle.
    for (let i = 0; i < 90; i++) { s.car.speed = 1; s.car.prePhysics(); }
    const slow = s.car.steeringAngle;
    for (let i = 0; i < 90; i++) { s.car.speed = s.car.def.topSpeed; s.car.prePhysics(); }
    expect(s.car.steeringAngle).toBeLessThan(slow * .7);
    expect(s.car.steeringAngle).toBeCloseTo(s.car.def.handling.highSpeedSteering, 5);
    s.car.intent.steer = -1; s.car.prePhysics();
    expect(s.car.steeringAngle).toBeGreaterThan(0); // no instantaneous full-lock snap
  } finally { s.physics.dispose(); }
});
test('T-E09-reverse @E09 opposite throttle brakes before engaging a bounded reverse gear', async () => {
  const s = await car();
  try {
    for (let i = 0; i < 60; i++) s.tick();
    Object.assign(s.car.intent, { throttle: 1, brake: false });
    for (let i = 0; i < 180; i++) s.tick();
    s.car.intent.throttle = -1; s.tick();
    expect(s.car.braking).toBe(true); expect(s.car.forwardSpeed).toBeGreaterThan(0);
    for (let i = 0; i < 240; i++) s.tick();
    expect(s.car.forwardSpeed).toBeLessThan(-4);
    expect(s.car.speed).toBeLessThanOrEqual(s.car.def.handling.reverseSpeed + .1);
    expect(s.car.braking).toBe(false);
  } finally { s.physics.dispose(); }
});
test('T-E09-drift @E09 rear handbrake produces slip and release restores road grip', async () => {
  const slips: number[] = [];
  for (const handbrake of [false, true]) {
    const s = await car();
    try {
      for (let i = 0; i < 60; i++) s.tick();
      Object.assign(s.car.intent, { throttle: 1, brake: false });
      for (let i = 0; i < 180; i++) s.tick();
      Object.assign(s.car.intent, { steer: 1, handbrake });
      let slip = 0;
      for (let i = 0; i < 60; i++) { s.tick(); const v = s.car.body.linvel(), yaw = s.car.transform.yaw; slip += Math.abs(v.x * Math.sin(yaw) + v.z * Math.cos(yaw)); }
      slips.push(slip);
      if (handbrake) {
        expect(s.car.controller.wheelFrictionSlip(2)).toBeCloseTo(s.car.def.handling.driftGrip, 5);
        expect(s.car.controller.wheelFrictionSlip(0)).toBeCloseTo(s.car.def.handling.grip, 5);
        s.car.intent.handbrake = false; s.tick();
        expect(s.car.controller.wheelFrictionSlip(2)).toBeCloseTo(s.car.def.handling.grip, 5);
      }
    } finally { s.physics.dispose(); }
  }
  expect(slips[1]).toBeGreaterThan(slips[0] * 1.5);
});
test.each(['vehicle.sedan', 'vehicle.school-bus'])('T-E09-flip @E09 %s waits three sim seconds then physically rights itself', async id => {
  const s = await car(id);
  try {
    for (let i = 0; i < 60; i++) s.tick();
    s.car.body.setRotation({ x: 1, y: 0, z: 0, w: 0 }, true);
    s.car.body.setTranslation({ x: 0, y: .4, z: 0 }, true);
    for (let i = 0; i < 179; i++) { s.tick(); expect(s.car.recoverFlip()).toBe(false); }
    s.tick(); expect(s.car.upsideDown).toBe(true); expect(s.car.recoverFlip()).toBe(true);
    expect(s.car.body.linvel().y).toBeGreaterThan(2);
    for (let i = 0; i < 600; i++) { s.tick(); s.car.recoverFlip(); }
    expect(s.car.upsideDown).toBe(false);
    expect(s.car.wheels.filter(w => w.contact)).toHaveLength(4);
    expect(Math.abs(s.car.roll)).toBeLessThan(.1);
  } finally { s.physics.dispose(); }
});
test('T-E09-11 @E09-AC11 30 second scripted Rapier drive is deterministic across three worlds', async () => {
  const runs = [];
  for (let run = 0; run < 3; run++) { const s = await car(); try { for (let i = 0; i < 1800; i++) { Object.assign(s.car.intent, { throttle: i % 600 > 500 ? 0 : 1, brake: i % 600 > 500, steer: Math.sin(i / 90) * .6 }); s.tick(); } runs.push({ ...s.car.transform }); } finally { s.physics.dispose(); } }
  for (const actual of runs.slice(1)) for (const key of ['x', 'y', 'z', 'yaw'] as const) expect(Math.abs(actual[key] - runs[0][key])).toBeLessThanOrEqual(1e-4);
});
