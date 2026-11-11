// r33-l9polish: why is the APC not moving at time T? Prints vehicle state and what is within 6 m (infected, obstacles, cars).
// Usage: node --import tsx/esm tools/qa/diag/l9stuck.ts <seconds> [--seed 2] [--route road]
import { loadLevel } from '../../sim-runner/levels';
import { LevelNineBot } from '../../../src/debug/bot/LevelNineBot';
import { preset } from '../../../src/sim/progression/Campaign';
const arg = (n: string, f: string) => { const i = process.argv.indexOf(n); return i < 0 ? f : process.argv[i + 1]; };
const at = Number(process.argv[2]), seed = Number(arg('--seed', '2')), route = arg('--route', 'road');
const world = await loadLevel('L9', seed, preset('L9-default'), 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, route, true), car = world.vehicles!.cars.get(l9.state.carId)!;
  for (let t = 0; t < at * 60; t++) { world.applyInput(bot.sample(), 'keyboard'); world.update(); }
  const p = car.entity.transform, v = car.entity.vehicle!, s = l9.driving.state;
  console.log('t', world.tick / 60, 'apc', p.x.toFixed(2), p.z.toFixed(2), 'yaw', p.yaw.toFixed(2), 'speed', car.physics.speed.toFixed(2), 'stallUntil', v.impactStallUntil, 'tick', world.tick,
    'attached', v.attached.length, 'holding', l9.driving.holding(car.entity.id), 'restarted', s.restarted, 'stallAt', s.stallAt, 'busStoppedAt', s.busStoppedAt, 'busRams', s.busRams, 'stuck', car.physics.stuck);
  for (const e of world.entities.iterate()) {
    const d = Math.hypot(e.transform.x - p.x, e.transform.z - p.z);
    if (d < 7 && e.id !== car.entity.id && e.id !== 1) console.log(' near', d.toFixed(1), e.kind, e.archetype, e.infected?.alphaType ?? '', 'hp', e.health?.current, 'att', e.attachedTo ?? '', 'y', e.transform.y.toFixed(2), 'hidden', !!e.hidden);
  }
} finally { world.dispose(); }
