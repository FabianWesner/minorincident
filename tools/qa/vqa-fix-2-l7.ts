/** Recreate the opening placement defect without modifying any actor/count/health rule. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { l7Encounters } from '../../src/data/l7';
import { provenance } from './accept/probe';
const rows=[];
const first=l7Encounters.streets[0] as {x:number;z:number},retained=first.x;
try {
  for(const tier of ['low','high'] as const) for(const x of [259,retained]) {
    first.x=x;
    const w=await loadLevel('L7',1,preset('L7-default'),0,{quality:tier});
    try {
      const initial=w.l7Encounters!.state.roster.map(r=>r.id);
      let minimum=Infinity;
      for(const r of w.l7Encounters!.state.roster) for(const e of w.infected!.active) minimum=Math.min(minimum,Math.hypot(w.entities.get(r.id)!.transform.x-e.transform.x,w.entities.get(r.id)!.transform.z-e.transform.z));
      for(let i=0;i<300;i++)w.update();
      const roster=w.l7Encounters!.state.roster.map(r=>({...r,hp:w.entities.get(r.id)!.health.current}));
      rows.push({tier,x,initial,minimumEnemyDistance:minimum,afterSeconds:5,roster,losses:w.events.events().filter(e=>e.type==='mission.signal'&&e.name.startsWith('l7.survivor-'))});
      if(x===retained) assert(roster.every(r=>r.hp>0&&r.status==='following'));
    } finally {w.dispose();}
  }
} finally {first.x=retained;}
writeFileSync('docs/reports/vqa-fix-2/L7-opening-proof.json',JSON.stringify({...provenance(),method:`Native opening, no player input for five seconds. The process-local x259 cell compares the old pack anchor on the current formation; x${retained} is production. The actual historical formation comparison is retained in diagnostics/L7-opening-before-formation.json. No count, HP, attack, protection or timing rule altered.`,rows},null,2)+'\n');
console.log(rows.map(r=>({tier:r.tier,x:r.x,minimum:r.minimumEnemyDistance,living:r.roster.filter(e=>e.status==='following').length,losses:r.losses.length})));
