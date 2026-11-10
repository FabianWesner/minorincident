// r29-l9pin diagnostic: floor-state L9 APC inside a dense mixed pack (~50 infected incl. heavies) with boarders on the hull,
// holding forward or reverse. Default pose = r28-vqa pin (-265.7, -15.4, yaw 1.45, nose at the yard fence).
// Usage: npx tsx tools/qa/diag/l9apcpack.ts [--pack 50] [--boarders 4] [--throttle 1|-1] [--steer S] [--seconds 30] [--x X --z Z --yaw Y] [--every 60]
import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { emptyInput } from '../../../src/input/InputFrame';

const arg = (name: string, fallback: number) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : Number(process.argv[i + 1]); };
const pack = arg('--pack', 50), boardersWanted = arg('--boarders', 4), throttle = arg('--throttle', 1), steer = arg('--steer', 0);
const x0 = arg('--x', -265.7), z0 = arg('--z', -15.4), yaw = arg('--yaw', 1.45), seconds = arg('--seconds', 30), every = arg('--every', 60);
const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, vehicles = world.vehicles!, car = vehicles.cars.get(l9.state.carId)!;
  world.missions!.begin();
  for (let i = 0; i < 5; i++) world.update();
  vehicles.damage(car.entity.id, car.entity.health.max);
  const pose = { x: x0, z: z0, y: car.physics.def.suspension + car.physics.def.wheelRadius + .15, yaw };
  Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose); car.physics.body.setTranslation(pose, true);
  car.physics.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true); car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  for (let i = 0; i < 30; i++) world.update();
  const c = Math.cos(yaw), s = Math.sin(yaw), L = car.physics.def.length / 2, W = car.physics.def.width / 2;
  const local = (along: number, side: number) => ({ x: x0 + c * along + s * side, z: z0 - s * along + c * side });
  // The r28-vqa crowd: mostly runners/dogs/sprinters/screamers with zoo zebras and a few heavies.
  const mix = ['infected.runner', 'infected.dog', 'infected.sprinter', 'infected.runner', 'infected.screamer', 'infected.zebra', 'infected.runner', 'infected.brute', 'infected.dog', 'infected.armored'];
  let spawned = 0;
  for (let ring = 0; spawned < pack; ring++) {
    const gap = .9 + ring * .9, per = Math.floor(2 * (2 * L + 2 * W + 4 * gap) / 1.0);
    for (let k = 0; k < per && spawned < pack; k++) {
      const t = k / per * 2 * (2 * L + 2 * W + 4 * gap), hx = L + gap, hz = W + gap;
      let along: number, side: number;
      if (t < 2 * hx) { along = -hx + t; side = hz; } else if (t < 2 * hx + 2 * hz) { along = hx; side = hz - (t - 2 * hx); }
      else if (t < 4 * hx + 2 * hz) { along = hx - (t - 2 * hx - 2 * hz); side = -hz; } else { along = -hx; side = -hz + (t - 4 * hx - 2 * hz); }
      world.infected!.spawn(mix[spawned % mix.length], local(along, side), { state: 'chase' }); spawned++;
    }
  }
  // Boarders: runners right at the flanks (the alongside rule attaches them on the next tick).
  for (let i = 0; i < boardersWanted; i++) world.infected!.spawn('infected.runner', local(-L * .5 + (i >> 1) * .8, (i % 2 ? 1 : -1) * (W + .35)), { state: 'chase' });
  for (let i = 0; i < 3; i++) world.update();
  const state = car.entity.vehicle!, start = { ...car.entity.transform };
  let maxSpeed = 0, recoveries = 0, stalls = 0, lastStall = state.impactStallUntil ?? 0;
  world.events.on('vehicle.recovering', () => { recoveries++; });
  const marks: number[] = [];
  for (let i = 0; i < seconds * 60; i++) {
    const frame = emptyInput(); frame.drive = { throttle, steer }; frame.brake = false;
    world.applyInput(frame, 'keyboard'); world.update();
    if ((state.impactStallUntil ?? 0) !== lastStall) { stalls++; lastStall = state.impactStallUntil ?? 0; }
    maxSpeed = Math.max(maxSpeed, car.physics.speed);
    if (i % 60 === 59) marks.push(+Math.hypot(car.entity.transform.x - start.x, car.entity.transform.z - start.z).toFixed(2));
    if (every > 0 && i % every === 0) {
      const p = car.entity.transform;
      const near = world.infected!.active.filter(e => e.health.current > 0 && !e.attachedTo && car.physics.hullDistance(e.transform.x, e.transform.z) < 1).length;
      console.log(JSON.stringify({ t: i, x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(2), speed: +car.physics.speed.toFixed(2), fwd: +car.physics.forwardSpeed.toFixed(2), cap: +car.physics.speedCap.toFixed(2), thr: +car.physics.intent.throttle.toFixed(2), brake: car.physics.intent.brake, stall: (state.impactStallUntil ?? 0) > world.tick, rec: state.recoveringUntil > world.tick, attached: state.attached.length, near, alive: world.infected!.active.filter(e => e.health.current > 0).length, player: world.entities.get(1)!.health.current }));
    }
  }
  console.log(JSON.stringify({ throttle, steer, pack: spawned, boarders: boardersWanted, progress: +Math.hypot(car.entity.transform.x - start.x, car.entity.transform.z - start.z).toFixed(2), perSecond: marks.slice(0, 10), maxSpeed: +maxSpeed.toFixed(2), heavyStalls: stalls, recoveries, player: world.entities.get(1)!.health.current }));
} finally { world.dispose(); }
