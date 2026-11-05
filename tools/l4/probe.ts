// L4 probe: load the level headless, ride, report to the quartermaster (or idle), print the beats and the population.
// Usage: npx tsx tools/l4/probe.ts [seed] [seconds] [gun|idle]
import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { SimWorld } from '../../src/sim/world/SimWorld';

const seed = Number(process.argv[2] ?? 1), seconds = Number(process.argv[3] ?? 120), gun = process.argv[4] === 'gun';
const world = new SimWorld(); await world.init();
const c = compositions.L4, t0 = performance.now();
world.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
if (process.env.TIER === 'low') { world.infected!.director.setTier('low'); world.npcs!.setQuality('low'); }
applyCampaign(world, preset('L4-default'));
const m = world.loadMission(resolveCampaignMission('L4', world.districts!)); m.begin();
console.log('load ms', Math.round(performance.now() - t0), 'warnings', world.districts!.warnings.length);
for (const type of ['l4.convoyStarted', 'l4.convoyArrived', 'l4.gun', 'l4.firstTurn', 'l4.wave', 'l4.tankFire', 'l4.heliPass', 'l4.lineBreaks', 'l4.heliWithdrawn', 'l4.descended', 'l4.doorBarred', 'objective.completed', 'checkpoint.set', 'player.died'] as const)
  world.events.on(type, e => console.log((e.tick / 60).toFixed(1), JSON.stringify(e)));
const t1 = performance.now();
for (let i = 0; i < seconds * 60; i++) {
  const s = m.state.l4!;
  if (gun && s.phase === 'plaza' && !s.gunAt) m.completeObjective('quartermaster');
  world.update();
  if (i % 600 === 0) {
    const ai = world.infected!, soldiers = s.soldierIds.map(id => world.entities.get(id)).map(e => !e ? 'x' : e.kind === 'infected' ? 'T' : e.health.current <= 0 || e.civilian?.state === 'finished' ? 'd' : 'o').join('');
    console.log(`t=${(i / 60).toFixed(0)} phase=${s.phase} infected=${ai.director.count}/${ai.active.length} soldiers=${soldiers} hp=${world.entities.get(1)!.health.current.toFixed(0)} kills=${JSON.stringify(s.kills)}`);
  }
}
console.log('sim ms per s', ((performance.now() - t1) / seconds).toFixed(1));
