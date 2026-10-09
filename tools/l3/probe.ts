// L3 probe: load the level headless, idle in the yard (or take the handgun), print the beats and the population.
// Usage: npx tsx tools/l3/probe.ts [seed] [seconds] [handgun]
import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { SimWorld } from '../../src/sim/world/SimWorld';

const seed = Number(process.argv[2] ?? 1), seconds = Number(process.argv[3] ?? 90), handgun = process.argv[4] === 'handgun';
const world = new SimWorld(); await world.init();
const c = compositions.L3, t0 = performance.now();
world.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
applyCampaign(world, preset('L3-default'));
const m = world.loadMission(resolveCampaignMission('L3', world.districts!)); m.begin();
console.log('load ms', Math.round(performance.now() - t0), 'warnings', world.districts!.warnings.length);
for (const type of ['l3.handgun', 'l3.attack', 'l3.wave', 'l3.fallback', 'l3.squad-lost', 'l3.segment', 'l3.crossed', 'objective.completed', 'checkpoint.set'] as const)
  world.events.on(type, e => console.log((e.tick / 60).toFixed(1), JSON.stringify(e)));
if (handgun) m.completeObjective('armory');
const t1 = performance.now();
for (let i = 0; i < seconds * 60; i++) {
  world.update();
  if (i % 600 === 0) {
    const s = m.state.l3!, ai = world.infected!;
    const officers = s.officerIds.map(id => world.entities.get(id)).map(e => !e ? 'x' : e.kind === 'infected' ? 'T' : e.health.current <= 0 || e.civilian?.state === 'finished' ? 'd' : 'o').join('');
    console.log(`t=${(i / 60).toFixed(0)} phase=${s.phase} infected=${ai.director.count}/${ai.active.length} officers=${officers} hp=${world.entities.get(1)!.health.current.toFixed(0)}`);
  }
}
console.log('sim ms per s', ((performance.now() - t1) / seconds).toFixed(1));
