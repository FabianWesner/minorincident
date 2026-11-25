// L9 scripted ending timing probe. The bot drives to the crash and observes the no-input finale.
// Usage: node --import tsx/esm tools/qa/diag/l9crawl.ts [--seed 1]
import { loadLevel } from '../../sim-runner/levels';
import { LevelNineBot } from '../../../src/debug/bot/LevelNineBot';
import { preset } from '../../../src/sim/progression/Campaign';
const arg = (n: string, f: string) => { const i = process.argv.indexOf(n); return i < 0 ? f : process.argv[i + 1]; };
const seed = Number(arg('--seed', '1'));
const world = await loadLevel('L9', seed, preset('L9-default'), 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, 'road', true);
  let endingStart = -1, finishedAt = -1;
  for (let i = 0; i < 600 * 60 && finishedAt < 0 && world.entities.get(1)!.health.current > 0; i++) {
    if (l9.state.phase === 'dazed' && endingStart < 0) endingStart = world.tick;
    world.applyInput(bot.sample(), 'keyboard'); world.update();
    if (l9.state.finished || l9.state.phase === 'done') finishedAt = world.tick;
  }
  console.log(JSON.stringify({ endingStartS: endingStart < 0 ? null : +(endingStart / 60).toFixed(1), finishedS: finishedAt < 0 ? null : +(finishedAt / 60).toFixed(1), phase: l9.state.phase }));
} finally { world.dispose(); }
