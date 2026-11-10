// r29-l9pin diagnostic: run the production L9 bot on the --zero fixture to a tick, then list what touches the APC hull
// (Rapier contact pairs, the bus, nearby cars). Usage: npx tsx tools/qa/diag/l9zerocontacts.ts --at 13600
import { loadLevel } from '../../sim-runner/levels';
import { LevelNineBot } from '../../../src/debug/bot/LevelNineBot';
import { preset } from '../../../src/sim/progression/Campaign';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const at = Number(arg('--at', '13600'));
const save = preset('L9-default'); save.settings.quality = 'low';
const world = await loadLevel('L9', 1, save, 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, 'road', true), car = world.vehicles!.cars.get(l9.state.carId)!;
  world.vehicles!.damage(car.entity.id, car.entity.health.max);
  while (world.tick < at) { world.applyInput(bot.sample(), 'keyboard'); world.update(); }
  const p = car.entity.transform;
  console.log('apc', JSON.stringify({ x: p.x, z: p.z, yaw: p.yaw, speed: car.physics.speed, wheels: car.physics.wheels.map(w => w.contact ? 1 : 0).join('') }));
  const pw = world.physics.world!;
  pw.contactPairsWith(car.physics.collider, other => {
    pw.contactPair(car.physics.collider, other, m => {
      if (!m.numContacts()) return;
      const t = other.translation(), h = (other.shape as unknown as { halfExtents?: { x: number; y: number; z: number } }).halfExtents;
      console.log('contact', JSON.stringify({ handle: other.handle, at: t, half: h, normal: m.normal(), n: m.numContacts(), body: other.parent()?.bodyType() }));
    });
  });
  for (const other of world.vehicles!.cars.values()) if (other !== car && Math.hypot(other.entity.transform.x - p.x, other.entity.transform.z - p.z) < 15)
    console.log('car', other.entity.id, other.entity.archetype, JSON.stringify(other.entity.transform), 'gap', car.physics.hullDistance(other.entity.transform.x, other.entity.transform.z).toFixed(2), other.entity.hidden);
  for (const [id, boxes] of world.vehicles!.wrecks) for (const b of boxes) if (Math.hypot(b.x - p.x, b.z - p.z) < 8) console.log('wreck', id, JSON.stringify(b));
  for (const o of world.vehicles!.obstacles.items) if (Math.hypot(o.entity.transform.x - p.x, o.entity.transform.z - p.z) < 8) console.log('obstacle', o.entity.id, o.entity.archetype, JSON.stringify(o.entity.transform), o.halfX, o.halfZ, o.broken);
} finally { world.dispose(); }
