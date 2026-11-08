/** Read-only native cohort trajectories against authored floor polygons. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { PathProbe } from '../threat/observer';
import { l6Doors } from '../../../src/data/l6';
import { provenance } from './probe';
import { reportRoot } from './report';
import type { EntitySnapshot } from '../../../src/sim/world/types';
const layout=JSON.parse(readFileSync('public/assets/layouts/D-SUBWAY.layout.json','utf8')) as {surfaces:{surface:string;height:number;polygon:number[][]}[]};
const shelter=layout.surfaces.find(s=>s.surface==='tile')!,tracks=layout.surfaces.find(s=>s.surface==='gravel'&&s.polygon[0][0]===30)!;
const inside=(surface:typeof shelter,e:EntitySnapshot,height=surface.height)=>{
 const radius=e.combat?.radius??.35, xs=surface.polygon.map(p=>p[0]),zs=surface.polygon.map(p=>p[1]);
 return e.transform.x-radius>=Math.min(...xs)&&e.transform.x+radius<=Math.max(...xs)&&e.transform.z-radius>=Math.min(...zs)&&e.transform.z+radius<=Math.max(...zs)&&Math.abs(e.transform.y-.7-height)<=.1;
};
export async function l6Trajectories(tier: 'low'|'high') {
 const campaign=preset('L6-default');campaign.settings.quality=tier;
 type Actor={id:number;wave:number;door:number;bornAt:number;birth:unknown;firstShelterFloor:number|null;firstTrack:number|null;end:string|null;pathAtBirth:boolean;pathSamples:number;pathFailures:number};
 const actors=new Map<number,Actor>(),events:unknown[]=[],power:unknown[]=[];let cursor=0,observedHash='',samples=0;
 const paths=new PathProbe();
 const run=await runLevel('L6','complete',1,undefined,'auto',campaign,undefined,0,{quality:tier,beforeBegin:world=>{
  for(const type of ['l6.bang','l6.breach1','l6.breach2','l6.abandon','player.died','checkpoint.restored'] as const)world.events.on(type,event=>events.push(structuredClone(event)));
  world.events.on('sim.tick',()=>{
   const state=world.missions!.state.l6!,player=world.entities.get(1)!;samples++;
   for(const entry of state.spawnLog.slice(cursor)){
    const e=world.entities.get(entry.id)!;
    actors.set(e.id,{id:e.id,wave:entry.wave,door:entry.door,bornAt:entry.tick,birth:{...e.transform},firstShelterFloor:null,firstTrack:null,end:null,pathAtBirth:paths.query(world.infected!.nav,e,player.transform,2.5),pathSamples:0,pathFailures:0});
   }
   cursor=state.spawnLog.length;
   for(const actor of actors.values()){
    const e=world.entities.get(actor.id);
    if(!e||e.health.current<=0||e.hidden){actor.end??=!e?'removed':e.health.current<=0?'downed':'hidden';continue;}
    if(inside(shelter,e))actor.firstShelterFloor??=world.tick;
    if(inside(tracks,e,world.districts!.groundHeight(e.transform.x,e.transform.z)))actor.firstTrack??=world.tick;
    if(world.tick%30===0&&Math.hypot(e.transform.x-player.transform.x,e.transform.z-player.transform.z)<=30){actor.pathSamples++;if(!paths.query(world.infected!.nav,e,player.transform,2.5))actor.pathFailures++;}
   }
   if(state.phase==='fails'&&power.length<2)power.push({tick:world.tick,main:state.mainPower,emergency:state.emergency,lightGroups:[...world.districts!.districts[0].decay.lights]});
  },8);
 },beforeDispose:world=>{observedHash=stateHash(world.getState());}});
 const control=JSON.parse(readFileSync(`${reportRoot}/receipts/L6-${tier}-complete.json`,'utf8'));
 assert.equal(control.sourceHash,provenance().sourceHash);
 assert.equal(observedHash,control.nativeStateHash,'Read-only trajectory observer must leave canonical final state unchanged');
 assert.equal(run.completed,control.run.completed,'Read-only trajectory observer must preserve completion');
 assert.equal(run.deaths,control.run.deaths,'Read-only trajectory observer must preserve canonical deaths');
 return {tier,run,samples,observedHash,canonicalHash:control.nativeStateHash,events:events as {type:string;tick:number;breach?:number}[],power,actors:[...actors.values()]};
}
export function firstBreachPass(row: Awaited<ReturnType<typeof l6Trajectories>>) {
 const breach=row.events.filter(e=>e.type==='l6.breach1'),bang=row.events.filter(e=>e.type==='l6.bang'&&e.breach===1),second=row.events.find(e=>e.type==='l6.breach2');
 return row.run.completed&&breach.length===1&&bang.length===1&&breach[0].tick/60>=30&&breach[0].tick/60<=40&&(breach[0].tick-bang[0].tick)/60>=1.5&&!!second&&row.actors.filter(a=>a.wave===1&&a.firstShelterFloor!==null&&a.firstShelterFloor<second.tick).length>=6;
}
export function sideEntriesPass(row: Awaited<ReturnType<typeof l6Trajectories>>) {
 const sides=row.actors.filter(a=>a.wave===4),doors=[...new Set(sides.map(a=>a.door))],signs=doors.map(d=>Math.sign(l6Doors[d].z-15));
 const count=sides.reduce((n,a)=>n+a.pathSamples,0),fail=sides.reduce((n,a)=>n+a.pathFailures,0);
 return row.run.completed&&doors.length===6&&doors.every(d=>sides.filter(a=>a.door===d).length===2)&&signs.every((s,i)=>!i||s!==signs[i-1])&&sides.every(a=>a.firstTrack!==null&&a.pathAtBirth&&a.end==='downed')&&count>0&&(count-fail)/count>=.95;
}
if(process.argv[1]?.endsWith('fix53-l6-trajectories.ts')){
 const rows=[];
 for(const tier of ['low','high'] as const){const row=await l6Trajectories(tier);rows.push(row);console.log(tier,'first',firstBreachPass(row),'sides',sideEntriesPass(row));}
 writeFileSync('docs/reports/fix53-b/L6-trajectories.json',JSON.stringify({...provenance(),geometry:'Actual tile/gravel floor polygons from authored D-SUBWAY layout; body radius must fit inside the floor rectangle. Spawn IDs followed every simulation tick; bounded2.5x direct paths sampled at birth and2Hz within30m. No mutation of actors, input, RNG or game navigation.',shelter,tracks,rows},null,2)+'\n');
}
