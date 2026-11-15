/** Native Rapier chassis stress fixtures; no pose writes after initial setup. */
import * as RAPIER from '@dimforge/rapier3d-compat';
import { VehicleBody } from '../../src/sim/vehicles/VehicleBody';
import { vehicleDef } from '../../src/data/vehicles';
import { writeFileSync, mkdirSync } from 'node:fs';
await RAPIER.init();
const rows = [];
for (const stabilized of [false, true]) for (const fixture of ['kerb', 'ramp', 'bus-side', 'bus-rear']) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(1500, .1, 1500).setTranslation(0, -.1, 0));
  const car = new VehicleBody(vehicleDef('vehicle.military-apc'), world, { x: 0, z: 0 });
  let obstacle: RAPIER.Collider;
  let bus: VehicleBody | undefined;
  if (fixture.startsWith('bus')) {
    bus = new VehicleBody(vehicleDef('vehicle.school-bus'), world, { x: fixture === 'bus-rear' ? -12 : 0, z: fixture === 'bus-side' ? -9 : 0 }, fixture === 'bus-side' ? -Math.PI / 2 : 0);
    bus.body.setLinvel(fixture === 'bus-side' ? { x: 0, y: 0, z: 30 } : { x: 30, y: 0, z: 0 }, true);
    obstacle = bus.collider;
  } else {
    const desc = RAPIER.ColliderDesc.cuboid(fixture === 'ramp' ? 3 : .2, fixture === 'ramp' ? .3 : .25, 1.2).setTranslation(12, .25, 1.2);
    if (fixture === 'ramp') desc.setRotation({ x: 0, y: 0, z: Math.sin(.12), w: Math.cos(.12) });
    obstacle = world.createCollider(desc);
    car.body.setLinvel({ x: 18, y: 0, z: 0 }, true);
  }
  let contacts = 0, maxRoll = 0, maxPitch = 0;
  const trace: { tick: number; roll: number; pitch: number; angularSpeed: number; suspension: number[] }[] = [];
  for (let tick = 0; tick < 600; tick++) {
    car.intent.throttle = fixture.startsWith('bus') ? 0 : 1; car.intent.brake = false;
    car.prePhysics(); if (bus) bus.prePhysics(); world.step(); car.postPhysics();
    const q = car.rotation;
    const roll = Math.atan2(2 * (q.w*q.x-q.y*q.z), 1-2*(q.x*q.x+q.z*q.z));
    const pitch = Math.asin(Math.max(-1,Math.min(1,2*(q.w*q.z+q.x*q.y))));
    for (let wheel = 0; wheel < 4; wheel++) if (car.controller.wheelGroundObject(wheel)?.handle === obstacle.handle) contacts++;
    maxRoll = Math.max(maxRoll, Math.abs(roll)); maxPitch = Math.max(maxPitch, Math.abs(pitch));
    world.contactPair(car.collider, obstacle, manifold => { if (manifold.numContacts()) contacts++; });
    if (tick % 10 === 0) {
      const omega = car.body.angvel(), round = (n: number) => +n.toFixed(5);
      trace.push({ tick, roll:round(roll), pitch:round(pitch), angularSpeed:round(Math.hypot(omega.x,omega.y,omega.z)), suspension:car.wheels.map(w=>round(w.suspension)) });
    }
    if (stabilized) car.stabilizeTilt(Math.PI/9);
  }
  rows.push({ stabilized, fixture, contacts, trace, maxRollDegrees:maxRoll*180/Math.PI, maxPitchDegrees:maxPitch*180/Math.PI });
  world.free();
}
mkdirSync('test-results/s123-apctip', { recursive:true });
writeFileSync('test-results/s123-apctip/contacts.json', JSON.stringify({rows},null,2));
console.log(JSON.stringify(rows,null,2));
if(rows.some(r=>r.stabilized && (!r.contacts || Math.max(r.maxRollDegrees,r.maxPitchDegrees)>=20))) process.exitCode=1;
