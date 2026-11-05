/** Ordinary input to garage pickup, then same-state emergence/hold photographs. */
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import { provenance } from './accept/probe';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const out=process.env.GARAGE_BROWSER_OUT??'test-results/sweep-a2/garage';
const inspect=process.env.GARAGE_INSPECT==='1';mkdirSync(`${out}/captures`,{recursive:true});
const runs=[];
try {for(const tier of ['low','high'] as const){
 const s=new SceneSession({tier,backend:'webgpu',query:{ui:'1'}});
 try{
  await s.open();await s.page.evaluate('window.__name=f=>f');
  await s.page.evaluate(async tier=>{const a=window.__SS__!;a.settings.set({quality:tier});await a.loadLevel('L1',{seed:1});a.missions.begin();a.pause();a.camera.follow();a.camera.zoom(1);a.bot.start('complete');document.documentElement.setAttribute('data-scene-hud','');document.querySelectorAll('#hud,.hud').forEach(n=>n.setAttribute('data-scene-hud',''));
   for(let i=0;i<2000&&a.missions.state()!.steps.weapon.status!=='completed';i++)await a.step(5);
   if(a.missions.state()!.steps.weapon.status!=='completed')throw Error('Garage pickup not reached');a.bot.stop();a.input.clear();a.cheats.god(true);
  },tier);
  const frames=[],samples=[];let previous=-1;
  for(let i=0;i<=300;i++){
   const q=await s.page.evaluate(()=>{const g=(window.__SCENE__ as unknown as{game:Game}).game,w=g.world,l=w.missions!.state.l1!,p=w.entities.get(1)!,h=l.house;return{tick:w.tick,player:{...p.transform},house:h,actors:h?.ids.map(id=>{const e=w.entities.get(id)!;return{id,hidden:!!e.hidden,pending:!!e.pendingAdmission,hp:e.health.current,at:{...e.transform},mode:e.infected?.l1?.mode,target:e.infected?.l1?.targetId};})??[]};});samples.push(q);const count=q.actors.filter(e=>!e.hidden&&!e.pending).length;
   if(inspect?(count>0&&count!==previous):(i===0||count!==previous||[20,60,180,300].includes(i)))for(const zoom of (inspect?[1]:[.5,1.5])){
    await s.page.evaluate(async zoom=>{window.__SS__!.camera.zoom(zoom);await window.__SS__!.screenshotReady();},zoom);
    if(inspect)await s.page.evaluate(()=>{const g=(window.__SCENE__ as unknown as{game:Game}).game,h=g.world.missions!.state.l1!.house!;g.view.view.inspectionPose={position:[h.x+6,12,h.z+6],target:[h.x,1,h.z]};g.view.update(1);});
    if(inspect)await s.page.evaluate(async()=>window.__SS__!.screenshotReady());
    const file=`${out}/captures/${tier}-t${q.tick}-n${count}-z${zoom}.png`;await s.page.screenshot({path:file});frames.push({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),sample:q,zoom});
   }
   if(inspect&&count>=10)break;
   if(inspect)await s.page.evaluate(()=>{(window.__SCENE__ as unknown as{game:Game}).game.view.view.inspectionPose=null;});
   previous=count;await s.page.evaluate(async()=>{window.__SS__!.camera.zoom(1);await window.__SS__!.step(30);});
  }
  runs.push({tier,frames,samples,errors:s.errors});console.log(tier,frames.length);
 }finally{await s.close();}
}}finally{stopServer();writeFileSync(`${out}/receipt.json`,JSON.stringify({...provenance(),inspection:inspect,method:'Ordinary native complete input to bat, then empty input; courier damage protection after pickup only. Default follow simulation camera1; photographs at actual zoom limits restored before next simulation step. No relocation/spawns/skips;150s hold.',runs},null,2));}
