// L5 debug: load the level, complete the emergence, run N seconds idle and print the world. Usage: npx tsx tools/l5/probe.ts [seed] [seconds]
import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { SimWorld } from '../../src/sim/world/SimWorld';

const seed = Number(process.argv[2] ?? 1), seconds = Number(process.argv[3] ?? 20);
const world = new SimWorld(); await world.init();
const c = compositions.L5;
world.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
applyCampaign(world, preset('L5-default'));
const m = world.loadMission(resolveCampaignMission('L5', world.districts!)); m.begin();
const p = world.entities.get(1)!.transform;
console.log('start', p.x.toFixed(1), p.z.toFixed(1), 'phase', m.state.l5!.phase);
m.completeObjective('emerge');
for (let i = 0; i < seconds * 60; i++) world.update();
const s = m.state.l5!;
console.log('phase', s.phase, 'player', p.x.toFixed(1), p.z.toFixed(1), 'infected', world.infected!.active.length, 'gloom', s.gloom.toFixed(3));
console.log(JSON.stringify(s.survivors));
let humans = 0, hidden = 0, finished = 0;
for (const e of world.entities.iterate()) if (e.civilian) { if (e.civilian.state === 'finished') finished++; else if (e.hidden) hidden++; else humans++; }
console.log('humans', humans, 'hidden', hidden, 'corpses', finished, 'fires', [...world.entities.iterate()].filter(e => e.hazard?.kind === 'fire').length);
for (const e of world.infected!.active) console.log('inf', e.id, e.transform.x.toFixed(1), e.transform.z.toFixed(1), e.infected?.l1?.mode);
