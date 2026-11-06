/** Isolated scripted perception contacts in every real level collision world. */
import { writeFileSync } from 'node:fs';
import { loadLevel } from '../../sim-runner/levels.ts';
import { humanInfected } from '../../../src/data/infected.ts';
import { observeAttackStarts } from '../threat/attackStarts.ts';
import { provenance } from './probe.ts';
const result={...provenance(),method:'Explicit controlled fixture: production level/nav, director paused, ambient actors hidden, each ordinary human archetype directed past a nearby player or waiting escort. Read-only real attack-start observer, no path/AI tuning.',cells:[],errors:[],limitations:['Companion immunity/perception and every authored finite-focus arrival policy remain separate; this fixture does not establish full G-18 PASS.','Player/escort placement and scripted travel are fixture setup, not native campaign route evidence.']};
for(const tier of ['low','high'])for(let n=1;n<=10;n++){
 const level=`L${n}`;let w;
 try{w=await loadLevel(level,1,undefined,0,{quality:tier});const ai=w.infected,p=w.entities.get(1);w.missions.begin();w.storyLock=null;ai.director.update=()=>{};for(const e of [...ai.active])ai.release(e);for(const e of w.entities.iterate())if(e.id!==1&&(e.civilian||e.companion||e.escort))e.hidden=true;
  let start=null,best=Infinity;const nav=ai.nav;
  for(let i=0;i<nav.blocked.length;i++){const x=nav.x(i),z=nav.z(i),d=Math.hypot(x-p.transform.x,z-p.transform.z);if(d<best&&[-1,0,1].every(dz=>[0,2,4,6,8].every(dx=>nav.clear(x+dx,z+dz,.6)))&&nav.visible({x,z},{x:x+8,z},.4)){start={x,z};best=d;}}
  if(!start)throw Error('No open8m fixture lane');
  const follower=w.npcs.escorts.spawn(start),escort=w.entities.get(follower);escort.escort.order=escort.escort.state='wait';p.health.current=p.health.max=100000;escort.health.current=escort.health.max=100000;
  for(const target of ['player','escort'])for(const def of humanInfected){
   Object.assign(p.transform,start);Object.assign(escort.transform,start);p.hidden=target!=='player';escort.hidden=target!=='escort';
   const id=ai.spawn(def.id,{x:start.x+2,z:start.z},{yaw:Math.PI,...(level==='L10'&&def.id==='infected.alpha'?{cureRegion:'industrial-area'}:{})}),e=w.entities.get(id);e.infected.scripted={x:start.x+8,z:start.z};const attacks=[];let observing=true;observeAttackStarts(w,(sourceId,targetId)=>{if(observing&&sourceId===id)attacks.push({tick:w.tick,targetId});});const begin=w.tick;
   for(let t=0;t<240&&!attacks.some(a=>a.targetId===(target==='player'?1:follower));t++){w.tick++;ai.update();}
   observing=false;result.cells.push({tier,level,archetype:def.id,target,targetId:target==='player'?1:follower,ticks:w.tick-begin,attacks,scriptInterrupted:!e.infected.scripted,state:e.infected.state,firstAttack:attacks.find(a=>a.targetId===(target==='player'?1:follower))??null});ai.release(e);
  }
 }catch(error){result.errors.push({level,tier,error:String(error)});}finally{w?.dispose();}
 writeFileSync(process.env.SWEEP_G_RECEIPT_OUT ?? 'docs/reports/sweep-g/G-18-contact.json',JSON.stringify(result,null,2)+'\n');console.log(level,tier,result.cells.filter(c=>c.level===level&&c.tier===tier).length);
}
