// r33-l9polish: per-hit APC durability trace (time, source, amount, durability after) with LevelNineBot.
// Usage: node --import tsx/esm tools/qa/diag/l9damage.ts [--route road|countryside] [--risky] [--seed 1] [--rows]
import { loadLevel } from '../../sim-runner/levels';
import { LevelNineBot } from '../../../src/debug/bot/LevelNineBot';
import { preset } from '../../../src/sim/progression/Campaign';
const arg = (n: string, f: string) => { const i = process.argv.indexOf(n); return i < 0 ? f : process.argv[i + 1]; };
const route = arg('--route', 'road'), risky = process.argv.includes('--risky'), seed = Number(arg('--seed', '1'));
const world = await loadLevel('L9', seed, preset('L9-default'), 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, route, !risky), car = world.vehicles!.cars.get(l9.state.carId)!;
  const rows: string[] = []; const by: Record<string, number> = {}; let stallT = -1;
  world.events.on('vehicle.durability-hit', e => {
    if (e.type !== 'vehicle.durability-hit') return;
    const who = world.entities.get(e.targetId), key = `${e.source}:${who?.archetype ?? '?'}${who?.infected?.alphaType ? `:${who.infected.alphaType}` : ''}`;
    const held = l9.driving.holding(car.entity.id) ? 'H' : ' ';
    rows.push(`${(world.tick / 60).toFixed(1).padStart(6)} ${held} -${(e.before - e.after).toFixed(0).padStart(3)} -> ${e.after.toFixed(0).padStart(4)} v=${car.physics.speed.toFixed(1)} x=${car.entity.transform.x.toFixed(0)} ${key}`);
    by[`${held}${key}`] = (by[`${held}${key}`] ?? 0) + e.before - e.after;
  });
  let atBay = -1;
  for (let i = 0; i < 600 * 60 && world.missions!.state.phase !== 'progression' && world.missions!.state.phase !== 'result' && world.entities.get(1)!.health.current > 0; i++) {
    world.applyInput(bot.sample(), 'keyboard'); world.update();
    if (atBay < 0 && l9.driving.state.evacuationAt !== null) atBay = car.entity.health.current;
    if (stallT < 0 && l9.driving.state.stallAt !== null) stallT = world.tick / 60;
  }
  if (process.argv.includes('--rows')) console.log(rows.join('\n'));
  console.log(JSON.stringify({ route, risky, seed, done: l9.state.finished, t: +(world.tick / 60).toFixed(1), stallT, armourAtBay: atBay, by }, null, 1));
} finally { world.dispose(); }
