/** Observe both authored living Alphas after the ordinary cellar exit. */
import assert from 'node:assert/strict';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { PathProbe } from '../threat/observer';
import type { Tier } from './probe';
export async function l5Alphas(tier: Tier) {
 const save=preset('L5-default');save.settings.quality=tier;
 let observed: {tick:number;player:{x:number;z:number};alphas:{id:number;hp:number;radius:number;at:{x:number;z:number};pathLength:number|null}[]}|null=null,finalHash='';
 const paths=new PathProbe();
 const run=await runLevel('L5','complete',1,undefined,'auto',save,undefined,0,{quality:tier,beforeBegin:world=>{
  world.events.on('sim.tick',()=>{
   if(observed||world.missions!.state.l5?.phase!=='search')return;
   const p=world.entities.get(1)!.transform;
   observed={tick:world.tick,player:{x:p.x,z:p.z},alphas:world.infected!.active.filter(e=>e.archetype==='infected.alpha'&&e.health.current>0&&!e.hidden&&!e.pendingAdmission).map(e=>{
    const length=paths.distance(world.infected!.nav,e,p);
    return {id:e.id,hp:e.health.current,radius:e.combat?.radius??.35,at:{x:e.transform.x,z:e.transform.z},pathLength:Number.isFinite(length)?length:null};
   })};
  },8);
 },beforeDispose:world=>{finalHash=stateHash(world.getState());}});
 assert(run.completed,'Alpha path observation must preserve the complete native route');
 // Capture assigned by the read-only simulation callback.
 return {tier,run,observed:observed as {tick:number;player:{x:number;z:number};alphas:{id:number;hp:number;radius:number;at:{x:number;z:number};pathLength:number|null}[]}|null,finalHash};
}
export function l5AlphasPass(row:Awaited<ReturnType<typeof l5Alphas>>) {
 return row.run.completed && !!row.observed && row.observed.alphas.length>=2 && row.observed.alphas.every(a=>a.hp>0&&a.pathLength!==null&&a.pathLength>0);
}
