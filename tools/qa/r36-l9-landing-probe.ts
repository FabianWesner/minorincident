// r36-l9l5: native probe of the L9 ramp landings. For every ramp and a set of approach speeds (floored APC ~9-10 m/s up to full speed)
// drive at full throttle from 25 m before the ramp and report the airtime, where the hull lands, and how long it then sits below 1.5 m/s
// within 6 s of touching down (the r35-vqa 'nose-first in the landing block, 0.1 m/s for 3 s' defect).
// Usage: node --import tsx/esm tools/qa/r36-l9-landing-probe.ts [--ramp overpass] [--speeds 7,9.5,12,15]
import { l9Course } from '../../src/data/l9';
import { emptyInput } from '../../src/input/InputFrame';
import { preset } from '../../src/sim/progression/Campaign';
import { loadLevel } from '../sim-runner/levels';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const only = arg('--ramp', ''), speeds = arg('--speeds', '7,9.5,12,15').split(',').map(Number);
for (const ramp of l9Course.ramps) {
  if (only && ramp.id !== only) continue;
  for (const v0 of speeds) {
    const world = await loadLevel('L9', 1, preset('L9-default'));
    try {
      const car = world.vehicles!.cars.get(world.missions!.l9!.state.carId)!, player = world.entities.get(1)!;
      if (process.argv.includes('--zero')) world.vehicles!.damage(car.entity.id, car.entity.health.max);
      const pose = { x: ramp.x - 25, y: car.entity.transform.y, z: ramp.z, yaw: 0 };
      Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose); Object.assign(player.transform, pose);
      car.physics.body.setTranslation(pose, true); car.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      car.physics.body.setLinvel({ x: v0, y: 0, z: 0 }, true); car.physics.postPhysics();
      world.physics.playerBody!.setTranslation(pose, true); world.spatial.set(1, pose.x, pose.z);
      let airStart = -1, airEnd = -1, landX = NaN, slowTicks = 0, maxX = pose.x, maxY = 0, pitchMax = 0;
      for (let i = 0; i < 60 * 14; i++) {
        const frame = emptyInput(); frame.drive = { throttle: 1, steer: 0 };
        world.applyInput(frame, 'keyboard'); world.update();
        const p = car.entity.transform, flying = car.physics.wheels.every(wheel => !wheel.contact);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        if (flying && airStart < 0 && p.x > ramp.x) airStart = i;
        if (!flying && airStart >= 0 && airEnd < 0) { airEnd = i; landX = p.x; }
        if (airEnd >= 0 && i - airEnd < 360 && car.physics.speed < 1.5) slowTicks++;
        if (airEnd >= 0 && i - airEnd < 120) { const r = car.physics.body.rotation(); pitchMax = Math.max(pitchMax, Math.abs(2 * Math.asin(Math.max(-1, Math.min(1, r.z))))); }
        if (process.argv.includes('--trace') && i % 15 === 0 && p.x > ramp.x - 8) console.log(i, (p.x - ramp.x).toFixed(1), p.y.toFixed(2), car.physics.speed.toFixed(1), flying ? 'air' : '');
        if (p.x > ramp.x + 28) break;
      }
      console.log(JSON.stringify({ ramp: ramp.id, v0, airTicks: airEnd < 0 ? 0 : airEnd - airStart, landDx: Math.round(landX - ramp.x), maxDx: Math.round(maxX - ramp.x), maxY: +maxY.toFixed(2), slowTicksAfterLanding: slowTicks, pitchDeg: Math.round(pitchMax * 180 / Math.PI), dur: car.entity.health.current }));
    } finally { world.dispose(); }
  }
}
