// Vehicle core: one Rapier vehicle body and one enter/drive/exit flow serve the bike, cars, bus, APC and tank in five levels.
import { expect, test } from 'vitest';
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
});

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
    mission.setState('breached', true); zoo.state.breachedAt = world.tick; zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
    missionControls(world).teleport(1, zoo.door());
    world.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); advance(1);
    expect(vehicles.active, 'courier can keep covering passengers instead of boarding early').toBeNull();
    expect(objectiveText(mission, mission.def.steps[0].text)).toMatch(/Cover.*aboard/);
    world.applyInput(emptyInput(), 'keyboard'); advance(60);
    expect(vehicles.active, 'standing at the door does not remove cover fire either').toBeNull();
    missionControls(world).teleport(1, { x: zoo.door().x - 4, z: zoo.door().z + 2 });
    const car = vehicles.cars.get(zoo.state.carId)!, entry = vehicles.passengerDoor(car.entity.id);
    for (const id of zoo.passengers()) {
      missionControls(world).teleport(id, entry);
      expect(vehicles.boardPassenger(car.entity.id, id)).toBe(true);
    }
    advance(60);
    missionControls(world).teleport(1, zoo.door());
    world.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); advance(1);
    world.applyInput(emptyInput(), 'keyboard'); advance(60);
    expect(zoo.canDrive(), 'complete living group boards at the fixed destination').toBe(true);
    const save = preset('L9-default'); save.transport = vehicles.transfer(car.entity.id);
    const next = await loadLevel('L9', 1, save);
    try {
      const arrived = next.vehicles!.cars.get(car.entity.id)!, start = { ...arrived.entity.transform };
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
