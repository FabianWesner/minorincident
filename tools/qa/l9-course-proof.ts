import { mkdirSync, writeFileSync } from 'node:fs';
import { l9Course } from '../../src/data/l9';
import { emptyInput } from '../../src/input/InputFrame';
import { preset } from '../../src/sim/progression/Campaign';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';

// Explicit initial-pose fixtures isolate native ramp geometry. These are not
// claims about an ordinary route or player difficulty; movement after setup is
// production drive input, suspension, gravity and collision, never scriptPose.
const rows = [];
for (const ramp of l9Course.ramps) for (const fast of [true, false]) {
  const world = await loadLevel('L9', 1, preset('L9-default'));
  try {
    const car = world.vehicles!.cars.get(world.missions!.l9!.state.carId)!, player = world.entities.get(1)!;
    const pose = { x: ramp.x - (fast ? 20 : 10), y: car.entity.transform.y, z: ramp.z, yaw: 0 };
    Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose); Object.assign(player.transform, pose);
    car.physics.body.setTranslation(pose, true); car.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    car.physics.body.setLinvel({ x: fast ? 14 : 3, y: 0, z: 0 }, true); car.physics.postPhysics();
    world.physics.playerBody!.setTranslation(pose, true); world.spatial.set(1, pose.x, pose.z);
    const samples = []; let maxY = pose.y, maxX = pose.x, airTicks = 0;
    for (let i = 0; i < 600; i++) {
      const frame = emptyInput(); frame.drive = { throttle: fast ? .7 : .1, steer: 0 };
      world.applyInput(frame, 'keyboard'); world.update();
      const p = car.entity.transform; maxY = Math.max(maxY, p.y); maxX = Math.max(maxX, p.x);
      if (car.physics.wheels.every(wheel => !wheel.contact)) airTicks++;
      if (i % 10 === 0) samples.push({ tick: world.tick, p: { ...p }, speed: car.physics.speed, wheels: car.physics.wheels.map(wheel => wheel.contact) });
      if (p.x > ramp.x + 25 && p.y < 1.8) break;
    }
    const cleared = maxX > ramp.x + 25, passed = fast ? cleared && maxY > 2 && airTicks > 3 : !cleared;
    rows.push({ ramp: ramp.id, fast, initial: pose, initialSpeed: fast ? 14 : 3, maxX, maxY, airTicks, cleared, passed, durability: car.entity.health.current, collision: world.solids.snapshot(), samples });
    console.log(JSON.stringify({ ramp: ramp.id, fast, cleared, passed, maxY, airTicks, final: car.entity.transform }));
  } finally { world.dispose(); }
}
mkdirSync('test-results/eg-l9', { recursive: true });
writeFileSync('test-results/eg-l9/course.json', `${JSON.stringify({ ...provenance(), method: 'Initial-pose native Rapier fixtures, then ordinary drive input; high-speed jump and low-speed blockage on each authored ramp.', rows }, null, 2)}\n`);
if (rows.some(row => !row.passed || row.collision.failures)) process.exitCode = 1;
