// Vehicle core: one Rapier vehicle body and one enter/drive/exit flow serve the bike, cars, bus, APC and tank in five levels.
import { expect, test } from 'vitest';
import { playHaleCharge } from '../helpers/l8Finale';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { vehicleDef, vehicles } from '../../src/data/vehicles';
import { emptyInput } from '../../src/input/InputFrame';
import { Physics } from '../../src/physics/Physics';
import { VehicleBody } from '../../src/sim/vehicles/VehicleBody';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { loadLevel } from '../../tools/sim-runner/levels';
import { missionControls } from '../../src/sim/missions/controls';
import { preset } from '../../src/sim/progression/Campaign';
import { objectiveText } from '../../src/sim/missions/objectiveText';
import type { PropSnapshot } from '../../src/sim/interact/PropSystem';
import { decodeSave } from '../../src/sim/progression/Save';
import { readFixture } from '../../tools/qa/fixture-io';
import { l9Course } from '../../src/data/l9';

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
    for (let i = 0; i < 179; i++) { f.car.body.setLinvel({ x: 5, y: 0, z: 0 }, true); f.tick(); expect(f.car.recoverFlip()).toBe(false); }
    f.tick(); expect(f.car.recoverFlip()).toBe(true);
    for (let i = 0; i < 600; i++) { f.tick(); f.car.recoverFlip(); }
    expect(f.car.upsideDown).toBe(false); expect(f.car.wheels.filter(w => w.contact)).toHaveLength(4);
  } finally { f.physics.dispose(); }
});

test('enter, drive and exit: door dwell, input ownership (no attacks while driving), capsule-safe exit on the free side; bike stand-to-mount needs an approach', async () => {
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
    Object.assign(world.entities.get(1)!.survivor!, { scriptedClip: 'crawl', knockdown: { started: 0, until: 120 }, attack: { started: 0, endsAt: 120 } });
    expect(world.vehicles!.exit()).toBe(true);
    const exit = world.getEntity(1)!;
    expect(exit.survivor!.scriptedClip, 'vehicle exit releases any scripted pose before on-foot movement').toBeUndefined();
    expect(exit.survivor!.knockdown).toBeUndefined(); expect(exit.survivor!.attack).toBeUndefined(); expect(exit.survivor!.animation).toBe('idle');
    expect(exit.hidden).toBe(false); expect(exit.transform.z).toBeLessThan(p.z);
    expect(world.physics.world!.intersectionWithShape(exit.transform, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(.35, .35), undefined, undefined, world.physics.playerCollider!)).toBeNull();
    world.loadScenario('empty'); expect(world.physics.bodyCount).toBe(2);
  } finally { world.dispose(); }
  await screenRelativeSteering();
  const shoved = await vehicleShovesProps();
  expect(await vehicleShovesProps(), 'vehicle-to-prop simulation repeats exactly').toEqual(shoved);
  await bikeMountIntent();
  await zooParkedBoarding();
  await zooCheckpointHandoff();
  await apcBoarders();
  await l9BusVsParkedApc();
  await l9BusTelegraphAndWreck();
  await l9FloorApcThroughPile();
  await l9CompanionsBoardDiagonalApc();
  await l9CheckpointLanes();
  await l9BayAndHatch();
  await l9HatchCheckpointAndEvacuation();
}, 400_000);

// A pushed evacuee can leave the truck during the boarding animation.
// The arrival dwell must be abandoned so native navigation can retry instead
// of leaving the objective at 3/4 forever.
test('L9 interrupted boarding retries the final survivor at HIGH and LOW tiers', async () => {
  for (const [seed, quality] of [[1, 'low'], [42, 'high']] as const) {
    const world = await loadLevel('L9', seed, preset('L9-default'), 0, { quality });
    try {
      const l9 = world.missions!.l9!, car = world.vehicles!.cars.get(l9.state.carId)!; let s = l9.driving.state;
      expect(world.missions!.state.phase).toBe('playing');
      Object.assign(car.entity.transform, { x: l9Course.evacuation.x, z: 0 });
      car.physics.body.setTranslation(car.entity.transform, true); car.physics.previous.x = car.entity.transform.x;
      world.update();
      s = l9.driving.state;
      expect(s.evacuationAt, 'stopped APC starts the native evacuation and checkpoint').not.toBeNull();
      const evacuees = s.roster.filter(id => id !== s.samId);
      expect(evacuees).toHaveLength(4);
      const last = evacuees[3]!, slot = 3, target = { x: l9Course.evacuation.truckX + slot % 3 * 9 + 2.5, z: l9Course.evacuation.truckZ + 1 + Math.floor(slot / 3) * 1.1 };
      if (seed === 42) {
        world.player!.damage(1000, world.tick, true);
        for (let i = 0; i < 360 && world.entities.get(1)!.health.current <= 0; i++) world.update();
        for (let i = 0; i < 3; i++) world.update();
        s = l9.driving.state;
        expect(world.entities.get(1)!.health.current, 'evac-point checkpoint restores the courier').toBeGreaterThan(0);
        expect(s.evacuationAt, 'evacuation remains active after the checkpoint restore').not.toBeNull();
      }
      for (const [i, id] of evacuees.slice(0, 3).entries()) {
        const actor = world.entities.get(id)!; actor.hidden = true; actor.passengerOf = s.trucks[i % 3];
        world.vehicles!.cars.get(car.entity.id)!.entity.vehicle!.passengers = car.entity.vehicle!.passengers!.filter(p => p.id !== id);
        world.spatial.delete(id); s.evacuated.push(id);
      }
      const actor = world.entities.get(last)!;
      car.entity.vehicle!.passengers = car.entity.vehicle!.passengers!.filter(p => p.id !== last);
      actor.hidden = false; delete actor.passengerOf; actor.transform.x = target.x + 1.5; actor.transform.z = target.z;
      world.spatial.set(last, actor.transform.x, actor.transform.z); s.evacuating.push(last);
      s.evacuationAt = world.tick - l9Course.evacuation.defendTicks;
      s.truckEntering[last] = world.tick - 46;
      actor.civilian!.story = { clip: 'npc-sit-down', start: s.truckEntering[last] };
      for (let i = 0; i < 1200 && !s.evacuated.includes(last); i++) world.update();
      expect(s.evacuated, `seed ${seed} ${quality}: fourth survivor reaches a truck within 20 s`).toContain(last);
      expect(world.tick - (s.evacuationAt! + l9Course.evacuation.defendTicks)).toBeLessThanOrEqual(1200);
    } finally { world.dispose(); }
  }
}, 180_000);

// PO rail retry/end UAT: active vehicle ownership, hatch pose, and the evacuation's
// actionable objective must remain coherent through death, F toggles, impact and resume.
async function l9HatchCheckpointAndEvacuation(): Promise<void> {
  const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
  try {
    const l9 = world.missions!.l9!; let s = l9.driving.state, car = world.vehicles!.cars.get(l9.state.carId)!;
    world.missions!.begin();
    Object.assign(car.entity.transform, { x: l9Course.railX - 2, z: 0 });
    car.physics.body.setTranslation(car.entity.transform, true); car.physics.previous.x = car.entity.transform.x;
    world.update();
    expect(world.missions!.state.checkpoint, 'rail stall records the mid-crossing retry point').toBe('mid-crossing');
    expect(l9.driving.hatch, 'stall opens the hatch while the courier remains the driver').toBe(true);
    expect(world.entities.get(1)!.passengerOf, 'hatch pose retains APC ownership').toBe(car.entity.id);

    world.player!.damage(1000, world.tick, true);
    for (let i = 0; i < 360 && world.entities.get(1)!.survivor!.diedAt !== null; i++) world.update();
    for (let i = 0; i < 3; i++) world.update();
    expect(world.vehicles!.active, 'checkpoint retry restores driver seat').toBe(car.entity.id);
    car = world.vehicles!.cars.get(l9.state.carId)!; s = l9.driving.state;
    expect(l9.driving.hatch, 'checkpoint retry restores a visible hatch defense').toBe(true);
    expect(world.entities.get(1)!.passengerOf, 'restored courier is never on foot in the hatch').toBe(car.entity.id);

    const toggle = (interact: boolean) => world.applyInput({ ...emptyInput(), interact }, 'keyboard');
    for (const age of [0, 600, 1180]) {
      s.stallAt = world.tick - age; s.restarted = false; s.hatchOpen = true; s.hatchInteractHeld = false;
      toggle(true); world.update(); toggle(false); world.update();
      expect(l9.driving.hatch, `F closes the hatch at stall age ${age}`).toBe(false);
      expect(world.vehicles!.active, 'closed hatch still owns driving controls').toBe(car.entity.id);
      expect(world.entities.get(1)!.passengerOf, 'closed hatch keeps passenger/driver relation').toBe(car.entity.id);
      toggle(true); world.update(); toggle(false); world.update();
      expect(l9.driving.hatch, `F reopens the hatch at stall age ${age}`).toBe(true);
    }

    // Simulate a vehicle shove/knockback transform; the hatch controller owns
    // the courier's position again on the next pose pass.
    Object.assign(world.entities.get(1)!.transform, { x: car.entity.transform.x + 3, y: car.entity.transform.y + .1, z: car.entity.transform.z + 3 });
    l9.driving.poseHatch();
    expect(world.entities.get(1)!.transform.y).toBeCloseTo(car.entity.transform.y + 1.1, 4);
    expect(world.entities.get(1)!.passengerOf).toBe(car.entity.id);

    expect(s.hatchOpen, 'stall ends with hatch open').toBe(true);
    s.stallAt = world.tick - 1200; s.restarted = false;
    world.applyInput(emptyInput(), 'keyboard'); world.update();
    expect(s.restarted, 'the stall has an authored end').toBe(true);
    expect(l9.driving.text()).toContain('Engine restarted — drive!');
    const drive = emptyInput(); drive.drive = { throttle: 1, steer: 0 };
    world.applyInput(drive, 'keyboard');
    for (let i = 0; i < 300; i++) world.update();
    expect(car.physics.speed, 'APC accepts drive input after the stall').toBeGreaterThan(1);

    s.evacuationAt = world.tick; s.evacuationDone = false;
    expect(l9.driving.text()).toContain('Hatch defense 30 s');
    world.tick += 60;
    expect(l9.driving.text()).toContain('Hatch defense 29 s');
    s.evacuated.push(s.roster.find(id => id !== s.samId)!);
    expect(l9.driving.text()).toContain('1/');
    world.tick -= 60;
    s.evacuationAt -= l9Course.evacuation.defendTicks;
    expect(l9.driving.text()).toContain('Defense complete');
    s.evacuationDone = true;
    expect(l9.driving.text()).toBe('Drive onto the bridge');

    const courier = world.entities.get(1)!;
    Object.assign(courier.survivor!, { scriptedClip: 'crawl', animation: 'knockdown', attack: { started: 0, endsAt: 120 }, knockdown: { started: 0, until: 120 } });
    Object.assign(l9.state, { phase: 'crawl', startedAt: world.tick - 750, crawlProgress: 1, endingAt: undefined });
    l9.update();
    expect(courier.survivor!.scriptedClip, 'the L9 crawl ending exits into ordinary on-foot pose layers').toBeUndefined();
    expect(courier.survivor!.knockdown).toBeUndefined(); expect(courier.survivor!.attack).toBeUndefined();
    expect(courier.survivor!.animation).toBe('idle');
  } finally { world.dispose(); }
}

// r33-l9polish: (a) the bridge-gate wall spans +-34 m, so an APC cannot slip round its open end (was 13 m); an APC that stops anywhere
// in the bay box (here 30 m north of the lane) still starts the evacuation. (b) The rail-stall hatch: infected climb aboard at most
// one per boardSpacing ticks, so four boarders cannot pile up and kill the courier in 3 s.
async function l9BayAndHatch(): Promise<void> {
  const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
  try {
    const l9 = world.missions!.l9!, vehicles = world.vehicles!, car = vehicles.cars.get(l9.state.carId)!, s = l9.driving.state;
    world.missions!.begin();
    for (let i = 0; i < 5; i++) world.update();
    const wall = world.interactables!.walls.find(w => w.entityId === s.bridgeGateId);
    expect(wall?.halfZ, 'bridge-gate wall reaches +-34 m').toBeGreaterThanOrEqual(34);
    const pose = { x: 452, z: 30, y: car.physics.def.suspension + car.physics.def.wheelRadius + .15, yaw: 0 };
    Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose); car.physics.body.setTranslation(pose, true);
    car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < 90; i++) world.update();
    expect(s.evacuationAt, 'evacuation starts from the bay corner, not only the 11 m radius').not.toBeNull();
    // Hatch pacing: while stalled the vehicle carries the boarding spacing; the climb-aboard clock follows each boarder.
    s.stallAt = world.tick; s.restarted = false; world.update();
    expect(car.entity.vehicle!.boardSpacing, 'stalled hatch: boarders are spaced').toBeGreaterThanOrEqual(150);
    s.restarted = true; world.update();
    expect(car.entity.vehicle!.boardSpacing, 'after the restart the spacing is gone').toBe(0);
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
      expect(l9.driving.laneClear(8, bridge ? 0 : undefined, bridge), `${name}: 8 m of clear route ahead of the restored APC`).toBe(true);
      if (!bridge) continue;
      expect(s.evacuationDone).toBe(true);
      expect(l9.driving.laneClear(8), 'bridge resume: clear along the APC heading too').toBe(true);
      // A restore rebuilds the vehicle bodies, so look the cars up each time.
      const gap = () => { const bus = world.vehicles!.cars.get(s.busId)!, apc = world.vehicles!.cars.get(l9.state.carId)!; return Math.hypot(bus.entity.transform.x - apc.entity.transform.x, bus.entity.transform.z - apc.entity.transform.z); };
      expect(gap(), 'bridge resume: the bus starts well behind the APC').toBeGreaterThanOrEqual(30);
      let respawned = false; world.events.on('player.respawned', () => { respawned = true; });
      for (let i = 0; i < 400; i++) world.update();
      world.player!.damage(1000, world.tick, true);
      for (let i = 0; i < 900 && !respawned; i++) world.update();
      expect(respawned, 'the courier respawns at the bridge checkpoint').toBe(true);
      for (let i = 0; i < 5; i++) world.update();
      expect(l9.driving.laneClear(8), 'bridge retry: clear lane ahead').toBe(true);
      expect(gap(), 'bridge retry: the bus starts well behind the APC').toBeGreaterThanOrEqual(30);
      expect(world.vehicles!.active, 'bridge retry: the courier is still driving the APC').toBe(l9.state.carId);
    } finally { world.dispose(); }
  }
}

// L9 evacuation hold: before the fix the pursuing bus kept full throttle against the braked APC
// (2.4 m first shove, then a 0.2 m/s creep, about 10 m over the hold). It must now stop short.
async function l9BusVsParkedApc(): Promise<void> {
  const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
  try {
    const l9 = world.missions!.l9!, s = l9.driving.state, apc = world.vehicles!.cars.get(l9.state.carId)!;
    world.missions!.begin();
    const put = (v: typeof apc, x: number, z: number) => {
      const pose = { x, z, y: v.physics.def.suspension + v.physics.def.wheelRadius + .15, yaw: 0 };
      Object.assign(v.entity.transform, pose); Object.assign(v.physics.previous, pose); v.physics.body.setTranslation(pose, true);
      v.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); v.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); v.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    };
    const bus = world.vehicles!.cars.get(s.busId)!;
    put(apc, 450, 0); put(bus, 390, 0);
    // Same activation the mission performs once the bus reaches the road behind the APC.
    bus.physics.body.setEnabled(true); bus.entity.hidden = false; bus.entity.vehicle!.braced = false;
    world.vehicles!.autopilot.set(s.busId, (l9.driving as unknown as { busIntent: never }).busIntent); s.busLineAt = world.tick;
    for (let i = 0; i < 90; i++) world.update();
    expect(s.evacuationAt, 'evacuation hold started').not.toBeNull();
    const x0 = apc.entity.transform.x, z0 = apc.entity.transform.z;
    let moved = 0, closest = Infinity;
    for (let i = 0; i < 1800; i++) {
      world.update();
      moved = Math.max(moved, Math.hypot(apc.entity.transform.x - x0, apc.entity.transform.z - z0));
      closest = Math.min(closest, apc.entity.transform.x - bus.entity.transform.x);
    }
    expect(closest, 'the bus really closed in on the APC').toBeLessThan(apc.physics.def.length / 2 + bus.physics.def.length / 2 + 7);
    expect(moved, 'APC displacement over a 30 s hold with the bus pursuing').toBeLessThanOrEqual(1.5);
  } finally { world.dispose(); }
}

// The bus commits to one lane during its 1.5 s warning. A driver who leaves
// that lane takes no APC damage; repeated overshoots damage and finally stop it.
async function l9BusTelegraphAndWreck(): Promise<void> {
  const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
  try {
    const l9 = world.missions!.l9!, s = l9.driving.state, apc = world.vehicles!.cars.get(l9.state.carId)!, bus = world.vehicles!.cars.get(s.busId)!;
    world.missions!.begin(); world.update(); s.busLineAt = world.tick; bus.entity.hidden = false; bus.physics.body.setEnabled(true);
    Object.assign(bus.entity.transform, { x: 170, z: 0 }); Object.assign(apc.entity.transform, { x: 200, z: 0 });
    bus.physics.speed = 5; apc.physics.speed = 5;
    l9.driving.update();
    expect(s.busRamAt, 'the bus announces its ram 90 ticks ahead').toBe(world.tick + 90);
    expect(l9.driving.text(), 'the HUD names the incoming ram and dodge').toContain('School bus lining up a ram · dodge now! 2 s');
    expect(world.events.events(world.tick - 1).some(e => e.type === 'telegraph' && e.sourceId === bus.entity.id && e.duration === 1.5), 'the bus draws a 1.5 s red road-lane tell').toBe(true);
    expect(world.events.events(world.tick - 1).some(e => e.type === 'vehicle.sound' && e.sourceId === bus.entity.id && e.phase === 'horn'), 'the bus sounds its horn').toBe(true);
    const armor = apc.entity.health.current, busHealth = bus.entity.health.current;
    Object.assign(apc.entity.transform, { z: 6 });
    for (let i = 0; i < 3; i++) { s.busRamAt = world.tick; s.busRamZ = 0; l9.driving.update(); }
    expect(apc.entity.health.current, 'the driver dodges the locked ram lane without taking a hit').toBe(armor);
    expect(bus.entity.health.current, 'three missed rams wreck the bus').toBe(busHealth - 1200);
    expect(s.busStoppedAt, 'the wrecked bus stops its pursuit').not.toBeNull();
    // A driver who never dodges still survives the bus encounter: three capped
    // hits cost 120 armour from the APC, leaving its broader mission intact.
    s.busStoppedAt = null; s.busRams = 0; s.busHitAt = -1000; s.busRamAt = 0;
    const passiveArmor = apc.entity.health.current;
    bus.entity.health.current = bus.entity.health.max;
    for (let i = 0; i < 3; i++) {
      // Establish a real native contact before resolving the telegraphed hit.
      for (const [v, x] of [[apc, 200], [bus, 200 - (apc.physics.def.length + bus.physics.def.length) / 2 + .01]] as const) {
        const pose = { x, y: 1, z: 6, yaw: 0 };
        Object.assign(v.entity.transform, pose);
        v.physics.body.setTranslation(pose, true); v.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        v.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); v.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      world.physics.world!.step();
      s.busRamAt = world.tick; s.busRamZ = 6; l9.driving.update();
    }
    expect(apc.entity.health.current, 'a passive driver survives the bus ram cap').toBe(passiveArmor - 120);
    expect(apc.entity.health.current, 'the bus cannot destroy the APC on its own').toBeGreaterThan(0);
  } finally { world.dispose(); }
}

// APC ram rule: ordinary infected cost no durability; heavies cost a small amount and never stall the hull.
async function l9FloorApcThroughPile(): Promise<void> {
  const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
  try {
    const l9 = world.missions!.l9!, vehicles = world.vehicles!, car = vehicles.cars.get(l9.state.carId)!;
    world.missions!.begin();
    for (let i = 0; i < 5; i++) world.update();
    const x0 = -300, z0 = -330, pose = { x: x0, z: z0, y: car.physics.def.suspension + car.physics.def.wheelRadius + .15, yaw: 0 };
    Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose); car.physics.body.setTranslation(pose, true);
    car.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < 30; i++) world.update();
    const entrySpeed = car.physics.def.topSpeed * .8;
    car.physics.body.setLinvel({ x: entrySpeed, y: 0, z: 0 }, true); car.physics.postPhysics();
    const types = ['infected.brute', 'infected.runner', 'infected.armored', 'infected.sprinter', 'infected.crawler', 'infected.dog'];
    for (let i = 0; i < types.length; i++) world.infected!.spawn(types[i], { x: x0 + car.physics.def.length / 2 + 1, z: z0 + (i - 2.5) * .65 }, { state: 'chase' });
    const contacts: { before: number; after: number; target: string | undefined }[] = [];
    let contactSeen = false, clearSince = -1, recoveryTicks = Infinity, minContactSpeed = Infinity;
    world.events.on('vehicle.durability-hit', e => { if (e.type === 'vehicle.durability-hit' && e.source === 'contact') contacts.push({ before: e.before, after: e.after, target: world.entities.get(e.targetId)?.archetype }); });
    const drive = emptyInput(); drive.drive = { throttle: 1, steer: 0 }; drive.brake = false;
    let top = 0;
    for (let i = 0; i < 600; i++) {
      world.applyInput(drive, 'keyboard'); world.update();
      if (i >= 360) top = Math.max(top, car.physics.speed);
      const touching = [...world.entities.iterate()].some(e => e.kind === 'infected' && (e.health.current > 0 || (e.infected?.recoverAt ?? -1) >= 0) && !e.attachedTo && car.physics.hullDistance(e.transform.x, e.transform.z) <= (e.combat?.radius ?? .4) + .02);
      if (touching) minContactSpeed = Math.min(minContactSpeed, car.physics.speed);
      if (touching) { contactSeen = true; clearSince = -1; }
      else if (contactSeen && clearSince < 0) clearSince = world.tick;
      if (clearSince >= 0 && car.physics.speed >= car.physics.def.topSpeed * .9) recoveryTicks = Math.min(recoveryTicks, world.tick - clearSince);
    }
    expect(car.entity.health.current).toBeGreaterThan(0);
    expect(contacts.length, 'the probe contacts infected').toBeGreaterThanOrEqual(1);
    expect(minContactSpeed, 'never below half of entry cruise speed during contact').toBeGreaterThanOrEqual(entrySpeed * .5);
    expect(recoveryTicks, 'returns above 90% cruise speed within six seconds after clearing the pack').toBeLessThanOrEqual(360);
    expect(contacts.some(hit => hit.target === 'infected.runner' && hit.before === hit.after), 'ordinary infected do not cost armour').toBe(true);
    expect(contacts.some(hit => hit.target === 'infected.brute' && hit.before - hit.after === 10), 'heavy impact costs 10 armour').toBe(true);
    expect(Math.hypot(car.entity.transform.x - x0, car.entity.transform.z - z0), 'progress through six infected in 10 s').toBeGreaterThanOrEqual(15);
    expect(top, 'keeps cruise speed once clear').toBeGreaterThanOrEqual(car.physics.def.topSpeed * .9);
  } finally { world.dispose(); }
  await l9FloorApcPackAtFence();
}

// r29-l9pin (r28-vqa: 0.3 m in 56 s at (-265.7, -15.4), ~50 infected, boarders on the hull): nose against a yard fence inside a dense
// mixed pack. The stuck recovery reverse was cancelled by heavy stalls (heavy onsets during the reverse forced throttle 0 + brake),
// and with right lock held it swung the nose back into the fence. Holding forward (straight or right) must break out within 6 s.
async function l9FloorApcPackAtFence(): Promise<void> {
  for (const steer of [0, 1]) {
    const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
    try {
      const l9 = world.missions!.l9!, vehicles = world.vehicles!, car = vehicles.cars.get(l9.state.carId)!;
      world.missions!.begin();
      for (let i = 0; i < 5; i++) world.update();
      vehicles.damage(car.entity.id, car.entity.health.max);
      const x0 = -265.7, z0 = -15.4, yaw = 1.45, pose = { x: x0, z: z0, y: car.physics.def.suspension + car.physics.def.wheelRadius + .15, yaw };
      Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose); car.physics.body.setTranslation(pose, true);
      car.physics.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true); car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      for (let i = 0; i < 30; i++) world.update();
      const c = Math.cos(yaw), s = Math.sin(yaw), L = car.physics.def.length / 2, W = car.physics.def.width / 2;
      const at = (along: number, side: number) => ({ x: x0 + c * along + s * side, z: z0 - s * along + c * side });
      const mix = ['infected.runner', 'infected.dog', 'infected.sprinter', 'infected.runner', 'infected.screamer', 'infected.zebra', 'infected.runner', 'infected.brute', 'infected.dog', 'infected.armored'];
      for (let n = 0, ring = 0; n < 50; ring++) {
        const hx = L + .9 + ring * .9, hz = W + .9 + ring * .9, perimeter = 4 * (hx + hz), count = Math.floor(perimeter);
        for (let k = 0; k < count && n < 50; k++, n++) {
          const t = k / count * perimeter;
          const p = t < 2 * hx ? at(-hx + t, hz) : t < 2 * hx + 2 * hz ? at(hx, hz - (t - 2 * hx)) : t < 4 * hx + 2 * hz ? at(hx - (t - 2 * hx - 2 * hz), -hz) : at(-hx, -hz + (t - 4 * hx - 2 * hz));
          world.infected!.spawn(mix[n % mix.length], p, { state: 'chase' });
        }
      }
      for (let i = 0; i < 4; i++) world.infected!.spawn('infected.runner', at(-L * .5 + (i >> 1) * .8, (i % 2 ? 1 : -1) * (W + .35)), { state: 'chase' });
      const drive = emptyInput(); drive.drive = { throttle: 1, steer }; drive.brake = false;
      let away = 0, top = 0, boarded = 0;
      const hp = car.entity.health.current;
      let billed = 0; world.events.on('vehicle.durability-hit', () => { billed++; });
      for (let i = 0; i < 360; i++) {
        world.applyInput(drive, 'keyboard'); world.update();
        away = Math.max(away, Math.hypot(car.entity.transform.x - x0, car.entity.transform.z - z0)); top = Math.max(top, car.physics.speed);
        boarded = Math.max(boarded, car.entity.vehicle!.attached.length);
      }
      expect(hp, 'fixture is the lowest damage state').toBe(0);
      expect(boarded, `boarders still climb on (steer ${steer})`).toBeGreaterThanOrEqual(4);
      expect(billed, `the pack still bills durability (steer ${steer})`).toBeGreaterThan(10);
      expect(away, `breaks off the fence inside the pack within 6 s (steer ${steer}; was 0.5 m)`).toBeGreaterThanOrEqual(3);
      expect(top, `moves at >= 2 m/s while breaking out (steer ${steer})`).toBeGreaterThanOrEqual(2);
    } finally { world.dispose(); }
  }
}

// r32-l9fun (PO 11-10 "real fight action not just dumb zombies"): on the road detour a leaper pounce lands on the hull, tears at it
// until a handbrake throws it off (alive, knocked down), and a thrower lobs debris that lands on the APC's lane as ordinary,
// smashable road obstacles (collider live, nothing left airborne).
// r27-l9board: a diagonally parked APC puts the passenger door inside the hull's nav margin; the corgi halted 1.3 m short of it
// (boarding radius 1.2 m) and the evacuation never completed. Corgi and Sam must now seat from several approach sides.
async function l9CompanionsBoardDiagonalApc(): Promise<void> {
  for (const yaw of [-.85, .85]) {
    const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
    try {
      const l9 = world.missions!.l9!, s = l9.driving.state, apc = world.vehicles!.cars.get(l9.state.carId)!;
      world.missions!.begin();
      const pose = { x: 451, z: 1, y: apc.physics.def.suspension + apc.physics.def.wheelRadius + .15, yaw };
      Object.assign(apc.entity.transform, pose); Object.assign(apc.physics.previous, pose); apc.physics.body.setTranslation(pose, true);
      apc.physics.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
      apc.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); apc.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      const corgi = [...world.entities.iterate()].find(e => e.companion)!, sam = world.entities.get(s.samId)!;
      Object.assign(corgi.transform, { x: 444, z: -1 }); Object.assign(sam.transform, { x: 445, z: 6 });
      // Both start outside the vehicle, as when the courier arrives at the evacuation point.
      apc.entity.vehicle!.passengers = (apc.entity.vehicle!.passengers ?? []).filter(p => p.id !== corgi.id && p.id !== sam.id);
      for (const e of [corgi, sam]) { delete e.passengerOf; e.hidden = false; }
      world.spatial.set(corgi.id, 444, -1); world.spatial.set(sam.id, 445, 6);
      for (let i = 0; i < 1200 && !(s.evacuationAt !== null && corgi.passengerOf !== undefined && sam.passengerOf !== undefined); i++) world.update();
      expect(s.evacuationAt, `evacuation hold started (yaw ${yaw}, apc ${JSON.stringify(apc.entity.transform)} speed ${apc.physics.speed})`).not.toBeNull();
      expect(corgi.passengerOf, `corgi boards the APC parked at yaw ${yaw}`).toBe(apc.entity.id);
      expect(sam.passengerOf, `Sam boards the APC parked at yaw ${yaw}`).toBe(apc.entity.id);
    } finally { world.dispose(); }
  }
}

// L9 boarders threaten an exposed hatch occupant; the closed cab protects the driver.
async function apcBoarders(): Promise<void> {
  const world = await loadLevel('L9', 1, preset('L9-default'));
  try {
    const id = world.missions!.l9!.state.carId, car = world.vehicles!.cars.get(id)!;
    const dogId = world.infected!.spawn('infected.dog', { x: car.entity.transform.x, z: car.entity.transform.z + car.physics.def.width / 2 + .4 }, { state: 'chase' });
    const dog = world.entities.get(dogId)!;
    Object.assign(dog.transform, { x: car.entity.transform.x, y: car.entity.transform.y + .7, z: car.entity.transform.z + car.physics.def.width / 2 + .4 });
    world.spatial.set(dogId, dog.transform.x, dog.transform.z);
    for (let i = 0; i < 30 && !car.entity.vehicle!.attached.includes(dogId); i++) world.update();
    expect(car.entity.vehicle!.attached, 'a dog that reaches the hull boards it').toContain(dogId);
    expect(car.entity.vehicle!.attached, 'a hull slot is reserved once').toHaveLength(1);
    const climbAt = car.entity.vehicle!.apcBoarders![dogId].startedAt;
    for (let i = 0; i < 90; i++) world.update();
    expect(car.entity.vehicle!.apcBoarders![dogId].startedAt, 'overlap does not restart the climb').toBe(climbAt);
    for (let i = 0; i < 240; i++) world.update();
    expect(world.entities.get(1)!.health.current, 'the closed cab protects its driver').toBe(world.entities.get(1)!.health.max);
    world.missions!.l9!.driving.state.stallAt = world.tick; world.missions!.l9!.driving.state.hatchOpen = true;
    for (let i = 0; i < 120 && world.entities.get(1)!.health.current === world.entities.get(1)!.health.max; i++) world.update();
    expect(world.entities.get(1)!.health.current, 'a climbed boarder bites an exposed hatch occupant').toBeLessThan(world.entities.get(1)!.health.max);
    const turn = emptyInput(); turn.drive = { throttle: 1, steer: 1 };
    car.physics.body.setLinvel({ x: 8, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 1, z: 0 }, true);
    world.applyInput(turn, 'keyboard'); world.update();
    expect(car.entity.vehicle!.attached, 'a sharp turn shakes the dog off').not.toContain(dogId);
    expect(dog.attachedTo).toBeUndefined();
    car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true); car.physics.postPhysics();
    world.missions!.l9!.driving.state.stallAt = world.tick; world.missions!.l9!.driving.state.hatchOpen = true;
    const targetId = world.infected!.spawn('infected.runner', { x: car.entity.transform.x + 12, z: car.entity.transform.z }, { state: 'chase' });
    const target = world.entities.get(targetId)!;
    for (let i = 0; i < 120 && target.health.current === target.health.max; i++) {
      const origin = world.entities.get(1)!.transform, dx = target.transform.x - origin.x, dz = target.transform.z - origin.z, length = Math.hypot(dx, dz) || 1;
      world.applyInput({ ...emptyInput(), brake: true, selectedWeaponKey: 5, aim: { x: dx / length, z: dz / length }, aimSource: 'keyboard', activeAttack: true, left: { down: true, held: true, up: false } }, 'keyboard'); world.update();
    }
    expect(target.health.current, 'carried hatch fire actually reaches ground enemies').toBeLessThan(target.health.max);
    const wheelRotation = car.physics.wheels[0].rotation;
    const roll = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };
    world.vehicles!.scriptPose(id, { ...car.entity.transform, yaw: 0 }, 3, roll);
    expect(car.physics.speed, 'scripted departure retains its speed').toBe(3);
    expect(car.physics.wheels[0].rotation, 'scripted departure turns its wheels').toBeGreaterThan(wheelRotation);
    expect(car.physics.rotation, 'scripted crash retains the whole-hull roll').toEqual(roll);
  } finally { world.dispose(); }
}

/** Vehicle-relative car controls (PO 2026-11-10): throttle > 0 = W, < 0 = S (brake, then reverse), steer > 0 = A = the vehicle's own left. */
async function screenRelativeSteering(): Promise<void> {
  const world = new SimWorld(); await world.init(); world.loadScenario('drive-course');
  try {
    for (let i = 0; i < 36; i++) world.update();
    const car = world.vehicles!.cars.get(2)!;
    // A turns the vehicle to its own left at speed in every heading; D to its right. The screen/camera has no say.
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      for (const side of [1, -1]) {
        car.physics.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
        car.physics.body.setLinvel({ x: Math.cos(yaw) * 6, y: 0, z: -Math.sin(yaw) * 6 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true); car.physics.postPhysics();
        const turn = emptyInput(); turn.drive = { throttle: 1, steer: side };
        const before = car.entity.transform.yaw;
        for (let i = 0; i < 30; i++) { world.applyInput(turn, 'keyboard'); world.update(); }
        const change = Math.atan2(Math.sin(car.entity.transform.yaw - before), Math.cos(car.entity.transform.yaw - before));
        expect(Math.sign(change), `${side > 0 ? 'A' : 'D'} turns the vehicle ${side > 0 ? 'left' : 'right'} heading ${yaw.toFixed(2)}`).toBe(side);
        expect(Math.abs(change)).toBeGreaterThan(.1);
      }
    }
    // S at speed brakes first, then reverses.
    car.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); car.physics.body.setLinvel({ x: 6, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true); car.physics.postPhysics();
    const back = emptyInput(); back.drive = { throttle: -1, steer: 0 };
    world.applyInput(back, 'keyboard'); world.update();
    expect(car.physics.intent.throttle).toBeLessThan(0);
    expect(car.physics.braking, 'forward momentum brakes before reversing').toBe(true);
    for (let i = 0; i < 360 && car.physics.forwardSpeed > -.5; i++) { world.applyInput(back, 'keyboard'); world.update(); }
    expect(car.physics.forwardSpeed, 'holding S past standstill reverses').toBeLessThan(-.5);
    // A while reversing: the front wheels point left, so the car backs up to the right (nose swings clockwise), like a real car.
    const rev = emptyInput(); rev.drive = { throttle: -1, steer: 1 }; const before = car.entity.transform.yaw;
    for (let i = 0; i < 60; i++) { world.applyInput(rev, 'keyboard'); world.update(); }
    const swing = Math.atan2(Math.sin(car.entity.transform.yaw - before), Math.cos(car.entity.transform.yaw - before));
    expect(swing, 'reversing with the wheels left rotates the vehicle clockwise (right)').toBeLessThan(0);
  } finally { world.dispose(); }
}

async function vehicleShovesProps(): Promise<PropSnapshot> {
  const world = new SimWorld(); await world.init(); world.loadScenario('prop-yard');
  try {
    const barrierId = world.vehicles!.obstacles.spawn('jersey-barrier', { x: 60, z: 20 });
    const barrier = world.vehicles!.obstacles.items.find(item => item.entity.id === barrierId)!;
    world.vehicles!.obstacles.ram(barrier, { x: 12, y: 0, z: 0 }, world.tick);
    for (let i = 0; i < 60; i++) world.update();
    expect(world.entities.get(barrierId)?.health.current, 'rammed barriers keep their identity and remain in the world').toBeGreaterThan(0);
    expect(barrier.body?.isDynamic(), 'rammed barriers become physics bodies').toBe(true);
    expect(barrier.entity.transform.x, 'the barrier tumbles away from the bumper').toBeGreaterThan(61);
    const coneId = world.hazards!.spawn('cone', { x: 65, z: 20 });
    const cone = world.entities.get(coneId)!;
    world.vehicles!.obstacles.ramDestructible(cone, .5, .15, { x: 10, y: 0, z: 0 }, world.tick);
    expect(cone.health.current, 'map cone retains health after a vehicle ram').toBe(cone.health.max);
    expect(world.interactables!.walls.some(w => w.entityId === coneId)).toBe(false);
    for (let i = 0; i < 60; i++) world.update();
    const movedX = cone.transform.x;
    world.vehicles!.obstacles.rebuild();
    const restoredCone = world.vehicles!.obstacles.items.find(o => o.entity.id === coneId)!;
    expect(restoredCone.entity.transform.x, 'collider rebuild retains displaced map prop pose').toBe(movedX);
    expect(restoredCone.body!.linvel().y, 'rebuild does not launch the cone again').toBe(0);
    expect(cone.destructible!.broken).toBe(false);
    const prop = world.props!.spawn({ id: 'ram-test-wreck', assetId: 'veh.wreck', position: [0, 0, 0], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [-2.2, 0, -.9], max: [2.2, 1.8, .9] } });
    world.props!.updateNavigation();
    const id = world.vehicles!.spawn('vehicle.military-apc', { x: -4.9, z: 0 });
    const car = world.vehicles!.cars.get(id)!; world.vehicles!.active = id;
    world.props!.prePhysics();
    expect(prop.body.linvel().x, 'released throttle does not move a resting prop').toBe(0);
    car.entity.vehicle!.floor = true;
    Object.assign(car.physics.intent, { throttle: 1, brake: false });
    world.props!.prePhysics();
    expect(prop.body.linvel().x, 'held APC throttle pushes an authored prop from rest').toBeGreaterThan(0);
    expect(world.entities.get(prop.entityId)?.health.current, 'pushing preserves the prop').toBeGreaterThan(0);
    car.entity.vehicle!.floor = false;
    prop.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    car.physics.body.setLinvel({ x: 18, y: 0, z: 0 }, true); car.physics.postPhysics();
    world.props!.prePhysics();
    expect(prop.body.isSleeping()).toBe(false);
    expect(prop.body.linvel().x).toBeGreaterThan(0);
    expect(world.props!.navWalls.has(prop.entityId)).toBe(false);
    prop.body.setLinvel({ x: 30, y: 0, z: 0 }, true);
    world.props!.prePhysics();
    expect(prop.body.linvel().x, 'a prop already escaping the bumper gets no additional impulse').toBe(30);
    const drums = world.props!.spawn({ id: 'ram-test-drum-stack', assetId: 'prop.cure-drum-stack', position: [10, 0, 0], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [-.65, 0, -.55], max: [.65, 2.2, .55] } });
    world.props!.updateNavigation();
    const secondId = world.vehicles!.spawn('vehicle.military-apc', { x: 6.5, z: 0 });
    const secondCar = world.vehicles!.cars.get(secondId)!; world.vehicles!.active = secondId;
    secondCar.physics.body.setLinvel({ x: 18, y: 0, z: 0 }, true); secondCar.physics.postPhysics();
    world.props!.prePhysics();
    expect(drums.body.isSleeping()).toBe(false);
    expect(drums.body.linvel().x).toBeGreaterThan(0);
    expect(world.props!.navWalls.has(drums.entityId)).toBe(false);
    const reverseProp = world.props!.spawn({ id: 'ram-test-parked-sedan', assetId: 'veh.sedan-blue', position: [20, 0, 0], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [-2.2, 0, -.9], max: [2.2, 1.8, .9] } });
    const player = world.entities.get(1)!, playerPose = { ...player.transform };
    world.vehicles!.active = null; world.props!.shoulderPush = true;
    Object.assign(player.transform, { x: 18, z: 0 });
    world.props!.pushSpeed({ ...emptyInput(), move: { x: 1, z: 0 } });
    expect(reverseProp.body.isFixed(), 'vehicle-only props retain their authored on-foot restriction').toBe(true);
    Object.assign(player.transform, playerPose); world.props!.shoulderPush = false;
    const reverseId = world.vehicles!.spawn('vehicle.military-apc', { x: 24.95, z: 0 });
    const reverseCar = world.vehicles!.cars.get(reverseId)!; world.vehicles!.active = reverseId;
    reverseCar.physics.body.setLinvel({ x: -18, y: 0, z: 0 }, true); reverseCar.physics.postPhysics();
    world.props!.prePhysics();
    expect(reverseProp.body.linvel().x, 'reverse contact pushes a parked car behind the APC').toBeLessThan(0);
    const near = world.props!.spawn({ id: 'ram-test-nearby', assetId: 'veh.wreck', position: [40, 0, 0], yaw: Math.PI / 2, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [-.9, 0, -2.2], max: [.9, 1.8, 2.2] } });
    const nearbyId = world.vehicles!.spawn('vehicle.military-apc', { x: 35.5, z: 0 });
    const nearbyCar = world.vehicles!.cars.get(nearbyId)!; world.vehicles!.active = nearbyId;
    nearbyCar.physics.body.setLinvel({ x: 18, y: 0, z: 0 }, true); nearbyCar.physics.postPhysics();
    world.props!.prePhysics();
    expect(near.body.isSleeping(), 'a nearby elongated prop stays asleep before hull contact').toBe(true);
    for (const [assetId, x, halfX] of [['prop.traffic-cone', 0, .24], ['prop.folding-chair', 10, .33]] as const) {
      const small = world.props!.spawn({ id: `ram-test-${assetId}`, assetId, position: [x, 0, 10], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [x - halfX, 0, 9.5], max: [x + halfX, 1.1, 10.5] } });
      const sedanId = world.vehicles!.spawn('vehicle.sedan', { x: x - vehicleDef('vehicle.sedan').length / 2 - halfX + .05, z: 10 });
      const sedan = world.vehicles!.cars.get(sedanId)!; world.vehicles!.active = sedanId;
      sedan.physics.body.setLinvel({ x: 8, y: 0, z: 0 }, true); sedan.physics.postPhysics();
      world.props!.prePhysics();
      expect(small.body.linvel().x, `${assetId} moves when the lower sedan bumper reaches it`).toBeGreaterThan(0);
    }
    for (let i = 0; i < 60; i++) world.update();
    expect(world.props!.items.filter(p => p.awake).length).toBeLessThanOrEqual(world.props!.awakeBudget);
    return world.props!.snapshot();
  } finally { world.dispose(); }
}

// The zoo's fixed objective must remain at the real doorway while rockets and
// infected strike the evacuation vehicle. Checkpoint rebuilds need the same hold.
async function zooParkedBoarding(): Promise<void> {
  const world = await loadLevel('L8', 1);
  try {
    const mission = world.missions!, zoo = mission.l8!, vehicles = world.vehicles!;
    mission.begin();
    const advance = (ticks: number) => { for (let i = 0; i < ticks; i++) world.update(); };
    expect(mission.state.steps.sanctuary.status).toBe('active');
    expect(mission.state.steps.escape.status).toBe('pending');
    const preBreachDoor = vehicles.passengerDoor(zoo.state.carId);
    missionControls(world).teleport(1, preBreachDoor);
    world.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); advance(1);
    expect(vehicles.active, 'APC cannot be entered during the sanctuary objective').toBeNull();
    expect(vehicles.canInteract(), 'APC offers no enter prompt before the breach').toBe(false);
    expect(zoo.canDrive(), 'APC cannot be driven before the breach').toBe(false);
    expect(zoo.boarding(), 'survivors cannot queue at the APC before the breach').toBe(false);
    expect(mission.state.steps.depart.status).toBe('pending');
    world.tick = 3124; advance(1);
    expect(mission.state.steps.sanctuary.status).toBe('active');
    expect(mission.state.steps.escape.status).toBe('pending');
    expect(mission.state.marker).toBe('l8-route');
    expect(mission.def.anchors['l8-route']).toMatchObject({ x: world.entities.get(zoo.state.keeperId)!.transform.x, z: world.entities.get(zoo.state.keeperId)!.transform.z });
    expect(mission.state.steps.depart.status).toBe('pending');
    mission.restore('sanctuary');
    expect(mission.state.marker).toBe('l8-route');
    expect(mission.def.anchors['l8-route']).toMatchObject({ x: world.entities.get(zoo.state.keeperId)!.transform.x, z: world.entities.get(zoo.state.keeperId)!.transform.z });
    expect(mission.state.steps.escape.status).toBe('pending');
    missionControls(world).teleport(1, zoo.door());
    // r31-nadia: while Nadia still leads (a courier camping the APC never follows her), the calm lasts its 180 s cap before the breach.
    world.tick = zoo.state.startedAt + 180 * 60 - 1; advance(1);
    expect(mission.state.states.breached).toBe(true);
    expect(mission.state.steps.sanctuary.status, 'camping the APC does not skip the plaza after the breach').toBe('active');
    expect(mission.state.checkpoint, 'APC camping must not award the escape-route checkpoint').toBe('breach');
    expect(zoo.boarding()).toBe(false);
    expect(zoo.canBoardDriver()).toBe(false);
    expect(mission.state.steps.escape.status).toBe('pending');
    missionControls(world).teleport(1, mission.def.anchors['central-plaza']); advance(1);
    expect(mission.state.steps.sanctuary.status).toBe('completed');
    expect(mission.state.steps.escape.status).toBe('active');
    expect(mission.state.marker, 'the opening defence has no destination pin').toBeNull();
    expect(objectiveText(mission, mission.def.steps[1].text)).toBe('Protect the group!');
    world.tick = zoo.state.breachedAt + 1800; advance(1);
    // r33-l8route: the marker is the route node (back to the plaza until the doors shut, then the pond gate), never an arena across a fence.
    expect(mission.state.marker).toBe('l8-route');
    expect(mission.def.steps.find(step => step.id === 'escape')!.text).toMatch(/^(Back to the plaza|Return to the plaza|Enter the flamingo pond)/);
    for (const restored of [false, true]) {
      if (restored) mission.restore('sanctuary');
      advance(60);
      const car = vehicles.cars.get(zoo.state.carId)!, before = { ...car.entity.transform };
      car.physics.body.applyImpulse({ x: car.physics.def.mass * 2, y: car.physics.def.mass * 4, z: car.physics.def.mass }, true);
      car.physics.body.applyTorqueImpulse({ x: 0, y: car.physics.def.mass, z: 0 }, true);
      advance(120);
      expect(Math.hypot(car.entity.transform.x - before.x, car.entity.transform.z - before.z), `parked APC after restore=${restored}`).toBeLessThan(.01);
      expect(Math.abs(car.entity.transform.yaw - before.yaw)).toBeLessThan(.001);
      expect(Math.hypot(zoo.door().x - mission.def.anchors.exit.x, zoo.door().z - mission.def.anchors.exit.z)).toBeLessThan(.3);
      const health = car.entity.health.current;
      vehicles.damage(car.entity.id, 10);
      expect(car.entity.health.current, 'parking does not protect durability').toBe(health - 10);
    }
    const car = vehicles.cars.get(zoo.state.carId)!;
    // This parking/transport fixture isolates the completed-arena commander
    // and boarding beats; normal progression gates the same step behind all six fights.
    for (const arena of zoo.state.arenas) arena.phase = 3;
    mission.state.steps.sanctuary.status = 'completed'; mission.state.steps.escape.status = 'active';
    mission.setState('breached', true); zoo.state.breachedAt = world.tick - 1800; zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
    missionControls(world).teleport(1, mission.def.anchors['central-plaza']); advance(1);
    // This isolated parking/transport fixture starts after the command-post retreat.
    const hale = world.entities.get(zoo.state.haleId)!, halePost = { x: zoo.door().x - .7, z: zoo.door().z + 1.2 };
    missionControls(world).teleport(hale.id, halePost); hale.civilian!.ally!.post = halePost; hale.civilian!.ally!.hold = true;
    missionControls(world).teleport(1, zoo.door());
    world.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); advance(1);
    expect(vehicles.active, 'courier can keep covering passengers instead of boarding early').toBeNull();
    expect(objectiveText(mission, mission.def.steps[0].text)).toMatch(/Cover.*aboard/);
    world.applyInput(emptyInput(), 'keyboard'); advance(60);
    expect(vehicles.active, 'standing at the door does not remove cover fire either').toBeNull();
    const charge = playHaleCharge(world);
    expect(charge.distance).toBeLessThan(6); expect(charge.move).toBe('elephant.charge');
    missionControls(world).teleport(1, { x: zoo.door().x - 4, z: zoo.door().z + 2 });
    const entry = vehicles.passengerDoor(car.entity.id);
    for (const id of zoo.passengers()) {
      missionControls(world).teleport(id, entry);
      expect(vehicles.boardPassenger(car.entity.id, id)).toBe(true);
    }
    for (let i = 0; i < 24 * 60 && zoo.passengers().some(id => !car.entity.vehicle!.passengers?.some(passenger => passenger.id === id && passenger.phase === 'seated')); i++) advance(1);
    expect(zoo.passengers()).toHaveLength(14);
    expect(zoo.passengers().every(id => car.entity.vehicle!.passengers?.some(passenger => passenger.id === id && passenger.phase === 'seated')), 'all fourteen passengers have completed the boarding animation').toBe(true);
    // The failed ordering: the elephant is already down and the Hale charge
    // never happened, so Hale remains alive without the story flag.
    mission.setState('elephant-fallen', true);
    const haleActor = world.entities.get(zoo.state.haleId)!;
    haleActor.health.current = haleActor.health.max; haleActor.civilian!.state = 'calm';
    mission.setState('hale-keys', false);
    mission.setState('hale-fallen', false);
    expect(zoo.canBoardDriver(), '14/14 seated with Hale alive still unlocks the driver door').toBe(true);
    mission.setState('hale-fallen', true);
    expect(zoo.canBoardDriver(), '14/14 seated also unlocks when Hale has fallen').toBe(true);
    mission.setState('hale-fallen', false);
    expect(mission.state.marker, '14/14 keeps the driver-door marker active').toBe('exit');
    expect(mission.def.steps.find(step => step.id === 'escape')!.text).toBe('Board the armored vehicle · 14/14 aboard');
    expect(Math.hypot(mission.def.anchors.exit.x - zoo.door().x, mission.def.anchors.exit.z - zoo.door().z)).toBeLessThan(.3);
    advance(60);
    missionControls(world).teleport(1, zoo.door());
    world.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); advance(1);
    expect(vehicles.active, 'E at the driver door enters with the complete group and Hale alive').toBe(car.entity.id);
    world.applyInput(emptyInput(), 'keyboard'); advance(480);
    expect(mission.state.states.departed, 'the APC handoff completes within eight seconds without Hale falling').toBe(true);
    expect(zoo.canDrive(), 'complete living group boards at the fixed destination').toBe(true);
    expect(car.entity.vehicle!.scripted, 'the zoo departure owns the vehicle before handover').toBe(true);
    const save = preset('L9-default'); save.transport = vehicles.transfer(car.entity.id);
    const next = await loadLevel('L9', 1, save);
    try {
      const arrived = next.vehicles!.cars.get(car.entity.id)!, start = { ...arrived.entity.transform };
      expect(arrived.entity.vehicle!.scripted, 'L9 releases the scripted departure and restores driving').toBeUndefined();
      expect(arrived.entity.health.current).toBe(car.entity.health.current);
      next.applyInput({ ...emptyInput(), drive: { throttle: 1, steer: 0 } }, 'keyboard');
      for (let i = 0; i < 90; i++) next.update();
      expect(Math.hypot(arrived.entity.transform.x - start.x, arrived.entity.transform.z - start.z), 'same APC drives after handover').toBeGreaterThan(.5);
    } finally { next.dispose(); }
  } finally { world.dispose(); }
}

// Restore the QA route that exposed the handoff lock, then isolate its completed
// combat outcome. Boarding animations and driver interaction remain native.
async function zooCheckpointHandoff(): Promise<void> {
  const fixture = readFixture('tests/fixtures/saves/qa/l8-elephant-apc-yard-engaged.json.gz');
  for (const quality of ['high', 'low'] as const) for (const fallen of [false, true]) {
    const world = await loadLevel('L8', 1, fixture.campaign, 0, { quality });
    try {
      const mission = world.missions!;
      mission.loadResume(fixture.resume as Parameters<typeof mission.loadResume>[0]);
      const zoo = mission.l8!, vehicles = world.vehicles!, car = world.entities.get(zoo.state.carId)!;
      world.combat!.damage.god = true;
      for (const arena of zoo.state.arenas) arena.phase = 3;
      zoo.bosses.updateGates();
      const elephant = zoo.state.arenas.find(arena => arena.id === 'elephant')!;
      for (const id of elephant.ids) { const actor = world.entities.get(id); if (actor) { actor.health.current = 0; actor.corpse = true; if (actor.infected) actor.infected.recoverAt = -1; } }
      mission.setState('elephant-fallen', true);
      mission.setState('hale-keys', fallen); mission.setState('hale-fallen', fallen);
      zoo.state.haleFallAt = 0;
      const hale = world.entities.get(zoo.state.haleId)!;
      hale.health.current = fallen ? 0 : hale.health.max; hale.civilian!.state = fallen ? 'finished' : 'calm';
      const group = zoo.passengers(); expect(group).toHaveLength(14);
      missionControls(world).teleport(1, { x: zoo.door().x - 4, z: zoo.door().z + 2 });
      for (const id of group) {
        if (world.entities.get(id)!.passengerOf !== undefined) continue;
        missionControls(world).teleport(id, vehicles.passengerDoor(car.id));
        expect(vehicles.boardPassenger(car.id, id)).toBe(true);
      }
      world.applyInput(emptyInput(), 'keyboard');
      for (let tick = 0; tick < 61; tick++) world.update();
      expect(zoo.canBoardDriver(), `${quality}, Hale fallen=${fallen}`).toBe(true);
      expect(objectiveText(mission, mission.def.steps.find(step => step.id === 'escape')!.text)).toBe('Board the armored vehicle · 14/14 aboard');
      expect(mission.state.marker).toBe('exit');
      missionControls(world).teleport(1, zoo.door());
      world.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); world.update();
      expect(vehicles.active).toBe(car.id);
      world.applyInput(emptyInput(), 'keyboard');
      for (let tick = 0; tick < 900 && !mission.state.states.departed; tick++) world.update();
      expect(mission.state.states.departed, `${quality}, Hale fallen=${fallen}: departure within 15 s`).toBe(true);
    } finally { world.dispose(); }
  }
}

// r2-bike (L1 depot): standing still where a story beat left her beside the parked cargo bike never mounts it; walking up
// to the bike and stopping (stand-to-mount 0.4 s, spec E19 5.10) and E still do.
async function bikeMountIntent(): Promise<void> {
  const world = new SimWorld(); await world.init(); world.loadScenario('survivor', 1);
  try {
    const bike = world.vehicles!.bicycle, player = world.entities.get(1)!;
    bike.spawn({ x: player.transform.x + 1, z: player.transform.z }, Math.PI / 2);
    const still = () => { world.setInput({ move: { x: 0, z: 0 }, interact: false }); world.update(); };
    const near = () => Math.hypot(player.transform.x - bike.entity!.transform.x, player.transform.z - bike.entity!.transform.z);
    expect(near()).toBeLessThan(1.5);
    for (let i = 0; i < 120; i++) still();
    expect(bike.riding, 'idle beside the bike').toBe(false);
    world.setInput({ move: { x: -1, z: 0 } }); for (let i = 0; i < 50 && near() < 2.5; i++) world.update();
    for (let i = 0; i < 30; i++) still();
    expect(near()).toBeGreaterThan(2);
    for (let i = 0; i < 90 && near() > 1.2; i++) { world.setInput({ move: { x: 1, z: 0 } }); world.update(); }
    for (let i = 0; i < 40 && !bike.riding; i++) still();
    expect(bike.riding, 'walked up and stopped').toBe(true);
    world.setInput({ interact: true }); world.update(); world.setInput({ interact: false }); world.update();
    expect(bike.riding, 'E dismounts').toBe(false);
  } finally { world.dispose(); }
}
