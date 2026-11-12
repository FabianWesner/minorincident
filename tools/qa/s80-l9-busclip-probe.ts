// s80-l9busclip: native Rapier overlap probe for the authored L9 bus ram.
import assert from 'node:assert/strict';
import { emptyInput } from '../../src/input/InputFrame';
import { preset } from '../../src/sim/progression/Campaign';
import { loadLevel } from '../sim-runner/levels';
import type { VehicleBody } from '../../src/sim/vehicles/VehicleBody';

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
  const world = await loadLevel('L9', 31, preset('L9-default'), 0, { quality: 'low' });
  try {
    const driving = world.missions!.l9!.driving, state = driving.state, vehicles = world.vehicles!;
    const apc = vehicles.cars.get(world.missions!.l9!.state.carId)!, bus = vehicles.cars.get(state.busId)!;
    const pose = (v: typeof apc, x: number, z: number, yaw: number) => {
      const p = { x, z, y: v.physics.def.suspension + v.physics.def.wheelRadius + .15, yaw };
      Object.assign(v.entity.transform, p); Object.assign(v.physics.previous, p); v.physics.body.setTranslation(p, true);
      v.physics.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
      v.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); v.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      v.physics.body.setEnabled(true); v.entity.hidden = false; v.entity.vehicle!.braced = false;
    };
    const yaw = mode === 'side' ? Math.PI / 2 : 0;
    pose(apc, 400, 0, 0);
    pose(bus, mode === 'head-on' ? 390 : mode === 'rear' ? 410 : 400, mode === 'side' ? -12 : mode === 'rail-stall' ? -12 : 0, yaw);
    state.busLineAt = world.tick; state.busRamAt = world.tick + 90; state.busRamZ = 0; state.busHitAt = world.tick; state.busRams = 0;
    state.evacuationAt = mode === 'rail-stall' ? world.tick : null;
    state.busStoppedAt = null; state.busStunUntil = undefined;
    vehicles.active = world.missions!.l9!.state.carId;
    vehicles.autopilot.set(bus.entity.id, intent => { intent.throttle = 1; intent.brake = false; intent.steer = 0; });
    if (mode === 'rail-stall') { vehicles.damage(apc.entity.id, apc.entity.health.current); apc.physics.intent.brake = true; apc.physics.intent.throttle = 0; }
    bus.physics.body.setLinvel(mode === 'side' ? { x: 0, y: 0, z: 8 } : { x: 8, y: 0, z: 0 }, true);
    let max = 0;
    for (let tick = 0; tick < 360; tick++) {
      const frame = emptyInput(); frame.drive = { throttle: mode === 'rail-stall' ? 0 : 1, steer: 0 }; frame.brake = mode === 'rail-stall';
      world.applyInput(frame, 'keyboard'); world.update();
      max = Math.max(max, penetration(apc.physics, bus.physics));
      assert.ok(max <= .2, `${mode} hull overlap ${max.toFixed(3)} m at tick ${world.tick}`);
    }
    assert.ok(bus.physics.speed < 14, `${mode} bus responds to contact/ram outcome`);
    console.log(JSON.stringify({ mode, maxHullOverlapM: +max.toFixed(3), apcSpeed: +apc.physics.speed.toFixed(2), busSpeed: +bus.physics.speed.toFixed(2), busHealth: bus.entity.health.current }));
  } finally { world.dispose(); }
}
