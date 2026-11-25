// Retired crawl probe. Kept as a compatibility entry point for old QA scripts; reports the scripted finale phases.
import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel } from '../sim-runner/levels';
import { LevelNineBot } from '../../src/debug/bot/LevelNineBot';
import { readFixture } from './fixture-io';
const f = readFixture(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'tests/fixtures/saves/qa/l9-at-bridge.json.br');
const d = decodeSave(JSON.stringify(f.campaign)); if (d.status !== 'ok') throw new Error('decode');
const world = await loadLevel('L9', 1, d.save);
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, 'road', true);
  const player = world.entities.get(1)!;
  let hpLost = 0, last = player.health.current, endingAt = -1;
  const report = (tag: string) => {
    const p = player.transform;
    const near = [...world.entities.iterate()].filter(e => e.infected && e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 6)
      .map(e => `${e.archetype.replace('infected.', '')}:${e.infected!.state}:${Math.hypot(e.transform.x - p.x, e.transform.z - p.z).toFixed(1)}`);
    console.log(tag, JSON.stringify({ tick: world.tick, phase: l9.state.phase, hp: player.health.current, hpLost, pos: [p.x, p.z].map(v => +v.toFixed(1)), near }));
  };
  for (let i = 0; i < 60 * 240 && !l9.state.finished; i++) {
    const fr = bot.sample();
    world.applyInput(fr, 'keyboard'); world.update();
    if (player.health.current < last) hpLost += last - player.health.current; last = player.health.current;
    if (['dazed', 'rise', 'mega-exit', 'mega-roar', 'mega-leap'].includes(l9.state.phase) && endingAt < 0) { endingAt = world.tick; report('ending-start'); }
    if (endingAt >= 0 && (world.tick - endingAt) % 120 === 0) report('ending+' + (world.tick - endingAt));
    if (i % 600 === 0 && endingAt < 0) report('t');
  }
  report('end');
} finally { world.dispose(); }
