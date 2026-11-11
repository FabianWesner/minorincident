// r36-l9l5: native probe of the L9 bridge crawl: who stands near the crawling courier, in which AI state, and does anyone hit her.
// Usage: node --import tsx/esm tools/qa/r36-l9-crawl-probe.ts [fixture] [--hold] (--hold keeps the crawl input off to test the idle case)
import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel } from '../sim-runner/levels';
import { LevelNineBot } from '../../src/debug/bot/LevelNineBot';
import { emptyInput } from '../../src/input/InputFrame';
import { readFixture } from './fixture-io';
const f = readFixture(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'tests/fixtures/saves/qa/l9-at-bridge.json.br');
const d = decodeSave(JSON.stringify(f.campaign)); if (d.status !== 'ok') throw new Error('decode');
const world = await loadLevel('L9', 1, d.save);
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, 'road', true), hold = process.argv.includes('--hold');
  const player = world.entities.get(1)!;
  let hpLost = 0, last = player.health.current, crawlAt = -1;
  const report = (tag: string) => {
    const p = player.transform;
    const near = [...world.entities.iterate()].filter(e => e.infected && e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 6)
      .map(e => `${e.archetype.replace('infected.', '')}:${e.infected!.state}:${Math.hypot(e.transform.x - p.x, e.transform.z - p.z).toFixed(1)}`);
    console.log(tag, JSON.stringify({ tick: world.tick, phase: l9.state.phase, progress: +(l9.state.crawlProgress ?? 0).toFixed(2), hp: player.health.current, hpLost, pos: [p.x, p.z].map(v => +v.toFixed(1)), near }));
  };
  for (let i = 0; i < 60 * 240 && !l9.state.finished; i++) {
    const fr = l9.state.phase === 'crawl' ? emptyInput() : bot.sample();
    if (l9.state.phase === 'crawl' && !hold) fr.move = { x: 1, z: 0 };
    world.applyInput(fr, 'keyboard'); world.update();
    if (player.health.current < last) hpLost += last - player.health.current; last = player.health.current;
    if (l9.state.phase === 'crawl' && crawlAt < 0) { crawlAt = world.tick; report('crawl-start'); }
    if (crawlAt >= 0 && (world.tick - crawlAt) % 300 === 0) report('crawl+' + (world.tick - crawlAt));
    if (i % 600 === 0 && l9.state.phase !== 'crawl') report('t');
  }
  report('end');
} finally { world.dispose(); }
