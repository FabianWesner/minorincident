// L4 debug: run N seconds (gun taken) and print where the infected, soldiers and the courier are. Usage: npx tsx tools/l4/where.ts [seed] [seconds]
import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { SimWorld } from '../../src/sim/world/SimWorld';

const seed = Number(process.argv[2] ?? 1), seconds = Number(process.argv[3] ?? 120);
const world = new SimWorld(); await world.init();
const c = compositions.L4;
world.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
applyCampaign(world, preset('L4-default'));
const m = world.loadMission(resolveCampaignMission('L4', world.districts!)); m.begin();
for (let i = 0; i < seconds * 60; i++) { const s = m.state.l4!; if (s.phase === 'plaza' && !s.gunAt) m.completeObjective('quartermaster'); world.update(); }
const s = m.state.l4!, p = world.entities.get(1)!.transform;
console.log('phase', s.phase, 'player', p.x.toFixed(1), p.z.toFixed(1));
for (const e of world.infected!.active) console.log('inf', e.id, e.transform.x.toFixed(1), e.transform.z.toFixed(1), e.infected?.l1?.mode ?? e.infected?.state, e.health.current.toFixed(0));
for (const id of s.soldierIds) { const e = world.entities.get(id)!; console.log('sol', id, e.transform.x.toFixed(1), e.transform.z.toFixed(1), e.civilian?.state, e.civilian?.ally?.engaged, e.civilian?.ally?.targetId); }
