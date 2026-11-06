/** Read-only collapse admission conservation and local living-look census. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { preset } from '../../src/sim/progression/Campaign';
import { stateHash } from '../../src/sim/world/stateHash';
import { runLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const identity=provenance(),rows=[];
for(const tier of ['low','high'] as const){
 const campaign=preset('L4-default');campaign.settings.quality=tier;
 const waves:{tick:number;count:number;edges:number[]}[]=[],admissions:unknown[]=[],mix:unknown[]=[],windows:unknown[]=[];
 let previous:{pend:number[];cursor:number;ids:number;tick:number}|undefined,finalHash='',gap=0,peak=0;
 const run=await runLevel('L4','complete',1,undefined,'auto',campaign,undefined,0,{quality:tier,beforeBegin:w=>{
  w.events.on('l4.wave',e=>{if(e.type==='l4.wave'&&w.missions!.state.l4!.phase==='collapse')waves.push({tick:e.tick,count:e.count,edges:[...e.edges]});});
  w.events.on('sim.tick',()=>{
   const s=w.missions!.state.l4!,p=w.entities.get(1)!.transform;
   peak=Math.max(peak,w.infected!.director.count);
   if(w.tick%30===0&&s.phase==='war'){
    const near=w.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission&&!e.corpse).sort((a,b)=>Math.hypot(a.transform.x-p.x,a.transform.z-p.z)-Math.hypot(b.transform.x-p.x,b.transform.z-p.z)).slice(0,20);
    if(near.length===20)mix.push({tick:w.tick,looks:new Set(near.map(e=>e.infected!.model??e.appearance?.asset??e.infected!.variant)).size,actors:near.map(e=>({id:e.id,archetype:e.archetype,model:e.infected!.model??e.appearance?.asset??e.infected!.variant,x:e.transform.x,z:e.transform.z}))});
   }
   if(s.phase!=='collapse')return;
   if(s.director.gapUntil!==gap){gap=s.director.gapUntil;windows.push({start:w.tick,until:gap});}
   if(previous&&previous.tick+1===w.tick){
    const demand=[...previous.pend];for(const wave of waves.filter(wave=>wave.tick===w.tick))for(const edge of wave.edges)demand[edge]+=wave.count/wave.edges.length;
    const released=demand.map((n,i)=>n-s.pend[i]),added=s.collapseIds.slice(previous.ids);assert.equal(released.reduce((a,b)=>a+b,0),added.length);
    let cursor=0;for(let offset=0;offset<released.length;offset++){const edge=(previous.cursor+offset)%released.length,ids=added.slice(cursor,cursor+released[edge]);cursor+=released[edge];if(ids.length)admissions.push({tick:w.tick,edge,count:ids.length,actors:ids.map(id=>({id,...w.entities.get(id)!.transform}))});}
   }
   previous={pend:[...s.pend],cursor:s.collapseEdgeCursor??0,ids:s.collapseIds.length,tick:w.tick};
  },8);
 },beforeDispose:w=>{finalHash=stateHash(w.getState());}});
 const counts=waves.map(wave=>({tick:wave.tick,expectedPerEdge:wave.count/wave.edges.length,actual:Object.fromEntries(wave.edges.map(edge=>[edge,(admissions as {tick:number;edge:number;count:number}[]).filter(a=>a.edge===edge&&a.tick>=wave.tick&&a.tick<wave.tick+540).reduce((n,a)=>n+a.count,0)]))}));
 const row={tier,run,finalHash,peak,waves,counts,windows,admissions,mix};rows.push(row);console.log(JSON.stringify({tier,completed:run.completed,hash:finalHash,peak,firstWindow:counts[0],minimumLooks:Math.min(...(mix as {looks:number}[]).map(r=>r.looks))}));
}
assert.equal(provenance().sourceHash,identity.sourceHash,'sources must remain fixed during observation');mkdirSync('test-results/fix71-b',{recursive:true});writeFileSync('test-results/fix71-b/l4-native.json.gz',gzipSync(JSON.stringify({...identity,rows})));
