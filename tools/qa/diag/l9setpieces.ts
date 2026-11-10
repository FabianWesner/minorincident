// r32-l9fun diagnostic: print every L9 set-piece Alpha's phase change along a skilled bot drive.
// Usage: node --import tsx/esm tools/qa/diag/l9setpieces.ts [road|countryside|dry-shortcut] [--risky] [--seconds 130]
import { loadLevel } from '../../sim-runner/levels';
import { LevelNineBot } from '../../../src/debug/bot/LevelNineBot';
import { preset } from '../../../src/sim/progression/Campaign';

const route = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'road';
const i = process.argv.indexOf('--seconds'), seconds = i < 0 ? 130 : Number(process.argv[i + 1]);
const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, route, !process.argv.includes('--risky'));
  let last = '';
  world.events.on('combat.hit', e => {
    if (e.type !== 'combat.hit') return;
    const t = world.entities.get(e.targetId);
    if (t?.infected?.alphaType) console.log((world.tick / 60).toFixed(2), 'hit', JSON.stringify(e).slice(0, 260));
  });
  for (let t = 0; t < seconds * 60; t++) {
    world.applyInput(bot.sample(), 'keyboard'); world.update();
    const sp = l9.driving.state.setPieces; if (!sp) continue;
    const car = world.entities.get(l9.state.carId)!;
    const line = sp.alphas.map(a => { const e = world.entities.get(a.id)!; return `${a.role[0]}${a.id}:${a.phase}:${a.uses} hp${Math.round(e.health.current)} att${e.attachedTo ?? '-'}`; }).join(' | ');
    if (line !== last) { console.log((world.tick / 60).toFixed(2), `apc(${car.transform.x.toFixed(0)},${car.transform.z.toFixed(0)}) v${world.vehicles!.cars.get(car.id)!.physics.speed.toFixed(1)}`, line); last = line; }
  }
} finally { world.dispose(); }
