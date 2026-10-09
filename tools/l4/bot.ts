// L4 bot probe: one single-seed pass of the shared bot policy. Usage: npx tsx tools/l4/bot.ts [seed] [complete|newbie|evade-only|idle] [seconds] [harbor|lakeshore|auto]
import { readFileSync } from 'node:fs';
import { LevelFourBot, type L4Profile, type L4RouteChoice } from '../../src/debug/bot/LevelFourBot';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { SimWorld } from '../../src/sim/world/SimWorld';

const seed = Number(process.argv[2] ?? 1), profile = (process.argv[3] ?? 'complete') as L4Profile, seconds = Number(process.argv[4] ?? 600), route = (process.argv[5] ?? 'auto') as L4RouteChoice;
const world = new SimWorld(); await world.init();
const c = compositions.L4;
world.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
applyCampaign(world, preset('L4-default'));
const m = world.loadMission(resolveCampaignMission('L4', world.districts!)); m.begin();
const bot = new LevelFourBot(world, profile, route);
for (const type of ['l4.convoyArrived', 'l4.gun', 'l4.firstTurn', 'l4.lineBreaks', 'l4.heliWithdrawn', 'l4.descended', 'l4.doorBarred', 'objective.completed', 'player.died'] as const)
  world.events.on(type, e => console.log((e.tick / 60).toFixed(1), JSON.stringify(e).slice(0, 150)));
let tick = 0;
for (; tick < seconds * 60 && !bot.finished; tick++) {
  world.applyInput(bot.sample(), 'keyboard'); world.update();
  if (tick % 1200 === 0) {
    const s = m.state.l4!, p = world.entities.get(1)!;
    console.log(`t=${(tick / 60).toFixed(0)} ${s.phase} hp=${p.health.current.toFixed(0)} at ${p.transform.x.toFixed(0)},${p.transform.z.toFixed(0)} infected=${world.infected!.director.count} soldiers=${s.soldierIds.filter(id => world.entities.get(id)?.civilian?.ally && world.entities.get(id)!.health.current > 0 && world.entities.get(id)!.kind !== 'infected').length} bot=${JSON.stringify(bot.debug())}`);
  }
}
const s = m.state.l4!, st = m.state.stats;
console.log(JSON.stringify({ finished: bot.finished, phase: m.state.phase, l4phase: s.phase, seconds: +(tick / 60).toFixed(1), deaths: st.deaths, kills: s.kills, soldiersAtTurn: s.soldiersAtTurn, soldiersAtBreak: s.soldiersAtBreak, soldiersAtCellar: s.soldiersAtCellar, infectedAtBreak: s.infectedAtBreak, killsAtBreak: s.killsAtBreak, lineCause: s.lineCause, tankShots: s.tankShots, hmgBursts: s.hmgBursts, glass: s.glass.length, burning: s.burning.length }));
