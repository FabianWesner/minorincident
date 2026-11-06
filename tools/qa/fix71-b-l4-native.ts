/** Read-only collapse admission conservation and local living-look census. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { preset } from '../../src/sim/progression/Campaign';
import { stateHash } from '../../src/sim/world/stateHash';
import { runLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const identity=provenance(),rows=[];
for(const tier of ['low','high'] as const){
 const campaign=preset('L4-default');campaign.settings.quality=tier;
 const waves:{tick:number;count:number;edges:number[]}[]=[],admissions:unknown[]=[],mix:unknown[]=[],windows:unknown[]=[],population:unknown[]=[];
 let previous:{pend:number[];cursor:number;ids:number;tick:number}|undefined,finalHash='',gap=0,peak=0,lastMix='',mixChecks=0,savedCellar=false;
 const run=await runLevel('L4','complete',1,process.argv.includes('--war-only')?211:undefined,'auto',campaign,undefined,0,{quality:tier,beforeBegin:w=>{
  w.events.on('l4.wave',e=>{if(e.type==='l4.wave'&&w.missions!.state.l4!.phase==='collapse')waves.push({tick:e.tick,count:e.count,edges:[...e.edges]});});
  w.events.on('sim.tick',()=>{
   const s=w.missions!.state.l4!,p=w.entities.get(1)!.transform;
   if(!savedCellar&&s.phase==='cellar'&&!s.barredAt&&w.missions!.state.steps.bar.interaction>=1){
    savedCellar=true;mkdirSync('test-results/fix71-b',{recursive:true});writeFileSync(`test-results/fix71-b/cellar-brace-resume-${tier}.json.gz`,gzipSync(JSON.stringify({...identity,tier,origin:'Actual mortal native complete route, actually reached brace before normal barring',save:w.missions!.saveResume()})));
   }
   peak=Math.max(peak,w.infected!.director.count);
   if(s.phase==='war'){
    const near=w.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission&&!e.corpse).sort((a,b)=>Math.hypot(a.transform.x-p.x,a.transform.z-p.z)-Math.hypot(b.transform.x-p.x,b.transform.z-p.z)).slice(0,20);
    if(near.length===20){
     mixChecks++;const key=near.map(e=>e.id).sort((a,b)=>a-b).join(',');
     if(key!==lastMix){lastMix=key;mix.push({tick:w.tick,looks:new Set(near.map(e=>e.infected!.model??e.appearance?.asset??e.infected!.variant)).size,actors:near.map(e=>({id:e.id,archetype:e.archetype,model:e.infected!.model??e.appearance?.asset??e.infected!.variant,x:e.transform.x,z:e.transform.z}))});}
    }
   }
   if(s.phase!=='collapse')return;
   if(w.tick%60===0)population.push({tick:w.tick,count:w.infected!.director.count,reserved:w.infected!.director.reserved,pendingTurns:w.infected!.director.pendingTurns,characters:[...w.entities.iterate()].filter(e=>(!e.hidden||tier==='low')&&e.health.current>0&&(e.infected||e.civilian)).length,collapsePend:[...(s.collapsePend??[])],player:{...p}});
   if((s.director.gapUntil??0)!==gap){gap=s.director.gapUntil??0;windows.push({start:w.tick,until:gap});}
   if(previous&&previous.tick+1===w.tick){
    const demand=[...previous.pend];for(const wave of waves.filter(wave=>wave.tick===w.tick))for(const edge of wave.edges)demand[edge]+=wave.count/wave.edges.length;
    const released=demand.map((n,i)=>n-s.pend[i]),added=s.collapseIds.slice(previous.ids);assert.equal(released.reduce((a,b)=>a+b,0),added.length);
    let cursor=0;for(let offset=0;offset<released.length;offset++){const edge=(previous.cursor+offset)%released.length,ids=added.slice(cursor,cursor+released[edge]);cursor+=released[edge];if(ids.length)admissions.push({tick:w.tick,edge,count:ids.length,actors:ids.map(id=>({id,archetype:w.entities.get(id)!.archetype,...w.entities.get(id)!.transform}))});}
   }
   previous={pend:[...s.pend],cursor:s.collapseEdgeCursor??0,ids:s.collapseIds.length,tick:w.tick};
  },8);
 },beforeDispose:w=>{finalHash=stateHash(w.getState());}});
 const counts=waves.map(wave=>({tick:wave.tick,expectedPerEdge:wave.count/wave.edges.length,actual:Object.fromEntries(wave.edges.map(edge=>[edge,(admissions as {tick:number;edge:number;count:number}[]).filter(a=>a.edge===edge&&a.tick>=wave.tick&&a.tick<wave.tick+540).reduce((n,a)=>n+a.count,0)]))}));
 const path='docs/reports/fix71-b/L4-13-native.json.gz';
 const control=existsSync(path)?JSON.parse(gunzipSync(readFileSync(path)).toString()):null;
 const canonicalHash=control?.sourceHash===identity.sourceHash?control.rows.find((r:{tier:string})=>r.tier===tier)?.finalHash:null;
 if(canonicalHash)assert.equal(finalHash,canonicalHash,'full-rate observer must preserve the canonical final state');
 const row={tier,run,finalHash,canonicalHash,peak,waves,counts,windows,admissions,mixChecks,mix,population};rows.push(row);mkdirSync('test-results/fix71-b',{recursive:true});writeFileSync(`test-results/fix71-b/l4-native-${tier}.json.gz`,gzipSync(JSON.stringify({...identity,rows:[row]})));console.log(JSON.stringify({tier,completed:run.completed,hash:finalHash,canonicalHash,peak,firstWindow:counts[0],minimumLooks:Math.min(...(mix as {looks:number}[]).map(r=>r.looks)),mixChecks}));
}
assert.equal(provenance().sourceHash,identity.sourceHash,'sources must remain fixed during observation');mkdirSync('test-results/fix71-b',{recursive:true});writeFileSync('test-results/fix71-b/l4-native.json.gz',gzipSync(JSON.stringify({...identity,rows})));
