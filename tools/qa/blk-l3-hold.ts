/** blk-l3 (L3-14): ordinary complete policy to the first crossedAt, then empty input inside the ring; who holds the boom? */
import { emptyInput } from '../../src/input/InputFrame';
import { preset } from '../../src/sim/progression/Campaign';
import { LevelThreeBot } from '../../src/debug/bot/LevelThreeBot';
import { loadLevel } from '../sim-runner/levels';
import { followFrustum } from '../sim-runner/l3Bots';
const tier = (process.argv[2] ?? 'high') as 'low' | 'high', seed = Number(process.argv[3] ?? 1);
const campaign = preset('L3-default'); campaign.settings.quality = tier;
const world = await loadLevel('L3', seed, campaign, 0, { quality: tier });
const mission = world.missions!, bot = new LevelThreeBot(world, 'complete', 'auto');
let t = 0;
for (; t < 1200 * 60 && !mission.state.l3!.crossedAt; t++) { followFrustum(world); world.applyInput(bot.sample(), 'keyboard'); world.update(); }
const s = mission.state.l3!, zoneX = 196;
console.log('crossedAt', s.crossedAt, 'deaths?', world.entities.get(1)!.health.current);
const who = () => {
  const ids = [1, ...s.squad.map(m => m.id), ...[...world.entities.iterate()].filter(e => !!e.companion).map(e => e.id)];
  return ids.map(id => { const e = world.entities.get(id); return e ? `${id}${e.companion ? 'dog' : id === 1 ? 'P' : 'off'}(${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)} hp${e.health.current}${e.infection ? ' inf' : ''}${e.hidden ? ' hid' : ''})` : `${id}gone`; }).join(' ');
};
for (let k = 0; k < 60 * 60 && !s.doneAt; k++) {
  followFrustum(world); world.applyInput(emptyInput(), 'keyboard'); world.update();
  if ((world.tick - s.crossedAt) % 60 === 0) { const bx = 137.1 + 76; const under = [...world.entities.iterate()].filter(e => !e.infected && e.health.current > 0 && Math.abs(e.transform.z) < 2.2 && Math.abs(e.transform.x - bx) < .6).map(e => `${e.id}:${e.kind}/${e.archetype}@${e.transform.x.toFixed(2)},${e.transform.z.toFixed(2)}${e.civilian ? ' civ' : ''}`); if (under.length && !s.barrierClosedAt) console.log('  under', under.join(' ')); }
  console.log(world.tick - s.crossedAt, 'barrier', s.barrierClosedAt ? s.barrierClosedAt - s.crossedAt : 0, who());
}
console.log('done', s.doneAt ? s.doneAt - s.crossedAt : null, 'barrier', (s.barrierClosedAt ?? 0) - s.crossedAt, zoneX);
world.dispose();
