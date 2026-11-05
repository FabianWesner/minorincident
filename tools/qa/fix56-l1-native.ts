import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';
import { runL1 } from '../sim-runner/l1Bots';
import { provenance } from './accept/probe';
const rows = [];
for (const tier of ['low','high'] as const) {
 const world = await loadLevel('L1', 1, undefined, 0, { quality: tier });
 try {
  const mission=world.missions!, exits = new Map<number,{id:number;tick:number;x:number;z:number;end?:{tick:number;x:number;z:number;heading:number}}>();
  let routes: unknown;
  const run=runL1(world,mission,'complete',{ maxSeconds:120, stopWhen:()=>exits.size===5&&[...exits.values()].every(e=>e.end), onTick:()=>{
   const s=mission.state.l1!,door=s.labExit;if(!door)return; if(!routes && s.exitIds.length===5)routes=structuredClone(door);
   for(const id of s.exitIds){const e=world.entities.get(id);if(!e||e.hidden||e.health.current<=0||e.pendingAdmission)continue;const p=e.transform;
    if((p.x-door.x)*door.nx+(p.z-door.z)*door.nz<1)continue;
    const v=exits.get(id);if(!v)exits.set(id,{id,tick:world.tick,x:p.x,z:p.z});
    else if(!v.end&&Math.hypot(p.x-v.x,p.z-v.z)>=4)v.end={tick:world.tick,x:p.x,z:p.z,heading:Math.atan2(p.z-v.z,p.x-v.x)*180/Math.PI};
   }
  }});
  const crossing=[...exits.values()],headings=crossing.flatMap(e=>e.end?[e.end.heading]:[]),gap=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin((a-b)*Math.PI/180),Math.cos((a-b)*Math.PI/180)))*180/Math.PI;
  const separated=headings.some((a,i)=>headings.slice(i+1).some((b,j)=>headings.slice(i+j+2).some(c=>Math.min(gap(a,b),gap(a,c),gap(b,c))>=60)));
  rows.push({tier,technician:mission.state.l1!.techId,crossing,separated,routes,run});console.log(tier,crossing.map(e=>[e.id,e.tick,e.end?.heading]),separated);
 }finally{world.dispose();}
}
writeFileSync('test-results/fix56-a/L1-06-native.json',JSON.stringify({...provenance(),rows},null,2)+'\n');
assert(rows.every(r=>r.crossing.length===5&&r.crossing[0].id===r.technician&&r.separated),'L1-06 crossing/heading failure');
