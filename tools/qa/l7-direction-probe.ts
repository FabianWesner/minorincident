/** Diagnostic: observe living visible infected within 12 m of the courier at 2 Hz near each L7 street anchor. */
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { l7Encounters } from '../../src/data/l7';
for (const tier of ['low','high'] as const) {
 const campaign=preset('L7-default'); campaign.settings.quality=tier;
 const rows: {tick:number,street:number,sectors:string[]}[]=[];
 const result=await runLevel('L7','complete',1,undefined,'auto',campaign,undefined,0,{quality:tier,beforeBegin:w=>w.events.on('sim.tick',()=>{
  if(w.tick%30)return; const p=w.entities.get(1)?.transform;if(!p||!w.l7Encounters?.state.started)return;
  l7Encounters.streets.forEach((c,i)=>{if(Math.hypot(p.x-c.x,p.z-c.z)>18)return;
   const sectors=new Set<string>(); for(const e of w.infected!.active){if(e.health.current<=0||e.hidden)continue;const dx=e.transform.x-p.x,dz=e.transform.z-p.z,d=Math.hypot(dx,dz);if(d>12||d<.1)continue;sectors.add(Math.abs(dx)>Math.abs(dz)?(dx>0?'east':'west'):(dz>0?'south':'north'));} rows.push({tick:w.tick,street:i,sectors:[...sectors]}); });
 })});
 const streets=l7Encounters.streets.map((_,i)=>{const a=rows.filter(x=>x.street===i);let best:string[]=[];let start=0;for(const x of a){const s=[...new Set(a.filter(y=>y.tick>=x.tick&&y.tick<x.tick+300).flatMap(y=>y.sectors))];if(s.length>best.length){best=s;start=x.tick;}}return {street:i,samples:a.length,best,start};});console.log(JSON.stringify({tier,completed:result.completed,streets}));
}
