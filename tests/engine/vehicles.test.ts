// Vehicle core: one Rapier vehicle body and one enter/drive/exit flow serve the bike, cars, bus, APC and tank in five levels.
import { expect, test } from 'vitest';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { vehicleDef, vehicles } from '../../src/data/vehicles';
import { emptyInput } from '../../src/input/InputFrame';
import { Physics } from '../../src/physics/Physics';
import { VehicleBody } from '../../src/sim/vehicles/VehicleBody';
import { SimWorld } from '../../src/sim/world/SimWorld';

async function car(id = 'vehicle.sedan') {
  const physics = new Physics(); await physics.init();
  physics.load({ name: 'vehicle-test', ground: { width: 1000, depth: 1000 }, player: { x: -400, y: .7, z: -400 } });
  const body = new VehicleBody(vehicleDef(id), physics.world!, { x: 0, z: 0 });
  return { physics, car: body, tick: () => { body.prePhysics(); physics.update(); body.postPhysics(); } };
}

test('handling: deterministic scripted drives, speed-dependent steering for every vehicle, braking before reverse, flip recovery', async () => {
  const runs = [];
  for (let run = 0; run < 2; run++) {
    const s = await car();
    try {
      for (let i = 0; i < 900; i++) { Object.assign(s.car.intent, { throttle: i % 600 > 500 ? 0 : 1, brake: i % 600 > 500, steer: Math.sin(i / 90) * .6 }); s.tick(); }
      expect(s.car.speed).toBeGreaterThan(5);
      runs.push({ ...s.car.transform });
    } finally { s.physics.dispose(); }
  }
  for (const key of ['x', 'y', 'z', 'yaw'] as const) expect(Math.abs(runs[1][key] - runs[0][key])).toBeLessThanOrEqual(1e-4);

  for (const { id } of vehicles) {
    const s = await car(id);
    try {
      for (let i = 0; i < 60; i++) s.tick();
      s.car.intent.steer = 1;
      for (let i = 0; i < 90; i++) { s.car.speed = 1; s.car.prePhysics(); }
      const slow = s.car.steeringAngle;
      for (let i = 0; i < 90; i++) { s.car.speed = s.car.def.topSpeed; s.car.prePhysics(); }
      expect(s.car.steeringAngle, id).toBeLessThan(slow * .7);
    } finally { s.physics.dispose(); }
  }

  const r = await car();
  try {
    for (let i = 0; i < 60; i++) r.tick();
    Object.assign(r.car.intent, { throttle: 1, brake: false });
    for (let i = 0; i < 180; i++) r.tick();
    r.car.intent.throttle = -1; r.tick();
    expect(r.car.braking).toBe(true); expect(r.car.forwardSpeed).toBeGreaterThan(0);
    for (let i = 0; i < 240; i++) r.tick();
    expect(r.car.forwardSpeed).toBeLessThan(-4); expect(r.car.speed).toBeLessThanOrEqual(r.car.def.handling.reverseSpeed + .1);
  } finally { r.physics.dispose(); }

  const f = await car('vehicle.school-bus');
  try {
    for (let i = 0; i < 60; i++) f.tick();
    f.car.body.setRotation({ x: 1, y: 0, z: 0, w: 0 }, true); f.car.body.setTranslation({ x: 0, y: .4, z: 0 }, true);
    for (let i = 0; i < 179; i++) { f.tick(); expect(f.car.recoverFlip()).toBe(false); }
    f.tick(); expect(f.car.recoverFlip()).toBe(true);
    for (let i = 0; i < 600; i++) { f.tick(); f.car.recoverFlip(); }
    expect(f.car.upsideDown).toBe(false); expect(f.car.wheels.filter(w => w.contact)).toHaveLength(4);
  } finally { f.physics.dispose(); }
});

test('enter, drive and exit: door dwell, input ownership (no attacks while driving), capsule-safe exit on the free side', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('drive-course');
  try {
    for (let i = 0; i < 35; i++) world.update();
    expect(world.vehicles!.active).toBeNull();
    world.update(); expect(world.vehicles!.active).toBe(2); expect(world.getEntity(1)!.hidden).toBe(true);
    expect(world.physics.playerCollider!.isEnabled()).toBe(false);
    const frame = emptyInput(); frame.move.x = 1; frame.drive = { throttle: 1, steer: 0 }; frame.left.down = frame.left.held = true;
    world.applyInput(frame, 'keyboard'); for (let i = 0; i < 240; i++) world.update();
    const vehicle = world.vehicles!.cars.get(2)!;
    expect(vehicle.physics.speed).toBeGreaterThan(14.4); expect(world.entities.get(1)!.transform.x).toBe(vehicle.entity.transform.x);
    expect(world.events.events().some(e => e.type === 'combat.attack')).toBe(false);
    const p = vehicle.entity.transform;
    world.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(1.6, 1, .3).setTranslation(p.x, 1, p.z + 1.45));
    world.physics.world!.step();
    expect(world.vehicles!.exit()).toBe(true);
    const exit = world.getEntity(1)!;
    expect(exit.hidden).toBe(false); expect(exit.transform.z).toBeLessThan(p.z);
    expect(world.physics.world!.intersectionWithShape(exit.transform, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(.35, .35), undefined, undefined, world.physics.playerCollider!)).toBeNull();
    world.loadScenario('empty'); expect(world.physics.bodyCount).toBe(2);
  } finally { world.dispose(); }
});
