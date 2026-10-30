import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {SceneSession,stopServer,readSpec} from '../scenelab/session';
import type {Game} from '../../src/Game';
import type {SceneSpec} from '../../src/debug/scenelab/spec';
const [phase='before',out='docs/reports/q249/rollout/l1']=process.argv.slice(2),directory=resolve(out);mkdirSync(directory,{recursive:true});
const session=new SceneSession({tier:'high',viewport:{width:1200,height:900},query:{skin:'1'},log:()=>{}});
const receipts=[];
try{
 await session.open();await session.page.evaluate(async()=>{const a=window.__SS__!;await a.loadLevel('L1',{seed:1});a.pause();a.cheats.god(true);a.missions.begin();a.teleport('player',{x:-66.2,z:11.5});});
 await session.page.addStyleTag({content:'#hud,.hud,.mission-subtitle,.story-bubble,[data-testid=mission-button]{visibility:hidden!important}'});
 for(const frame of [0,120]){
  if(frame)await session.page.evaluate(()=>window.__SS__!.step(120));
  await session.page.evaluate(()=>window.__SS__!.camera.cinematic({target:[-67,.95,11.7],position:[-63.4,4.2,15.3]},true));await session.ready();
  await session.page.screenshot({path:resolve(directory,`${phase}-production-bench-${frame}.png`)});
  receipts.push(await session.page.evaluate(()=>{const g=(window.__SCENE__ as unknown as {game:Game}).game;return {tick:g.world.tick,sitters:[...g.world.entities.iterate()].filter(e=>e.civilian?.schedule?.some(s=>s.seat)).map(e=>({id:e.id,model:e.civilian!.model,at:[e.transform.x,e.transform.y,e.transform.z],until:e.civilian!.activityUntil,started:e.civilian!.activityStarted,activity:e.civilian!.schedule![e.civilian!.scheduleStep??0]}))};}));
 }
 const spec:SceneSpec={name:'q249-po-bench',seed:1,ground:'district',time:'L1',dof:false,layout:{district:'D-GROVE',bbox:[[-80,0],[-56,24]]},actors:[
  {id:'heroine',kind:'courier',at:[-66.1,11.7],yaw:315,look:{model:'female',gearTier:2},state:'idle'},
  {id:'blue',kind:'pedestrian',at:[-66.5,12.7],yaw:315,look:{model:'npc.civilian-man-a',tint:'#3178ac',accessories:['acc.hat-flat-cap'],handProp:'coffee'},state:'idle'},
  {id:'sitter',kind:'pedestrian',at:[-66.7865,11.56],yaw:0,look:{model:'npc.civilian-man-b',tint:'#ac7a91',accessories:['acc.hat-baseball-cap'],handProp:'coffee'},state:{sit:'prop.bench:1301',seconds:600}}],camera:{mode:'pose',target:[-67,.95,11.8],position:[-63.5,3.8,15.3]}};
 await session.load(spec);await session.step(180);await session.ready();await session.page.screenshot({path:resolve(directory,`${phase}-po-bench.png`)});receipts.push({scene:spec.name,metrics:await session.metrics()});
 const depot=readSpec('specs/scenes/qa-handover-depot.json');depot.camera={mode:'close',target:[-37.4,1,-36.2],radius:7.5,azimuth:55};await session.load(depot);await session.step(150);await session.ready();await session.page.screenshot({path:resolve(directory,`${phase}-depot-handover.png`)});receipts.push({scene:depot.name,metrics:await session.metrics()});
 writeFileSync(resolve(directory,`${phase}-receipts.json`),JSON.stringify({receipts,consoleErrors:session.errors},null,2)+'\n');
 if(session.errors.length)throw Error(session.errors.join('\n'));
}finally{await session.close();stopServer();}
