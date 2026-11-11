// r34-l9qa: the L9 bridge crawl must finish for a player who lets go inside the ring. The bot drives to the crash; once the crawl
// is under way, forward input is given until progress reaches `--stop` (default 0.5), then NO input at all.
// Usage: node --import tsx/esm tools/qa/diag/l9crawl.ts [--stop 0.5] [--seed 1]
import { loadLevel } from '../../sim-runner/levels';
import { emptyInput } from '../../../src/input/InputFrame';
import { LevelNineBot } from '../../../src/debug/bot/LevelNineBot';
import { preset } from '../../../src/sim/progression/Campaign';
const arg = (n: string, f: string) => { const i = process.argv.indexOf(n); return i < 0 ? f : process.argv[i + 1]; };
const stop = Number(arg('--stop', '0.5')), seed = Number(arg('--seed', '1'));
const world = await loadLevel('L9', seed, preset('L9-default'), 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, 'road', true);
  let lengthM = 0, crawlStart = -1, idleFrom = -1, finishedAt = -1;
  for (let i = 0; i < 600 * 60 && finishedAt < 0 && world.entities.get(1)!.health.current > 0; i++) {
    const crawl = l9.state.phase === 'crawl';
    if (crawl && crawlStart < 0) { crawlStart = world.tick; const a = world.missions!.def.anchors; const s0 = a[l9.state.crawlAnchor], e0 = a['crawl-end']; lengthM = Math.hypot(e0.x - s0.x, e0.z - s0.z); }
    const idle = crawl && (l9.state.crawlProgress ?? 0) >= stop;
    if (idle && idleFrom < 0) idleFrom = world.tick;
    world.applyInput(idle ? emptyInput() : bot.sample(), 'keyboard'); world.update();
    if (l9.state.finished || l9.state.phase === 'done') finishedAt = world.tick;
  }
  console.log(JSON.stringify({ stop, crawlLengthM: +lengthM.toFixed(1), crawlStartS: +(crawlStart / 60).toFixed(1), idleFromS: idleFrom < 0 ? null : +(idleFrom / 60).toFixed(1), finishedS: finishedAt < 0 ? null : +(finishedAt / 60).toFixed(1), idleToFinishS: finishedAt < 0 || idleFrom < 0 ? null : +((finishedAt - idleFrom) / 60).toFixed(1), phase: l9.state.phase, progress: l9.state.crawlProgress }));
} finally { world.dispose(); }
