/** L2-11: ordinary no-axe radio census and actual rescue retirement eligibility. */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loadL2, runL2 } from '../sim-runner/l2Bots';
import { provenance } from './accept/probe';
const runs=[];
for(const tier of ['low','high'] as const){
 const {world,mission}=await loadL2(1,tier);
 try{
  let radioActors: object[]=[];
  world.events.on('l2.radio',()=>{
   const s=mission.state.l2!,p=world.entities.get(1)!.transform,o=mission.def.anchors['l2-forecourt'];
   radioActors=world.infected!.active.map(e=>({id:e.id,at:{...e.transform},hp:e.health.current,state:e.infected!.state,mode:e.infected!.l1?.mode,target:e.infected!.l1?.targetId,recoverAt:e.infected!.recoverAt,offscreen:world.infected!.director.offscreen(e.transform,e.transform.y-.7),toPlayer:Math.hypot(e.transform.x-p.x,e.transform.z-p.z),toMarket:Math.hypot(e.transform.x-o.x,e.transform.z-o.z),rescue:[...s.ambushIds,...s.trappedIds,...s.crewIds].includes(e.id),street:s.escapeIds.includes(e.id),cluster:s.clusterIds.includes(e.id)}));
  });
  const report=runL2(world,mission,'no-axe',{god:true,stopWhen:m=>!!m.state.l2!.radioAt&&world.tick>m.state.l2!.radioAt+60});
  runs.push({tier,report,radioActors});console.log(tier,JSON.stringify(report.radio));
 }finally{world.dispose();}
}
writeFileSync(process.env.ESCAPE_CENSUS_OUT??'docs/reports/fix60-a/L2-11-ledger.json.gz',gzipSync(JSON.stringify({...provenance(),method:'Ordinary no-axe native InputFrames; count-only courier protection. Actual radio-event live actors/positions/brains/offscreen state and existing independent route census; no teleport/spawn/AI edits.',runs})));
