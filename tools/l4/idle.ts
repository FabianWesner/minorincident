// L4 debug: which civilians stand idle (not moving, no facing, not seated) during the calm? Usage: npx tsx tools/l4/idle.ts [seed] [seconds]
import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { SimWorld } from '../../src/sim/world/SimWorld';

const seed = Number(process.argv[2] ?? 2), seconds = Number(process.argv[3] ?? 60);
const world = new SimWorld(); await world.init();
const c = compositions.L4;
world.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
applyCampaign(world, preset('L4-default'));
const m = world.loadMission(resolveCampaignMission('L4', world.districts!)); m.begin();
const s = m.state.l4!;
while (s.phase === 'convoy') world.update();
m.completeObjective('quartermaster');
const idle = new Map<number, number>();
for (let t = 0; t < seconds * 60 && s.phase !== 'war'; t++) {
  world.update();
  if (t % 30) continue;
  for (const e of world.entities.iterate()) {
    const c = e.civilian; if (!c || c.ally || c.state !== 'calm' || e.hidden || e.health.current <= 0) continue;
    const act = c.schedule?.[c.scheduleStep ?? 0];
    const fine = e.motion?.moving || act?.activity === 'sit' || act?.activity === 'chat' || act?.facing;
    if (fine) { idle.set(e.id, 0); continue; }
    const n = (idle.get(e.id) ?? 0) + .5; idle.set(e.id, n);
    if (n === 4) console.log('idle>3s', e.id, e.transform.x.toFixed(1), e.transform.z.toFixed(1), act?.activity, 'step', c.scheduleStep, 'of', c.schedule?.length, 'pause', c.pauseUntil - world.tick, 'path', c.path.length);
  }
}
