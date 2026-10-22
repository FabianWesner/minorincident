import type { Game } from '../../src/Game';
import type { CampaignSave } from '../../src/sim/progression/Campaign';

export type Finding = 'depot-clerk' | 'lab-handover' | 'hats-glasses' | 'sitters-benches' | 'l3-gaps' | 'l4-tank';
export interface TourStop {
  id: string; level: string; title: string; setup?: 'depot-contact' | 'depot-return' | 'lab-sign' | 'lab-return' | 'firestation' | 'l3-finale' | 'l4-alarm' | 'l4-tank-enter' | 'l4-tank-hold' | 'l5-survivor' | 'l5-metro' | 'l6-gate' | 'l6-finale' | 'l7-rocket' | 'l7-corridor' | 'l7-bus' | 'l8-breach' | 'l8-escape' | 'l8-departure' | 'l9-approach' | 'l9-crawl' | 'l9-fall';
  checkpoint?: string; anchor?: string; target?: [number, number, number]; findings?: Finding[]; wait?: number;
}
export const tour: TourStop[] = [
  { id:'l1-depot-contact',level:'L1',title:'Depot: parcel handover',setup:'depot-contact',findings:['depot-clerk'] },
  { id:'l1-depot-return',level:'L1',title:'Depot: clerk walks back and closes the door',setup:'depot-return',findings:['depot-clerk'] },
  { id:'l1-lab-sign',level:'L1',title:'Lab: technician signs for the package',setup:'lab-sign',findings:['lab-handover'] },
  { id:'l1-lab-return',level:'L1',title:'Lab: technician returns through the doors',setup:'lab-return',findings:['lab-handover'] },
  { id:'l1-bike-rack',level:'L1',title:'Bike rack and pedestrians',anchor:'lab-bike-rack',findings:['hats-glasses'] },
  { id:'l1-park',level:'L1',title:'Park benches and pedestrian accessories',target:[-68,0,15],findings:['hats-glasses'] },
  { id:'l1-firestation',level:'L1',title:'Fire station approach and firefighter',setup:'firestation',anchor:'fire-bay-door' },
  { id:'l2-ride-start',level:'L2',title:'Ride start: bench sitters and accessories',anchor:'l2-bench-2',findings:['sitters-benches','hats-glasses'] },
  { id:'l3-ramp-west',level:'L3',title:'Raised corridor: western ramp/deck junction',checkpoint:'fallback',target:[167.5,5.7,0],findings:['l3-gaps'] },
  { id:'l3-ramp-east',level:'L3',title:'Raised corridor: eastern ramp/deck junction',checkpoint:'fallback',target:[179.5,5.7,0],findings:['l3-gaps'] },
  { id:'l3-army-pullback',level:'L3',title:'Army checkpoint: route ring during pull-back',checkpoint:'fallback',setup:'l3-finale' },
  { id:'l4-alarm',level:'L4',title:'Plaza: alarm wave and fleeing civilians',checkpoint:'arrival',setup:'l4-alarm',anchor:'l4-plaza' },
  { id:'l4-tank-enter',level:'L4',title:'Tank route through the barrier',checkpoint:'arrival',setup:'l4-tank-enter',target:[-20,0,35],findings:['l4-tank'] },
  { id:'l4-tank-hold',level:'L4',title:'Tank parked beside the plaza barrier',checkpoint:'arrival',setup:'l4-tank-hold',target:[-20,0,23],findings:['l4-tank'] },
  { id:'l4-civilians',level:'L4',title:'Plaza hold: civilians at the wall',checkpoint:'arrival',anchor:'l4-plaza',wait:180 },
  { id:'l5-start',level:'L5',title:'Aftermath: cellar start' },
  { id:'l5-gate',level:'L5',title:'Aftermath: open cellar doorway',checkpoint:'outside',anchor:'l5-cellar-door' },
  { id:'l5-handover',level:'L5',title:'Aftermath: survivor joins the courier',checkpoint:'outside',setup:'l5-survivor' },
  { id:'l5-finale',level:'L5',title:'Aftermath: Metro entrance and shutter',checkpoint:'survivor-5',setup:'l5-metro',anchor:'l5-metro-in' },
  { id:'l6-start',level:'L6',title:'Subway: shelter start' },
  { id:'l6-gate',level:'L6',title:'Subway: gate at 150 m',checkpoint:'abandon',setup:'l6-gate' },
  { id:'l6-handover',level:'L6',title:'Subway: abandoned shelter',checkpoint:'abandon' },
  { id:'l6-finale',level:'L6',title:'Subway: exit platform',checkpoint:'abandon',setup:'l6-finale' },
  { id:'l7-start',level:'L7',title:'Ruined city: night exit' },
  { id:'l7-gate',level:'L7',title:'Ruined city: evacuation corridor',checkpoint:'rocket',setup:'l7-corridor',anchor:'l7-corridor-east' },
  { id:'l7-handover',level:'L7',title:'Ruined city: rocket handover',setup:'l7-rocket',anchor:'l7-rocket' },
  { id:'l7-finale',level:'L7',title:'Ruined city: evacuation bus',checkpoint:'corridor',setup:'l7-bus',anchor:'l7-bus-boarding' },
  { id:'l8-start',level:'L8',title:'Zoo: sanctuary start' },
  { id:'l8-gate',level:'L8',title:'Zoo: breached gate',setup:'l8-breach',anchor:'tunnel-outlet-1' },
  { id:'l8-handover',level:'L8',title:'Zoo: escape route handover',setup:'l8-escape',anchor:'exit' },
  { id:'l8-finale',level:'L8',title:'Zoo: armored departure',setup:'l8-departure',anchor:'exit' },
  { id:'l9-start',level:'L9',title:'Crossing: transport start' },
  { id:'l9-gate',level:'L9',title:'Crossing: outskirts approach',setup:'l9-approach' },
  { id:'l9-handover',level:'L9',title:'Crossing: crawl clear of the wreck',setup:'l9-crawl' },
  { id:'l9-finale',level:'L9',title:'Crossing: bridge collapse',setup:'l9-fall' },
  { id:'l10-start',level:'L10',title:'Cure: crash start' },
  { id:'l10-gate',level:'L10',title:'Cure: military gate',checkpoint:'cure-military' },
  { id:'l10-handover',level:'L10',title:'Cure: research handover',checkpoint:'cure-research-entry' },
  { id:'l10-finale',level:'L10',title:'Cure: dispersal finale',checkpoint:'cure-disperse-ready' },
];

/** Runs in the snapshot's own test harness. Only campaign APIs and ordinary bot inputs move actors. */
export async function prepareStop({ stop, seed, save, zoom, driveRoute }: { stop:TourStop; seed:number; save:CampaignSave|null; zoom:number; driveRoute?:readonly (readonly number[])[] }) {
  const a=window.__SS__!, g=(window.__SCENE__ as unknown as {game:Game}).game;
  await a.ready; a.pause();
  if(save) a.campaign.restore(save);
  if(stop.checkpoint) await a.unloadScenario();
  await a.loadLevel(stop.level,{seed,...(stop.checkpoint?{checkpoint:stop.checkpoint}:{})}); a.pause();
  a.missions.begin();
  a.cheats.god(true); a.settings.set({quality:'low',cameraShake:false,cheapDof:false,vfx:false});
  a.debug.figureJoints(false); g.ui.show(null);
  const rig=g.view.view;rig.inspectionPose=null;rig.follow();rig.zoom(Math.log(zoom/rig.getState().targetZoom),true);
  const seek=async(predicate:()=>boolean,maxTicks=18000)=>{
    const start=a.tick();
    while(!predicate()) {
      if(a.tick()-start>=maxTicks) throw new Error(`Tour stop ${stop.id} was not reached: ${JSON.stringify({tick:a.tick(),player:a.getState().player?.transform,completed:a.missions.state()?.completedObjectives})}`);
      await a.step(30);
    }
  };
  const l1=()=>a.missions.state()!.l1!;
  // Walker uses this same public navigation steering; only ordinary input frames move the courier.
  const walkTo=async(target:{x:number;z:number},stopM=1.2)=>{
    const route={path:[] as number[],goal:-1,pathIndex:0},waypoint={x:0,z:0},started=a.tick();
    while(true){
      const p=a.getState().player!.transform;if(Math.hypot(p.x-target.x,p.z-target.z)<=stopM)break;
      if(a.tick()-started>30000)throw new Error(`Walking tour did not reach ${target.x},${target.z}`);
      const ok=g.world.infected!.nav.steer(p,target,route,.45,waypoint,Infinity,true);
      if(!ok)throw new Error(`No connected walk route to ${target.x},${target.z}`);
      const dx=waypoint.x-p.x,dz=waypoint.z-p.z,d=Math.hypot(dx,dz)||1,speed=Math.min(1,d/1.2);
      a.input.set({move:{x:dx/d*speed,z:dz/d*speed}});await a.step(6);
    }
    a.input.clear();
  };
  if(stop.setup?.startsWith('depot')||stop.setup?.startsWith('lab')) {
    a.bot.start('complete');
    if(stop.setup==='depot-contact') await seek(()=>!!l1().carrying&&l1().beat?.id==='pickup');
    if(stop.setup==='depot-return') await seek(()=>{const s=l1();return !!s.carrying&&a.getEntity(s.clerkId??0)?.civilian?.story?.clip==='npc-walk';});
    if(stop.setup==='lab-sign') await seek(()=>a.getEntity(l1().techId)?.civilian?.story?.clip==='npc-sign');
    if(stop.setup==='lab-return') await seek(()=>l1().handoverAt>0&&a.getEntity(l1().techId)?.civilian?.story?.clip==='npc-carry');
    a.bot.stop();a.input.clear();
  }
  if(stop.setup==='firestation') {
    await a.loadLevel('L1',{seed,checkpoint:'bat'});a.pause();a.cheats.god(true);a.bot.start('complete');
    const door=g.world.missions!.def.anchors['fire-bay-door'];
    await seek(()=>{const p=a.getState().player!.transform;return Math.hypot(p.x-door.x,p.z-door.z)<9;});a.bot.stop();a.input.clear();
  }
  if(stop.setup==='l3-finale') {a.bot.start('complete');await seek(()=>!!a.missions.state()!.l3!.finaleAt,30000);a.bot.stop();a.input.clear();}
  if(stop.setup==='l5-survivor'||stop.setup==='l5-metro') {
    a.bot.start('complete');
    if(stop.setup==='l5-survivor')await seek(()=>a.missions.state()!.l5!.found>0,60000);
    else {const at=g.world.missions!.def.anchors['l5-metro-in'];await seek(()=>{const p=a.getState().player!.transform;return Math.hypot(p.x-at.x,p.z-at.z)<7;},60000);}
    a.bot.stop();a.input.clear();
  }
  if(stop.setup?.startsWith('l7-')) {
    const name=stop.setup==='l7-rocket'?'l7-rocket':stop.setup==='l7-corridor'?'l7-corridor-east':'l7-bus-boarding';
    await walkTo(g.world.missions!.def.anchors[name],stop.setup==='l7-bus'?3:1.2);
    if(stop.setup==='l7-rocket'){a.input.set({interact:true});await a.step(45);a.input.clear();}
  }
  if(stop.setup==='l6-gate'||stop.setup==='l6-finale') {
    a.bot.start('complete');await seek(()=>a.missions.state()!.l6!.leaderX>=(stop.setup==='l6-gate'?148:246),90000);a.bot.stop();a.input.clear();
  }
  if(stop.setup?.startsWith('l8-')) {
    await seek(()=>g.world.missions!.l8!.state.breachedAt>0,6000);
    if(stop.setup!=='l8-breach') {a.bot.start('complete');await seek(()=>g.world.missions!.l8!.state.escapeCheckpoint,60000);a.bot.stop();a.input.clear();}
    if(stop.setup==='l8-departure') {a.bot.start('complete');await seek(()=>g.world.vehicles!.active!==null,60000);a.bot.stop();a.input.clear();}
  }
  if(stop.setup?.startsWith('l9-')) {
    if(!driveRoute)throw new Error('L9 requires the authored road route');
    let index=1;const started=a.tick();
    while(g.world.missions!.l9!.state.phase==='driving') {
      if(a.tick()-started>90000)throw new Error('L9 driving tour did not reach the outskirts');
      const p=a.getEntity(g.world.missions!.l9!.state.carId)!.transform;
      while(index<driveRoute.length-1&&Math.hypot(driveRoute[index][0]-p.x,driveRoute[index][1]-p.z)<16)index++;
      const want=-Math.atan2(driveRoute[index][1]-p.z,driveRoute[index][0]-p.x),delta=Math.atan2(Math.sin(want-p.yaw),Math.cos(want-p.yaw));
      a.input.set({drive:{throttle:.7,steer:Math.max(-1,Math.min(1,delta*2))}});await a.step(30);
    }
    a.input.clear();
    if(stop.setup==='l9-fall')await seek(()=>g.world.missions!.l9!.state.phase==='fall',2000);
    if(stop.setup==='l9-crawl')await seek(()=>g.world.missions!.l9!.state.phase==='crawl',2000);
  }
  if(stop.setup?.startsWith('l4-')) {
    a.missions.completeObjective('quartermaster');await a.step(1);
    if(stop.setup==='l4-alarm') await seek(()=>a.missions.state()!.l4!.turnAt>0,6000);
    else {
      await seek(()=>a.missions.state()!.l4!.tankId>0,9000);
      if(stop.setup==='l4-tank-enter') await seek(()=>{const e=a.getEntity(a.missions.state()!.l4!.tankId);return !!e&&e.transform.x>-24&&e.transform.z<39;},9000);
      if(stop.setup==='l4-tank-hold') await seek(()=>a.missions.state()!.l4!.tankPhase==='hold',9000);
    }
  }
  if(stop.wait) await a.step(stop.wait);
  const anchor=stop.anchor?g.world.missions!.def.anchors[stop.anchor]:null;
  if(stop.anchor&&!anchor) throw new Error(`Unknown tour anchor ${stop.level}/${stop.anchor}`);
  const target=stop.target??(anchor?[anchor.x,anchor.y??0,anchor.z] as [number,number,number]:null);
  const state=a.missions.state()!;
  return {target,tick:a.tick(),scenario:a.getState().scenario,phase:state.phase,checkpoint:state.checkpoint,completed:state.completedObjectives,
    l1:state.l1?{phase:state.l1.phase,carrying:state.l1.carrying,clerkId:state.l1.clerkId,techId:state.l1.techId,handoverAt:state.l1.handoverAt,beat:state.l1.beat?.id}:null,
    l2:state.l2?{phase:state.l2.phase,benchIds:state.l2.benchIds}:null,
    l3:state.l3?{phase:state.l3.phase,finaleAt:state.l3.finaleAt}:null,
    l4:state.l4?{phase:state.l4.phase,turnAt:state.l4.turnAt,tankId:state.l4.tankId,tankPhase:state.l4.tankPhase}:null,
    campaign:{unlocked:a.campaign.state()?.unlockedLevel,completed:a.campaign.state()?.completedLevels,character:a.campaign.state()?.character},player:a.getState().player?.transform};
}

/** The authored game rig (25 degree FOV, isometric polar/azimuth) looks around without relocating the player. */
export async function readyFrame({target,zoom,ticks}:{target:[number,number,number]|null;zoom:number;ticks:number}) {
  const a=window.__SS__!,g=(window.__SCENE__ as unknown as {game:Game}).game;
  if(ticks) await a.step(ticks);
  const rig=g.view.view;
  if(target) {
    const radius=19*zoom,s=Math.sin(rig.polar)*radius;
    rig.inspectionPose={target,position:[target[0]+s*Math.sin(rig.azimuth),target[1]+Math.cos(rig.polar)*radius,target[2]+s*Math.cos(rig.azimuth)]};
    rig.inspectionGameLod=false;
  }
  await a.screenshotReady();
  const focus=target??[a.getState().player!.transform.x,0,a.getState().player!.transform.z];
  const actors=a.query({}).filter(e=>(!!e.civilian||e.archetype==='veh.tank')&&Math.hypot(e.transform.x-focus[0],e.transform.z-focus[2])<15).map(e=>({id:e.id,archetype:e.archetype,at:e.transform,hidden:e.hidden,model:e.civilian?.model,clip:e.civilian?.story?.clip,activity:e.civilian?.schedule?.[e.civilian.scheduleStep??0]?.activity}));
  return {tick:a.tick(),backend:a.perf().backend,quality:a.getState().render.quality,camera:a.getState().render.camera,actors,drawn:a.crowdFigures().filter(f=>f.drawn&&actors.some(e=>e.id===f.id)).map(f=>({id:f.id,lod:f.lod,clip:f.clip,accessory:f.appearance?.accessory}))};
}
