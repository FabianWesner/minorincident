/** Ordinary moving L3 route: actual camera/HUD, streets, ramps, horde and compound. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
import type { Game } from '../../src/Game';
const out=process.env.L3_TOUR_OUT??'test-results/fix60-a/l3-tour';mkdirSync(`${out}/captures`,{recursive:true});
const runs=[];
try{for(const tier of ['low','high']as const){
 const session=new SceneSession({tier,backend:'webgpu',query:{ui:'1'}});
 try{
  await session.open();await session.page.evaluate('window.__name=f=>f');
  await session.page.evaluate(async tier=>{
   const a=window.__SS__!;a.settings.set({quality:tier});await a.loadLevel('L3',{seed:1,progression:'L3-default'});a.missions.begin();a.pause();a.camera.follow();a.camera.zoom(1);a.cheats.god(true);a.bot.start('complete',{street:'auto'});
   document.documentElement.setAttribute('data-scene-hud','');document.querySelectorAll('#hud,.hud').forEach(n=>n.setAttribute('data-scene-hud',''));
   if(!document.querySelector('[data-testid=survivor-portrait]'))throw Error('Full HUD not mounted');
  },tier);
  await session.page.addStyleTag({content:'.story-bubble{visibility:visible!important}'});
  const frames=[],samples=[];const captured=new Set<string>();let stopped=false;
  for(let i=0;i<1400;i++){
   const sample=await session.page.evaluate(async()=>{
    const a=window.__SS__!,game=(window.__SCENE__ as unknown as{game:Game}).game,w=game.world,s=w.missions!.state.l3!,p=w.entities.get(1)!,v=game.view.view;
    const figures=a.crowdFigures(),living=w.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission),drawn=living.filter(e=>figures.find(f=>f.id===e.id)?.drawn);
    const inView=drawn.filter(e=>{const q=game.view.project(e.transform.x,e.transform.y+.4,e.transform.z);return Math.abs(q[0])<1&&Math.abs(q[1])<1&&Math.abs(q[2])<1;});
    const r=a.getState().render;
    return{tick:w.tick,tier:r.quality,backend:r.backend,phase:s.phase,missionPhase:w.missions!.state.phase,player:{...p.transform},hp:p.health.current,handgunAt:s.handgunAt,attackAt:s.attackAt,fallbackAt:s.fallbackAt,finaleAt:s.finaleAt??0,barrierClosedAt:s.barrierClosedAt??0,crossedAt:s.crossedAt,doneAt:s.doneAt,furthest:s.furthest,
     camera:{position:v.camera.position.toArray(),target:v.cameraTarget.toArray(),distance:v.camera.position.distanceTo(v.cameraTarget),playerZoom:v.playerZoom},marker:r.missionMarker,courierForeground:r.courierForeground,courierOccluder:r.courierOccluder,occlusion:r.occlusion,
     hud:Array.from(document.querySelectorAll('#hud,.hud')).map(n=>(n as HTMLElement).innerText).join('\n'),living:living.length,drawnLiving:drawn.length,inViewLiving:inView.map(e=>e.id),insideCompound:living.filter(e=>e.transform.x>201.5).map(e=>e.id),nearPlayer:living.filter(e=>Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z)<=20).map(e=>e.id),
     soldiers:s.soldierIds.map(id=>{const e=w.entities.get(id);return{id,hidden:e?.hidden,at:e?.transform,drawn:figures.find(f=>f.id===id)?.drawn??false};}),
     military:w.districts!.districts.flatMap(d=>d.decay.placements.filter(q=>q.assetId.startsWith('veh.')&&q.position[0]>190).map(q=>({id:q.id,assetId:q.assetId,position:q.position}))),vfx:r.vfx};
   });
   samples.push(sample);const keys=[];
   if(!sample.attackAt)keys.push('yard-before-attack');
   if(sample.attackAt&&sample.tick>=sample.attackAt+60&&!sample.fallbackAt)keys.push('attack-1s');
   if(sample.attackAt&&sample.tick>=sample.attackAt+600&&!sample.fallbackAt)keys.push('attack-10s');
   if(sample.fallbackAt)keys.push('fallback-hud');
   for(const x of [-120,-80,-40,0,40,75,110,128,140,150,174,195])if(sample.player.x>=x)keys.push(`route-x${x}`);
   if(sample.inViewLiving.length>=80)keys.push('horde-80');
   if(sample.crossedAt){keys.push('compound-entry');if(sample.tick>=sample.crossedAt+300)keys.push('compound-rest-5s');if(sample.tick>=sample.crossedAt+890)keys.push('compound-evac-15s');}
   if(sample.barrierClosedAt)keys.push('barrier-closed');
   const fresh=keys.filter(k=>!captured.has(k));
   if(fresh.length){fresh.forEach(k=>captured.add(k));await session.page.evaluate(async()=>window.__SS__!.screenshotReady());const file=`${out}/captures/${tier}-t${sample.tick}-${fresh.join('_')}.png`;await session.page.screenshot({path:file});frames.push({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),keys:fresh,sample});}
   if(sample.crossedAt&&!stopped){await session.page.evaluate(()=>{window.__SS__!.bot.stop();window.__SS__!.input.clear();});stopped=true;}
   if(sample.doneAt||sample.missionPhase==='progression'||sample.missionPhase==='result')break;
   await session.page.evaluate(async()=>window.__SS__!.step(30));
  }
  runs.push({tier,method:'Uninterrupted complete-bot native InputFrames from fresh L3, default camera1; courier damage suppressed for visual/count observation. No actor relocation, spawns, objective skips or camera overrides. Half-second samples while moving; photographs at native milestones. Stop input after actual compound crossing, observe rest and evacuation. No timing measurements.',frames,samples});
  assert.deepEqual(session.errors,[]);console.log(tier,frames.length,samples.at(-1)?.phase,samples.at(-1)?.player.x);
 }finally{await session.close();}
}}finally{stopServer();writeFileSync(`${out}/receipt.json`,JSON.stringify({...provenance(),runs},null,2)+'\n');}
