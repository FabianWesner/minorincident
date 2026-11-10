import { loadLevel } from '../sim-runner/levels';
import { LevelNineBot } from '../../src/debug/bot/LevelNineBot';
import { preset } from '../../src/sim/progression/Campaign';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const route = arg('--route', 'road'), risky = process.argv.includes('--risky');
const save = preset('L9-default'); save.settings.quality = 'low';
const world = await loadLevel('L9', 1, save, 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, route, !risky), car = world.vehicles!.cars.get(l9.state.carId)!;
  let last = -1;
  for (let i = 0; i < 600 * 60 && !l9.driving.state.evacuationDone; i++) {
    world.applyInput(bot.sample(), 'keyboard'); world.update();
    const at = l9.driving.state.evacuationAt;
    if (at !== null && (world.tick - at) % 300 === 0 && world.tick !== last && world.tick - at < 3600) {
      last = world.tick;
      const corgi = [...world.entities.iterate()].find(e => e.companion)!, door = world.vehicles!.passengerDoor(car.entity.id);
      const nav = world.infected!.nav, r = corgi.combat?.radius ?? 0.3;
      console.log(JSON.stringify({ t: ((world.tick - at) / 60).toFixed(0), apc: { x: +car.entity.transform.x.toFixed(2), z: +car.entity.transform.z.toFixed(2), yaw: +car.entity.transform.yaw.toFixed(2), dur: car.entity.health.current },
        door: { x: +door.x.toFixed(2), z: +door.z.toFixed(2) }, corgi: { x: +corgi.transform.x.toFixed(2), z: +corgi.transform.z.toFixed(2), r, d: +Math.hypot(corgi.transform.x - door.x, corgi.transform.z - door.z).toFixed(2), po: corgi.passengerOf },
        navDoorClear: nav.clear(door.x, door.z, r), navDoorContains: nav.contains(door.x, door.z, r), solidDoorClear: world.solids.clear({ x: door.x, y: corgi.transform.y, z: door.z }, r, corgi.id, false),
        navCorgiContains: nav.contains(corgi.transform.x, corgi.transform.z, r) }));
    }
  }
} finally { world.dispose(); }
