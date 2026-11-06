/** Diagnostic only: ordinary first90s, unchanged observers and evaluator. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels.ts';
import { preset } from '../../../src/sim/progression/Campaign.ts';
import { ThreatObserver } from '../threat/observer.ts';
import { AcceptanceObserver } from './observer.ts';
import { evaluate } from './evaluate.ts';
import { provenance } from './probe.ts';
import { stateHash } from '../../../src/sim/world/stateHash.ts';
const out=process.env.FIX68_G_PREFIX_OUT; if(!out)throw new Error('FIX68_G_PREFIX_OUT required');mkdirSync(out,{recursive:true});
for(const tier of ['low','high']){
 const campaign=preset('L3-default');campaign.settings.quality=tier;
 const r={version:2,level:'L3',tier,policy:'complete',seed:1,...provenance(),diagnostic:'90-second ordinary prefix; not a completed route qualification',run:null,observation:null,threat:null,nativeStateHash:null,error:null};let a,t;const poses=[], requests=new Map();
 r.run=await runLevel('L3','complete',1,90,'auto',campaign,undefined,0,{quality:tier,beforeBegin:w=>{
  a=new AcceptanceObserver(w);t=new ThreatObserver(w,'L3');
  const original=w.npcs.moveStep.bind(w.npcs); w.npcs.moveStep=(e,dx,dz,...rest)=>{requests.set(e.id,{tick:w.tick,vx:dx*60,vz:dz*60});return original(e,dx,dz,...rest);};
  w.events.on('sim.tick',()=>{if(w.tick%30)return;const p=w.entities.get(1);for(const id of w.missions.state.l3.officerIds){const e=w.entities.get(id),c=e?.civilian;if(!c?.ally?.follow)continue;const target=w.entities.get(c.ally.targetId);poses.push({tick:w.tick,id,player:{...p.transform},leaderSpeed:Math.hypot(p.survivor.velocity.x,p.survivor.velocity.z),request:requests.get(id)?.tick===w.tick?requests.get(id):null,position:{...e.transform},speed:e.motion?.speed,locomotion:{...e.locomotion},state:c.state,following:{...c.ally.follow},target:target?{id:target.id,health:target.health.current,at:{...target.transform}}:null,strikeAt:c.ally.strikeAt,baton:c.ally.baton,story:c.story,distance:Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z)});}},9);
 },beforeDispose:w=>{r.observation=a.finish();r.threat=t.finish();r.nativeStateHash=stateHash(w.getState());}});
 const path=`${out}/${tier}.json.gz`;writeFileSync(path,gzipSync(JSON.stringify({receipt:r,poses})));console.log(JSON.stringify({tier,path,state:r.nativeStateHash,checks:evaluate(r,path).filter(c=>['G-13','G-22'].includes(c.id))}));
}
