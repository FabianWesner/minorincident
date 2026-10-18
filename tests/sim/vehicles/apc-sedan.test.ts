import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Physics } from '../../../src/physics/Physics';
import { vehicleDef } from '../../../src/data/vehicles';
import { VehicleBody } from '../../../src/sim/vehicles/VehicleBody';

const tiltDegrees = (car: VehicleBody) => { const q = car.body.rotation(); return Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (q.x * q.x + q.z * q.z)))) * 180 / Math.PI; };
const rollDegrees = (car: VehicleBody) => { const q = car.body.rotation(); return Math.abs(Math.atan2(2 * (q.w * q.x - q.y * q.z), 1 - 2 * (q.x * q.x + q.z * q.z))) * 180 / Math.PI; };

// A real dynamic parked sedan, brakes applied, on the same flat road as the APC.
// Start just before contact so the requested speed is the impact speed, not an acceleration target.
const cases = [Math.PI, Math.PI / 4, Math.PI / 2].flatMap((yaw, i) => [10, 20, 30].map(kmh => ({ yaw, kind: ['head-on', 'oblique', 'side'][i], kmh })));
test('T-E09-apc-sedan @E09 @E31 normal rams preserve upright vehicles and push dynamic sedans', async () => {
  const rows = [];
  for (const { yaw, kind, kmh } of cases) {
    const physics = new Physics(); await physics.init();
    physics.load({ name: 'apc-sedan', ground: { width: 200, depth: 200 }, player: { x: -80, y: .7, z: -80 } });
    const apcDef = vehicleDef('vehicle.military-apc'), sedanDef = vehicleDef('vehicle.sedan');
    const gap = apcDef.length / 2 + Math.abs(Math.cos(yaw)) * sedanDef.length / 2 + Math.abs(Math.sin(yaw)) * sedanDef.width / 2 + .1;
    const apc = new VehicleBody(apcDef, physics.world!, { x: -gap, z: 0 });
    const sedan = new VehicleBody(sedanDef, physics.world!, { x: 0, z: 0 }, yaw);
    const tick = () => { apc.prePhysics(); sedan.prePhysics(); physics.update(); apc.postPhysics(); sedan.postPhysics(); };
    try {
      for (let i = 0; i < 120; i++) tick();
      apc.intent.brake = false;
      apc.body.setLinvel({ x: kmh / 3.6, y: 0, z: 0 }, true);
      let apcTilt = 0, sedanTilt = 0, sedanRoll = 0, contacts = 0, wheelOnVehicle = 0, sedanYaw = 0;
      for (let i = 0; i < 240; i++) {
        tick();
        apcTilt = Math.max(apcTilt, tiltDegrees(apc)); sedanTilt = Math.max(sedanTilt, tiltDegrees(sedan)); sedanRoll = Math.max(sedanRoll, rollDegrees(sedan));
        sedanYaw = Math.max(sedanYaw, Math.abs(Math.atan2(Math.sin(sedan.transform.yaw - yaw), Math.cos(sedan.transform.yaw - yaw))) * 180 / Math.PI);
        physics.world!.contactPair(apc.collider, sedan.collider, m => { contacts += m.numContacts(); });
        for (const [a, b] of [[apc, sedan], [sedan, apc]]) for (let w = 0; w < 4; w++) if (a.controller.wheelGroundObject(w)?.handle === b.collider.handle) wheelOnVehicle++;
      }
      rows.push({ kind, kmh, apcTilt, sedanTilt, sedanRoll, sedanYaw, contacts, wheelOnVehicle, sedanTravel: Math.hypot(sedan.transform.x, sedan.transform.z) });
    } finally { physics.dispose(); }
  }
  mkdirSync('test-results/apc-sedan', { recursive: true });
  writeFileSync('test-results/apc-sedan/rams.json', JSON.stringify(rows, null, 2));
  console.table(rows);
  for (const row of rows) {
    expect(row.contacts, `${row.kind} ${row.kmh}: chassis contact remains enabled`).toBeGreaterThan(0);
    expect(row.sedanTravel, `${row.kind} ${row.kmh}: sedan is pushed`).toBeGreaterThan(.2);
    expect(row.apcTilt, `${row.kind} ${row.kmh}: APC tilt`).toBeLessThan(5);
    expect(row.sedanTilt, `${row.kind} ${row.kmh}: sedan tilt`).toBeLessThan(45);
    expect(row.sedanRoll, `${row.kind} ${row.kmh}: sedan roll`).toBeLessThan(45);
    expect(row.wheelOnVehicle, `${row.kind} ${row.kmh}: vehicles are not road support`).toBe(0);
  }
});

// Reproduce the imported Scene Lab contact through the production contact/damage registry.
test('T-E31-apc-sedan-contact @E31 @E09 driven APC stays level while ramming a parked sedan', async () => {
  const { SimWorld } = await import('../../../src/sim/world/SimWorld');
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena', 7);
  try {
    const v = world.vehicles!;
    const id = v.spawn('vehicle.military-apc', { x: -10, z: 0 });
    const parked = v.spawn('vehicle.sedan', { x: 0, z: 0 }, Math.PI / 2);
    const apc = v.cars.get(id)!, sedan = v.cars.get(parked)!;
    apc.entity.vehicle!.floor = true;
    v.autopilot.set(id, drive => { drive.throttle = .7; drive.brake = false; });
    let maxTilt = 0, maxSedanTilt = 0;
    for (let i = 0; i < 180; i++) {
      world.update();
      maxTilt = Math.max(maxTilt, tiltDegrees(apc.physics)); maxSedanTilt = Math.max(maxSedanTilt, tiltDegrees(sedan.physics));
    }
    mkdirSync('test-results/apc-sedan', { recursive: true });
    writeFileSync('test-results/apc-sedan/production-contact.json', JSON.stringify({ maxTilt, maxSedanTilt, health: apc.entity.health.current, sedanTravel: Math.hypot(sedan.entity.transform.x, sedan.entity.transform.z) }, null, 2));
    expect(apc.entity.health.current).toBeLessThan(1000);
    expect(Math.hypot(sedan.entity.transform.x, sedan.entity.transform.z)).toBeGreaterThan(.5);
    expect(maxTilt).toBeLessThan(5); expect(maxSedanTilt).toBeLessThan(45);
  } finally { world.dispose(); }
});
