// r27-l9apc diagnostic: drive the L9 floor-state APC from the QA pin point (-333, -335) into a pile of infected
// and print what limits it (speed cap, stall, obstacle stops, boarders). Usage: npx tsx tools/qa/diag/l9apcpile.ts [--pile N] [--x X --z Z --yaw Y]
import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { emptyInput } from '../../../src/input/InputFrame';

const arg = (name: string, fallback: number) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : Number(process.argv[i + 1]); };
const pile = arg('--pile', 12), x0 = arg('--x', -333), z0 = arg('--z', -335), yaw = arg('--yaw', .45), ticks = arg('--ticks', 600);
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
  const c = Math.cos(yaw), s = Math.sin(yaw), types = ['infected.runner', 'infected.sprinter', 'infected.brute', 'infected.armored'];
  for (let i = 0; i < pile; i++) {
    const along = car.physics.def.length / 2 + 1 + Math.floor(i / 4) * .8, side = (i % 4 - 1.5) * .8;
    const ix = x0 + c * along + s * side, iz = z0 - s * along + c * side;
    world.infected!.spawn(process.argv.includes('--mixed') ? types[i % types.length] : 'infected.runner', { x: ix, z: iz }, { state: 'chase' });
  }
  const start = { ...car.entity.transform };
  let maxSpeed = 0;
  for (let i = 0; i < ticks; i++) {
    const frame = emptyInput(); frame.drive = { throttle: 1, steer: 0 }; frame.brake = false;
    world.applyInput(frame, 'keyboard'); world.update();
    maxSpeed = Math.max(maxSpeed, car.physics.speed);
    if (i % 30 === 0) {
      const p = car.entity.transform, st = car.entity.vehicle!;
      const near = world.infected!.active.filter(e => e.health.current > 0 && car.physics.hullDistance(e.transform.x, e.transform.z) < 1.2).length;
      console.log(JSON.stringify({ t: i, x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(2), speed: +car.physics.speed.toFixed(2), cap: +car.physics.speedCap.toFixed(2), thr: car.physics.intent.throttle, brake: car.physics.intent.brake, stall: st.impactStallUntil, hold: l9.driving.holding(car.entity.id), attached: st.attached.length, near, hp: car.entity.health.current, wheels: car.physics.wheels.map(w => w.contact ? 1 : 0).join('') }));
    }
  }
  if (process.argv.includes('--contacts')) {
    const pw = world.physics.world!;
    pw.contactPairsWith(car.physics.collider, other => {
      pw.contactPair(car.physics.collider, other, m => {
        const t = other.translation(), h = (other.shape as unknown as { halfExtents?: { x: number; y: number; z: number } }).halfExtents;
        console.log('contact', JSON.stringify({ handle: other.handle, at: t, half: h, normal: m.normal(), n: m.numContacts(), parent: other.parent()?.bodyType() }));
      });
    });
    for (const [id, boxes] of vehicles.wrecks) console.log('wreck', id, JSON.stringify(boxes.filter(b => Math.hypot(b.x - x0, b.z - z0) < 15)));
    for (const o of vehicles.obstacles.items) if (Math.hypot(o.entity.transform.x - x0, o.entity.transform.z - z0) < 15) console.log('obstacle', o.entity.id, o.entity.archetype, JSON.stringify(o.entity.transform), o.halfX, o.halfZ, o.light);
    for (const other of vehicles.cars.values()) if (other !== car && Math.hypot(other.entity.transform.x - x0, other.entity.transform.z - z0) < 20) console.log('car', other.entity.id, other.entity.archetype, JSON.stringify(other.entity.transform), other.entity.hidden);
  }
  console.log(JSON.stringify({ progress: Math.hypot(car.entity.transform.x - start.x, car.entity.transform.z - start.z), maxSpeed }));
} finally { world.dispose(); }
