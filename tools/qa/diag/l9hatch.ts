// r33-l9polish: rail-stall hatch pressure. The bot drives to the stall, then a PASSIVE courier (no input at all) sits at the hatch:
// time from the first boarder grab to courier death, and boarders on the hull per second. Usage: [--seed 1] [--route road] [--shoot]
import { loadLevel } from '../../sim-runner/levels';
import { emptyInput } from '../../../src/input/InputFrame';
import { LevelNineBot } from '../../../src/debug/bot/LevelNineBot';
import { preset } from '../../../src/sim/progression/Campaign';
const arg = (n: string, f: string) => { const i = process.argv.indexOf(n); return i < 0 ? f : process.argv[i + 1]; };
const route = arg('--route', 'road'), seed = Number(arg('--seed', '1')), shoot = process.argv.includes('--shoot');
const world = await loadLevel('L9', seed, preset('L9-default'), 0, { quality: 'low' });
try {
  if (process.argv.includes('--god')) world.combat!.damage.god = true; // r34-l9qa: god must also hold against hatch boarders
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, route, true), car = world.vehicles!.cars.get(l9.state.carId)!;
  const hp = () => world.entities.get(1)!.health.current;
  let stallT = -1, firstGrab = -1, dead = -1; const rows: string[] = [];
  for (let i = 0; i < 400 * 60 && world.missions!.state.phase !== 'result'; i++) {
    const input = bot.sample();
    const passive = l9.driving.state.stallAt !== null && !l9.driving.state.restarted;
    world.applyInput(passive && !shoot ? Object.assign(emptyInput(), { brake: true }) : input, 'keyboard'); world.update();
    if (stallT < 0 && l9.driving.state.stallAt !== null) stallT = world.tick / 60;
    if (passive) {
      const att = car.entity.vehicle!.attached.length;
      if (firstGrab < 0 && att > 0) firstGrab = world.tick / 60;
      if (world.tick % 60 === 0) rows.push(`t=${(world.tick / 60 - stallT).toFixed(0).padStart(3)} boarders=${att} hp=${hp().toFixed(0)} apc=${car.entity.health.current.toFixed(0)}`);
      if (dead < 0 && hp() <= 0) { dead = world.tick / 60; break; }
    }
    if (l9.driving.state.restarted) break;
  }
  console.log(rows.join('\n'));
  console.log(JSON.stringify({ route, seed, shoot, stallT: +stallT.toFixed(1), firstGrabAfterStall: +(firstGrab - stallT).toFixed(1), deadAfterFirstGrab: dead < 0 ? null : +(dead - firstGrab).toFixed(1), hpEnd: hp() }));
} finally { world.dispose(); }
