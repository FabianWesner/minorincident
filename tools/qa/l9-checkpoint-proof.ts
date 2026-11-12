import assert from 'node:assert/strict';
import { loadLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { decodeSave } from '../../src/sim/progression/Save';
import { readFixture } from './fixture-io';

async function l9BayAndHatch(): Promise<void> {
  const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
  try {
    const l9 = world.missions!.l9!, vehicles = world.vehicles!, car = vehicles.cars.get(l9.state.carId)!, s = l9.driving.state;
    world.missions!.begin();
    for (let i = 0; i < 5; i++) world.update();
    const wall = world.interactables!.walls.find(w => w.entityId === s.bridgeGateId);
    assert.ok((wall?.halfZ ?? 0) >= 34, 'bridge-gate wall reaches +-34 m');
    const pose = { x: 452, z: 30, y: car.physics.def.suspension + car.physics.def.wheelRadius + .15, yaw: 0 };
    Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose); car.physics.body.setTranslation(pose, true);
    car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < 90; i++) world.update();
    assert.ok(!(s.evacuationAt === null), 'evacuation starts from the bay corner, not only the 11 m radius');
    // Hatch pacing: while stalled the vehicle carries the boarding spacing; the climb-aboard clock follows each boarder.
    s.stallAt = world.tick; s.restarted = false; world.update();
    assert.ok((car.entity.vehicle!.boardSpacing ?? 0) >= 150, 'stalled hatch: boarders are spaced');
    s.restarted = true; world.update();
    assert.ok(car.entity.vehicle!.boardSpacing === 0, 'after the restart the spacing is gone');
  } finally { world.dispose(); }
}

// r30-l9bridge (r28-vqa P2): the L9 `bridge` checkpoint restarted the APC beside the chasing school bus. After restoring each L9
// checkpoint fixture (resume) and after a death at the bridge (retry), nothing solid lies within 8 m ahead of the APC on its route
// (east to the bridge deck), and the bus is not within 30 m of the bridge restart.
async function l9CheckpointLanes(): Promise<void> {
  for (const name of ['l9-at-bridge.json.br', 'l9-before-rail-stall.json.gz']) {
    const decoded = decodeSave(JSON.stringify(readFixture(`tests/fixtures/saves/qa/${name}`).campaign));
    if (decoded.status !== 'ok') throw new Error(`${name} does not decode`);
    const world = await loadLevel('L9', 1, decoded.save, 0, { quality: 'low' });
    try {
      const l9 = world.missions!.l9!, s = l9.driving.state;
      const bridge = name.startsWith('l9-at-bridge');
      assert.ok(l9.driving.laneClear(8, bridge ? 0 : undefined, bridge) === true, `${name}: 8 m of clear route ahead of the restored APC`);
      if (!bridge) continue;
      assert.ok(s.evacuationDone === true);
      assert.ok(world.vehicles!.cars.get(l9.state.carId)!.entity.vehicle!.impactStallUntil ?? 0 <= world.tick, 'saved absolute ticks are rebased: no impact stall left after Continue');
      assert.ok(l9.driving.laneClear(8) === true, 'bridge resume: clear along the APC heading too');
      // A restore rebuilds the vehicle bodies, so look the cars up each time.
      const gap = () => { const bus = world.vehicles!.cars.get(s.busId)!, apc = world.vehicles!.cars.get(l9.state.carId)!; return Math.hypot(bus.entity.transform.x - apc.entity.transform.x, bus.entity.transform.z - apc.entity.transform.z); };
      assert.ok(gap() >= 30, 'bridge resume: the bus starts well behind the APC');
      let respawned = false; world.events.on('player.respawned', () => { respawned = true; });
      for (let i = 0; i < 400; i++) world.update();
      world.player!.damage(1000, world.tick, true);
      for (let i = 0; i < 900 && !respawned; i++) world.update();
      assert.equal(respawned, true, 'the courier respawns at the bridge checkpoint');
      for (let i = 0; i < 5; i++) world.update();
      assert.ok(l9.driving.laneClear(8) === true, 'bridge retry: clear lane ahead');
      assert.ok(gap() >= 30, 'bridge retry: the bus starts well behind the APC');
      assert.ok(world.vehicles!.active === l9.state.carId, 'bridge retry: the courier is still driving the APC');
    } finally { world.dispose(); }
  }
}


await l9BayAndHatch();
await l9CheckpointLanes();
console.log('L9 checkpoint and bay proof passed');
