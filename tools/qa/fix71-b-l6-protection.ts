/** Mortal production-input routes with read-only follower/attack evidence. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { LevelSixBot } from '../../src/debug/bot/LevelSixBot';
import { preset } from '../../src/sim/progression/Campaign';
import { stateHash } from '../../src/sim/world/stateHash';
import { loadLevel } from '../sim-runner/levels';
import { followFrustum } from '../sim-runner/l3Bots';
import { provenance } from './accept/probe';
import { emptyInput } from '../../src/input/InputFrame';
const rows=[];
for(const tier of (process.argv.includes('--quick')?['low']:['low','high']) as ('low'|'high')[]) for(const policy of (process.argv.includes('--quick')?['complete']:['complete','evade-only']) as ('complete'|'evade-only')[]){
 const campaign=preset('L6-default');campaign.settings.quality=tier;
 const w=await loadLevel('L6',1,campaign,0,{quality:tier});
 try{
  const bot=new LevelSixBot(w,policy),bites:unknown[]=[],samples:unknown[]=[];let frame=emptyInput();
  w.events.on('outbreak.bite',event=>{
   if(event.type!=='outbreak.bite'||!w.missions!.state.l6!.survivors.some(r=>r.id===event.targetId))return;
   const b=w.entities.get(event.sourceId)!,p=w.entities.get(1)!;
   bites.push({...event,attacker:{archetype:b.archetype,health:{...b.health},infected:structuredClone(b.infected)},input:structuredClone(frame),range:Math.hypot(p.transform.x-b.transform.x,p.transform.z-b.transform.z),visible:w.infected!.nav.visible(p.transform,b.transform,0),shotClear:w.combat!.query.shotVisible(p.transform,b.transform,b.id),inView:w.infected!.director.inPlayerView(b.transform,Infinity,1)});
  });
  for(let t=0;t<600*60&&!bot.finished;t++){
   followFrustum(w);frame=bot.sample();w.applyInput(frame,'keyboard');w.update();
   if(w.tick%60===0){const s=w.missions!.state.l6!,p=w.entities.get(1)!.transform;samples.push({tick:w.tick,phase:s.phase,player:{...p},leader:{x:s.leaderX,z:s.leaderZ},paused:s.paused,followers:s.survivors.filter(r=>r.status==='following').map(r=>({id:r.id,...w.entities.get(r.id)!.transform}))});}
  }
  const result=w.missions!.state.result;
  const row={tier,policy,result,seconds:w.missions!.state.stats.time,deaths:w.missions!.state.stats.deaths,finalHash:stateHash(w.getState()),roster:structuredClone(w.missions!.state.l6!.survivors),bites,samples};rows.push(row);
  console.log(JSON.stringify({tier,policy,out:result?.rescued,in:result?.survivorsIn,lost:result?.survivorsLost,deaths:row.deaths,seconds:row.seconds,bites:bites.length}));
 }finally{w.dispose();}
}
mkdirSync('test-results/fix71-b',{recursive:true});writeFileSync('test-results/fix71-b/l6-protection.json',JSON.stringify({...provenance(),rows},null,2)+'\n');
