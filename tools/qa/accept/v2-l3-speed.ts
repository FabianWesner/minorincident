import {writeFileSync} from 'node:fs';
import {loadL3,runL3} from '../../sim-runner/l3Bots';
import {provenance} from './probe';
const cells=[];
for(const tier of ['high','low'] as const){
 const {world,mission}=await loadL3(1,tier); const update=world.update.bind(world); let max=0; const witnesses=[] as object[]; let samples=0;
 world.update=()=>{const before=new Map(world.infected!.active.filter(e=>e.archetype==='infected.runner' && e.health.current>0).map(e=>[e.id,{x:e.transform.x,z:e.transform.z,state:e.infected!.state,speed:e.infected!.speed,mode:e.infected!.l1?.mode}]));update();for(const e of world.infected!.active){const p=before.get(e.id);if(!p||e.archetype!=='infected.runner'||p.state!=='chase'||e.infected!.state!=='chase')continue;const speed=Math.hypot(e.transform.x-p.x,e.transform.z-p.z)*60;if(speed<15){samples++;if(speed>max){max=speed; if(speed>4.05)witnesses.push({tick:world.tick,id:e.id,from:p,to:{x:e.transform.x,z:e.transform.z},speed,mode:e.infected!.l1?.mode});}}}};
 const result=runL3(world,mission,'complete',{seed:1});cells.push({tier,outcome:result.outcome,deaths:result.deaths,samples,max,witnesses:witnesses.slice(-20)}); world.dispose();
}
writeFileSync('docs/reports/v2-l2l4/L3-09-movement.json',JSON.stringify({...provenance(),method:'Read-only per-tick horizontal displacement of living runner in chase before and after world.update; excludes displacements ≥15 m/s. Ordinary complete bot seed 1; no protection.',cells},null,2)+'\n');console.log(JSON.stringify(cells));
