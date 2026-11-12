// Native Rapier ram contacts; setup poses are fixed before sampling.
import assert from 'node:assert/strict';
import { Physics } from '../../src/physics/Physics';
import { vehicleDef } from '../../src/data/vehicles';
import { VehicleBody } from '../../src/sim/vehicles/VehicleBody';

const penetration = (a: VehicleBody, b: VehicleBody): number => {
  const axes = [a.transform.yaw, a.transform.yaw + Math.PI / 2, b.transform.yaw, b.transform.yaw + Math.PI / 2];
  let depth = Infinity;
  for (const angle of axes) {
    const nx = Math.cos(angle), nz = -Math.sin(angle);
    const radius = (v: VehicleBody) => Math.abs(nx * Math.cos(v.transform.yaw) + nz * -Math.sin(v.transform.yaw)) * v.def.length / 2 + Math.abs(nx * Math.sin(v.transform.yaw) + nz * Math.cos(v.transform.yaw)) * v.def.width / 2;
    depth = Math.min(depth, radius(a) + radius(b) - Math.abs((a.transform.x - b.transform.x) * nx + (a.transform.z - b.transform.z) * nz));
  }
  return Math.max(0, depth);
};

for (const mode of ['head-on', 'side', 'rear', 'rail-stall'] as const) {
  const physics = new Physics(); await physics.init();
  physics.load({ name: 'L9-bus-contact', ground: { width: 200, depth: 200 }, player: { x: -80, y: .7, z: -80 } });
  try {
    const apc = new VehicleBody(vehicleDef('vehicle.military-apc'), physics.world!, { x: 0, z: 0 });
    const yaw = mode === 'head-on' ? Math.PI : mode === 'side' ? Math.PI / 2 : 0;
    const bus = new VehicleBody(vehicleDef('vehicle.school-bus'), physics.world!, { x: mode === 'head-on' ? 12 : mode === 'side' ? 0 : -12, z: mode === 'side' ? 12 : 0 }, yaw);
    apc.enableTransportShell(); bus.enableTransportShell();
    for (let i = 0; i < 60; i++) { apc.prePhysics(); bus.prePhysics(); physics.update(); apc.postPhysics(); bus.postPhysics(); }
    bus.body.setLinvel({ x: Math.cos(yaw) * 8, y: 0, z: -Math.sin(yaw) * 8 }, true);
    bus.intent.throttle = 1; bus.intent.brake = false;
    if (mode === 'rail-stall') physics.addBlocker({ x: 3.1, y: 1, z: 0, halfX: .2, halfY: 1, halfZ: 5 });
    let max = 0, contactTicks = 0;
    for (let tick = 0; tick < 360; tick++) {
      apc.prePhysics(); bus.prePhysics(); physics.update(); apc.postPhysics(); bus.postPhysics();
      let contact = false;
      for (let i = 0; i < bus.body.numColliders(); i++) for (let j = 0; j < apc.body.numColliders(); j++) physics.world!.contactPair(bus.body.collider(i), apc.body.collider(j), manifold => { if (manifold.numContacts() > 0) contact = true; });
      if (contact) contactTicks++;
      max = Math.max(max, penetration(apc, bus));
      assert.ok(max <= .2, `${mode}: overlap ${max} at tick ${tick}`);
    }
    assert.ok(contactTicks > 0, `${mode}: must physically reach APC`);
    console.log(JSON.stringify({ mode, maxHullOverlapM: max, contactTicks, finalBusSpeed: bus.speed }));
  } finally { physics.dispose(); }
}
