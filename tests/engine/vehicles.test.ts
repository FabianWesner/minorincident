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
import { checkBossDamage, checkBossStates, checkL8Cues, checkOrdinaryDamage } from '../helpers/l8BossShoot';
import { missionControls } from '../../src/sim/missions/controls';
import { preset } from '../../src/sim/progression/Campaign';
import { objectiveText } from '../../src/sim/missions/objectiveText';
import type { PropSnapshot } from '../../src/sim/interact/PropSystem';

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
    expect(world.vehicles!.exit()).toBe(true);
    const exit = world.getEntity(1)!;
    expect(exit.hidden).toBe(false); expect(exit.transform.z).toBeLessThan(p.z);
    expect(world.physics.world!.intersectionWithShape(exit.transform, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(.35, .35), undefined, undefined, world.physics.playerCollider!)).toBeNull();
    world.loadScenario('empty'); expect(world.physics.bodyCount).toBe(2);
  } finally { world.dispose(); }
  await screenRelativeSteering();
  const shoved = await vehicleShovesProps();
  expect(await vehicleShovesProps(), 'vehicle-to-prop simulation repeats exactly').toEqual(shoved);
  await bikeMountIntent();
  await zooParkedBoarding();
  await checkL8Cues();
  await checkBossDamage(); await checkOrdinaryDamage(); await checkBossStates();
  await apcBoarders();
  await l9BusVsParkedApc();
  await l9FloorApcThroughPile();
  await l9CompanionsBoardDiagonalApc();
}, 400_000);

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

// r27-l9apc: a pile of brutes/armored at the bumper chained one 60-tick heavy stop after another and pinned the
// floor-state APC (QA: 863 -> 819 m in 7 min; this fixture: 2.3 m in 10 s). One heavy onset still stops momentum,
// later heavy onsets inside the grace window only bill durability, so the APC drives on at its floor speed.
async function l9FloorApcThroughPile(): Promise<void> {
  const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
  try {
    const l9 = world.missions!.l9!, vehicles = world.vehicles!, car = vehicles.cars.get(l9.state.carId)!;
    world.missions!.begin();
    for (let i = 0; i < 5; i++) world.update();
    vehicles.damage(car.entity.id, car.entity.health.max);
    const x0 = -300, z0 = -330, pose = { x: x0, z: z0, y: car.physics.def.suspension + car.physics.def.wheelRadius + .15, yaw: 0 };
    Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose); car.physics.body.setTranslation(pose, true);
    car.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < 30; i++) world.update();
    const types = ['infected.runner', 'infected.sprinter', 'infected.brute', 'infected.armored'];
    for (let i = 0; i < 16; i++) world.infected!.spawn(types[i % 4], { x: x0 + car.physics.def.length / 2 + 1 + Math.floor(i / 4) * .8, z: z0 + (i % 4 - 1.5) * .8 }, { state: 'chase' });
    const stops: number[] = [];
    world.events.on('vehicle.durability-hit', e => { if (e.type === 'vehicle.durability-hit' && car.entity.vehicle!.impactStallUntil === world.tick + 60 && !stops.includes(world.tick)) stops.push(world.tick); });
    const drive = emptyInput(); drive.drive = { throttle: 1, steer: 0 }; drive.brake = false;
    let top = 0;
    for (let i = 0; i < 600; i++) { world.applyInput(drive, 'keyboard'); world.update(); if (i >= 360) top = Math.max(top, car.physics.speed); }
    expect(car.entity.health.current, 'fixture is the lowest damage state').toBe(0);
    expect(stops.length, 'a heavy contact still stops momentum (E31-AC06)').toBeGreaterThanOrEqual(1);
    expect(Math.hypot(car.entity.transform.x - x0, car.entity.transform.z - z0), 'progress through 16 infected (8 heavy) in 10 s').toBeGreaterThanOrEqual(15);
    expect(top, 'keeps its floor speed share once clear').toBeGreaterThanOrEqual(car.physics.def.topSpeed * .6 * .9);
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
    world.missions!.l9!.driving.state.stallAt = world.tick;
    for (let i = 0; i < 120 && world.entities.get(1)!.health.current === world.entities.get(1)!.health.max; i++) world.update();
    expect(world.entities.get(1)!.health.current, 'a climbed boarder bites an exposed hatch occupant').toBeLessThan(world.entities.get(1)!.health.max);
    const turn = emptyInput(); turn.drive = { throttle: 1, steer: 1 };
    car.physics.body.setLinvel({ x: 8, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 1, z: 0 }, true);
    world.applyInput(turn, 'keyboard'); world.update();
    expect(car.entity.vehicle!.attached, 'a sharp turn shakes the dog off').not.toContain(dogId);
    expect(dog.attachedTo).toBeUndefined();
    car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true); car.physics.postPhysics();
    world.missions!.l9!.driving.state.stallAt = world.tick;
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

async function screenRelativeSteering(): Promise<void> {
  const world = new SimWorld(); await world.init(); world.loadScenario('drive-course');
  try {
    for (let i = 0; i < 36; i++) world.update();
    const car = world.vehicles!.cars.get(2)!;
    const start = { ...car.entity.transform };
    // Screen-up is world -Z in the drive-course camera. A local drive intent
    // pointing right/back must not override the requested screen direction.
    const frame = emptyInput(); frame.move.z = -1; frame.drive = { throttle: -1, steer: -1 };
    world.applyInput(frame, 'keyboard');
    for (let i = 0; i < 120; i++) world.update();
    expect(car.entity.transform.z).toBeLessThan(start.z - 1);
    expect(car.entity.transform.yaw).toBeGreaterThan(.1);
    const yaw = 2;
    car.physics.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    car.physics.body.setLinvel({ x: Math.cos(yaw) * 5, y: 0, z: -Math.sin(yaw) * 5 }, true); car.physics.postPhysics();
    const left = emptyInput(); left.move = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };
    world.applyInput(left, 'keyboard'); world.update();
    expect(car.physics.intent.throttle, 'lateral request before full screen-up alignment stays a forward turn').toBeGreaterThan(0);
    expect(car.physics.intent.steer).toBeGreaterThan(0);
    const behind = emptyInput(), heading = car.entity.transform.yaw;
    behind.move = { x: -Math.cos(heading), z: Math.sin(heading) };
    world.applyInput(behind, 'keyboard'); world.update();
    expect(car.physics.intent.throttle, 'a request behind selects reverse').toBeLessThan(0);
    expect(car.physics.braking, 'forward momentum brakes before reversing').toBe(true);
  } finally { world.dispose(); }
}

async function vehicleShovesProps(): Promise<PropSnapshot> {
  const world = new SimWorld(); await world.init(); world.loadScenario('prop-yard');
  try {
    const prop = world.props!.spawn({ id: 'ram-test-wreck', assetId: 'veh.wreck', position: [0, 0, 0], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [-2.2, 0, -.9], max: [2.2, 1.8, .9] } });
    world.props!.updateNavigation();
    const id = world.vehicles!.spawn('vehicle.military-apc', { x: -4.9, z: 0 });
    const car = world.vehicles!.cars.get(id)!; world.vehicles!.active = id;
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
    expect(mission.state.marker).toBe('central-plaza');
    expect(mission.state.steps.depart.status).toBe('pending');
    mission.restore('sanctuary');
    expect(mission.state.marker).toBe('central-plaza');
    expect(mission.state.steps.escape.status).toBe('pending');
    missionControls(world).teleport(1, zoo.door());
    world.tick = zoo.state.startedAt + 3599; advance(1);
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
    expect(mission.state.marker).toBe('arena-flamingo');
    expect(mission.def.steps.find(step => step.id === 'escape')!.text).toMatch(/^Defeat Flamingo flock/);
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
    advance(60);
    missionControls(world).teleport(1, zoo.door());
    world.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); advance(1);
    world.applyInput(emptyInput(), 'keyboard');
    for (let i = 0; i < 24 * 60 && !zoo.canBoardDriver(); i++) advance(1);
    expect(mission.state.states['hale-fallen'], 'the commander beat completes before the cab unlocks').toBe(true);
    missionControls(world).teleport(1, zoo.door());
    world.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); advance(1);
    world.applyInput(emptyInput(), 'keyboard'); advance(60);
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
