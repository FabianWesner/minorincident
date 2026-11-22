import { emptyInput } from '../../../src/input/InputFrame';
import { preset } from '../../../src/sim/progression/Campaign';
import { loadLevel } from '../../sim-runner/levels';

const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
try {
  world.missions!.begin();
  const car = world.vehicles!.cars.get(world.missions!.l9!.state.carId)!;
  const x = 60, z = -325 - 10 / 60, yaw = Math.atan2(5, 300);
  const pose = { x, z, y: car.physics.def.suspension + car.physics.def.wheelRadius + .15, yaw };
  Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose);
  car.physics.body.setTranslation(pose, true); car.physics.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
  car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  for (let i = 0; i < 30; i++) world.update();
  const ids: number[] = [];
  for (let i = 0; i < 12; i++) {
    const id = world.infected!.spawn('infected.runner', { x: x + 8 + i * 1.5, z: z + 4 }, { state: 'chase' });
    const e = world.entities.get(id)!; ids.push(id);
    e.health.current = 0; e.corpse = true; e.squashed = true;
    e.infected!.state = 'dead'; e.infected!.recoverAt = -1; e.infected!.deadAt = world.tick;
    e.transform.x = x + 5 + Math.floor(i / 3) * .5; e.transform.z = z + (i % 3 - 1) * .4;
    world.spatial.set(id, e.transform.x, e.transform.z);
  }
  const speed = car.physics.def.topSpeed * .8;
  car.physics.body.setLinvel({ x: speed * Math.cos(yaw), y: 0, z: -speed * Math.sin(yaw) }, true); car.physics.postPhysics();
  const drive = emptyInput(); drive.drive = { throttle: 1, steer: 0 }; drive.brake = false;
  let minSpeed = Infinity, maxTilt = 0;
  const overlapped = new Set<number>();
  for (let i = 0; i < 180; i++) {
    world.applyInput(drive, 'keyboard'); world.update();
    for (const id of ids) { const e = world.entities.get(id)!; if (car.physics.hullDistance(e.transform.x, e.transform.z) <= 0) overlapped.add(id); }
    if (i < 60) minSpeed = Math.min(minSpeed, car.physics.speed);
    const q = car.physics.body.rotation(); maxTilt = Math.max(maxTilt, Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (q.x * q.x + q.z * q.z)))));
  }
  const retained = ids.filter(id => world.entities.get(id)?.corpse && world.entities.get(id)?.squashed).length;
  const result = { count: ids.length, overlapped: overlapped.size, retained, entrySpeed: speed, minSpeed, endSpeed: car.physics.speed, progress: Math.hypot(car.entity.transform.x - x, car.entity.transform.z - z), maxTiltDeg: maxTilt * 180 / Math.PI, upsideDown: car.physics.upsideDown };
  console.log(JSON.stringify(result, null, 2));
  if (retained !== 12 || overlapped.size < 10 || result.progress < 15 || minSpeed < speed * .5 || result.upsideDown || result.maxTiltDeg > 30) process.exitCode = 1;
} finally { world.dispose(); }
