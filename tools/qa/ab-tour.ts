import type { Game } from '../../src/Game';
import type { CampaignSave } from '../../src/sim/progression/Campaign';
import type { BufferGeometry, Object3D } from 'three/webgpu';
import type { InstancedGroup } from '../../src/render/InstancedGroup';

export type Finding = 'depot-clerk' | 'lab-handover' | 'hats-glasses' | 'sitters-benches' | 'l3-gaps' | 'l4-tank';
export interface TourStop {
  id: string; level: string; title: string; setup?: 'depot-contact' | 'depot-return' | 'lab-sign' | 'lab-return' | 'glasses' | 'firestation' | 'l2-benches' | 'l3-finale' | 'l4-alarm' | 'l4-tank-enter' | 'l4-tank-hold' | 'l5-survivor' | 'l5-metro' | 'l6-gate' | 'l6-finale' | 'l7-rocket' | 'l7-corridor' | 'l7-bus' | 'l8-breach' | 'l8-escape' | 'l8-departure' | 'l9-approach' | 'l9-crawl' | 'l9-fall' | 'l10-research' | 'l10-defense';
  checkpoint?: string; anchor?: string; target?: [number, number, number]; findings?: Finding[]; wait?: number;
}
export const tour: TourStop[] = [
  { id:'l1-depot-contact',level:'L1',title:'Depot: parcel handover',setup:'depot-contact',findings:['depot-clerk'] },
  { id:'l1-depot-return',level:'L1',title:'Depot: clerk walks back and closes the door',setup:'depot-return',findings:['depot-clerk'] },
  { id:'l1-lab-sign',level:'L1',title:'Lab: technician signs for the package',setup:'lab-sign',findings:['lab-handover'] },
  { id:'l1-lab-return',level:'L1',title:'Lab: technician returns through the doors',setup:'lab-return',findings:['lab-handover'] },
  { id:'l1-bike-rack',level:'L1',title:'Bike rack and pedestrians',anchor:'lab-bike-rack',findings:['hats-glasses'] },
  { id:'l1-park',level:'L1',title:'Park benches and pedestrian accessories',target:[-68,0,15],findings:['hats-glasses'] },
  { id:'l1-glasses',level:'L1',title:'Seeded pedestrian wearing glasses',setup:'glasses',findings:['hats-glasses'] },
  { id:'l1-firestation',level:'L1',title:'Fire station approach and firefighter',setup:'firestation',anchor:'fire-bay-door' },
  { id:'l2-ride-start',level:'L2',title:'Ride start: bench sitters and accessories',setup:'l2-benches',anchor:'l2-bench-2',findings:['sitters-benches','hats-glasses'] },
  { id:'l3-ramp-west',level:'L3',title:'Raised corridor: western ramp/deck junction',checkpoint:'fallback',target:[167.5,5.7,0],findings:['l3-gaps'] },
  { id:'l3-ramp-east',level:'L3',title:'Raised corridor: eastern ramp/deck junction',checkpoint:'fallback',target:[179.5,5.7,0],findings:['l3-gaps'] },
  { id:'l3-army-pullback',level:'L3',title:'Army checkpoint: route ring during pull-back',checkpoint:'fallback',setup:'l3-finale' },
  { id:'l4-alarm',level:'L4',title:'Plaza: alarm wave and fleeing civilians',checkpoint:'arrival',setup:'l4-alarm',anchor:'l4-plaza' },
  { id:'l4-tank-enter',level:'L4',title:'Tank route through the barrier',checkpoint:'arrival',setup:'l4-tank-enter',target:[-20,0,35],findings:['l4-tank'] },
  { id:'l4-tank-hold',level:'L4',title:'Tank parked beside the plaza barrier',checkpoint:'arrival',setup:'l4-tank-hold',target:[-20,0,23],findings:['l4-tank'] },
  { id:'l4-civilians',level:'L4',title:'Plaza hold: alarm arrivals and civilians at the wall',checkpoint:'arrival',setup:'l4-alarm',anchor:'l4-plaza',wait:600 },
  { id:'l5-start',level:'L5',title:'Aftermath: cellar start' },
  { id:'l5-gate',level:'L5',title:'Aftermath: open cellar doorway',checkpoint:'outside',anchor:'l5-cellar-door' },
  { id:'l5-handover',level:'L5',title:'Aftermath: survivor joins the courier',checkpoint:'outside',setup:'l5-survivor' },
  { id:'l5-finale',level:'L5',title:'Aftermath: Metro entrance and shutter',checkpoint:'survivor-5',setup:'l5-metro',anchor:'l5-metro-in' },
  { id:'l6-start',level:'L6',title:'Subway: shelter start' },
  { id:'l6-gate',level:'L6',title:'Subway: gate at 150 m',checkpoint:'abandon',setup:'l6-gate' },
  { id:'l6-handover',level:'L6',title:'Subway: abandoned shelter',checkpoint:'abandon' },
  { id:'l6-finale',level:'L6',title:'Subway: survivors emerge into the night',checkpoint:'abandon',setup:'l6-finale' },
  { id:'l7-start',level:'L7',title:'Ruined city: night exit' },
  { id:'l7-gate',level:'L7',title:'Ruined city: evacuation corridor',checkpoint:'rocket',setup:'l7-corridor',anchor:'l7-corridor-east' },
  { id:'l7-handover',level:'L7',title:'Ruined city: rocket handover',setup:'l7-rocket',anchor:'l7-rocket' },
  { id:'l7-finale',level:'L7',title:'Ruined city: evacuation bus',checkpoint:'corridor',setup:'l7-bus',anchor:'l7-bus-boarding' },
  { id:'l8-start',level:'L8',title:'Zoo: sanctuary start' },
  { id:'l8-gate',level:'L8',title:'Zoo: breached gate',setup:'l8-breach',anchor:'tunnel-outlet-1' },
  { id:'l8-handover',level:'L8',title:'Zoo: escape route handover',setup:'l8-escape',anchor:'exit' },
  { id:'l8-finale',level:'L8',title:'Zoo: APC boarding finale',setup:'l8-departure',anchor:'exit' },
  { id:'l9-start',level:'L9',title:'Crossing: transport start' },
  { id:'l9-gate',level:'L9',title:'Crossing: outskirts approach',setup:'l9-approach' },
  { id:'l9-handover',level:'L9',title:'Crossing: crawl clear of the wreck',setup:'l9-crawl' },
  { id:'l9-finale',level:'L9',title:'Crossing: bridge collapse',setup:'l9-fall' },
  { id:'l10-start',level:'L10',title:'Cure: crash start' },
  { id:'l10-gate',level:'L10',title:'Cure: military gate',checkpoint:'cure-military' },
  { id:'l10-handover',level:'L10',title:'Cure: research recording and canister pickup',checkpoint:'cure-research-entry',setup:'l10-research' },
  { id:'l10-finale',level:'L10',title:'Cure: activated dispersal defense',checkpoint:'cure-disperse-ready',setup:'l10-defense' },
];

/** Runs in the snapshot's own test harness. Only campaign APIs and ordinary bot inputs move actors. */
export async function prepareStop({ stop, seed, save, zoom, driveRoute, walkRoute }: { stop:TourStop; seed:number; save:CampaignSave|null; zoom:number; driveRoute?:readonly (readonly number[])[]; walkRoute?:readonly (readonly number[])[] }) {
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
  // Use the actual capsule clearance and player route workspace; only ordinary input frames move the courier.
  const walkTo=async(target:{x:number;z:number},stopM=1.2)=>{
    const initial=g.world.entities.get(1)!.transform;
    if(Math.hypot(initial.x-target.x,initial.z-target.z)<=stopM)return;
    const route={path:[] as number[],goal:-1,pathIndex:0},waypoint={x:0,z:0},started=a.tick(),frame=structuredClone(g.world.inputFrame);
    let arrived=false;
    g.input.feed={scheme:'keyboard',next:()=>{
      const p=g.world.entities.get(1)!.transform;
      if(Math.hypot(p.x-target.x,p.z-target.z)<=stopM){arrived=true;frame.move={x:0,z:0};return frame;}
      const ok=g.world.infected!.nav.forPlayer(.35).steer(p,target,route,.35,waypoint,Infinity,true);
      if(!ok)throw new Error(`No connected walk route from ${p.x},${p.z} to ${target.x},${target.z}`);
      const dx=waypoint.x-p.x,dz=waypoint.z-p.z,d=Math.hypot(dx,dz)||1,speed=Math.min(1,d/1.2);
      frame.move={x:dx/d*speed,z:dz/d*speed};return frame;
    }};
    try{while(!arrived){if(a.tick()-started>30000)throw new Error(`Walking tour did not reach ${target.x},${target.z}: ${JSON.stringify(g.world.entities.get(1)!.transform)}`);await a.step(stopM<=1?6:60);}}
    finally{g.input.feed=null;a.input.clear();}
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
    if(stop.setup!=='l7-rocket')for(const [x,z] of [[245,16],[215,16],[175,16],[135,16],[88,16],[88,46],[76,46],[-30,47.5]])await walkTo({x,z},2);
    await walkTo(g.world.missions!.def.anchors[name],stop.setup==='l7-bus'?3:1.2);
    if(stop.setup==='l7-rocket'){a.input.set({interact:true});await a.step(45);a.input.clear();}
  }
  if(stop.setup==='l2-benches'){
    const start=g.world.missions!.def.anchors['l2-start'];
    // Walk off the station apron: remaining inside its broad bounds reveals the accidentally culled benches.
    await walkTo({x:start.x+10,z:start.z},1.2);await a.step(300);
  }
  if(stop.setup==='l6-gate'||stop.setup==='l6-finale') {
    a.bot.start('complete');await seek(()=>{const s=a.missions.state()!.l6!;return stop.setup==='l6-gate'?s.leaderX>=148:s.exitAt>0;},90000);a.bot.stop();a.input.clear();
  }
  if(stop.setup?.startsWith('l8-')) {
    await seek(()=>g.world.missions!.l8!.state.breachedAt>0,6000);
    if(stop.setup!=='l8-breach') {a.bot.start('complete');await seek(()=>g.world.missions!.l8!.state.escapeCheckpoint,60000);a.bot.stop();a.input.clear();}
    if(stop.setup==='l8-departure') {a.bot.start('complete');await seek(()=>g.world.vehicles!.active!==null,60000);a.bot.stop();a.input.clear();}
  }
  if(stop.setup?.startsWith('l9-')) {
    if(!driveRoute)throw new Error('L9 requires the authored road route');
    // Match LevelNineBot's pure pursuit policy through the game's public replay input feed.
    // Vehicles interpret these axes in keyboard mode; mouse-only mode expects clicked destinations.
    let index=1;const started=a.tick(),frame=structuredClone(g.world.inputFrame);
    const switchRadius=(i:number)=>{
      const [a,b,c]=[driveRoute[i-1],driveRoute[i],driveRoute[i+1]];if(!c)return 6;
      const turn=Math.atan2(c[1]-b[1],c[0]-b[0])-Math.atan2(b[1]-a[1],b[0]-a[0]);
      return 6+10*Math.min(1,Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))/(Math.PI/2));
    };
    g.input.feed={scheme:'keyboard',next:()=>{
      if(g.world.missions!.l9!.state.phase!=='driving'){frame.drive={throttle:0,steer:0};return frame;}
      const p=a.getEntity(g.world.missions!.l9!.state.carId)!.transform;
      while(index<driveRoute.length-1&&Math.hypot(driveRoute[index][0]-p.x,driveRoute[index][1]-p.z)<switchRadius(index))index++;
      const want=-Math.atan2(driveRoute[index][1]-p.z,driveRoute[index][0]-p.x),delta=Math.atan2(Math.sin(want-p.yaw),Math.cos(want-p.yaw));
      frame.drive={throttle:.7,steer:Math.max(-1,Math.min(1,delta*2))};return frame;
    }};
    try{
      while(g.world.missions!.l9!.state.phase==='driving') {
        const p=a.getEntity(g.world.missions!.l9!.state.carId)!.transform;
        if(a.tick()-started>90000)throw new Error(`L9 driving tour did not reach the outskirts: ${JSON.stringify({car:p,waypoint:index})}`);
        await a.step(60);
      }
    }finally{g.input.feed=null;a.input.clear();}
    if(stop.setup==='l9-fall')await seek(()=>g.world.missions!.l9!.state.phase==='fall',2000);
    if(stop.setup==='l9-crawl')await seek(()=>g.world.missions!.l9!.state.phase==='crawl',2000);
  }
  if(stop.level==='L10'&&stop.checkpoint){
    // Graph-prefix loading reconstructs inventory/objectives, but does not move the courier to a later region.
    // Walk the authored road instead of relabelling a crash-area frame as a military/research/finale frame.
    if(!walkRoute?.length)throw new Error('L10 requires its authored campaign walk route');
    for(const [x,z] of walkRoute){console.log(`[qa-ab] ${stop.id}: walking to ${x},${z} at tick ${a.tick()}`);await walkTo({x,z},3);}
    const anchors=g.world.missions!.def.anchors;
    if(stop.setup==='l10-research'){
      for(const [x,z] of [[2527,-5],[2527,45],[2707,45]])await walkTo({x,z},2);
      await walkTo(anchors['cure-terminal'],.8);a.input.set({interact:true});await a.step(45);a.input.clear();
      if(!a.missions.state()!.states['terminal-read'])throw new Error('Research recording was not reached');
      await walkTo(anchors['cure-canister'],.8);a.input.set({interact:true});await a.step(45);a.input.clear();
      if(!a.missions.state()!.states['cure-carried'])throw new Error('Cure canister was not collected');
    }
    if(stop.setup==='l10-defense'){
      await walkTo(anchors['cure-console'],.8);a.input.set({interact:true});await a.step(1);a.input.clear();
      if(!a.missions.state()!.states['charge-active'])throw new Error('Dispersal defense was not activated');
      await a.step(120);
    }
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
  let actorFocus:null|{id:number;accessory:string;model?:string}=null;
  let cameraTarget=target;
  if(stop.setup==='glasses'){
    // Glasses are authored into these civilian GLBs; hats/hair use separate shared accessory assets.
    const people=a.query({}).filter(e=>e.civilian&&!e.hidden);
    const wearer=people.find(e=>['npc.civilian-elderly','npc.civilian-woman-b'].includes(e.civilian!.model??''));
    if(!wearer)throw new Error('No existing glasses wearer in the seeded L1 population');
    cameraTarget=[wearer.transform.x,Math.max(0,wearer.transform.y-.72),wearer.transform.z];actorFocus={id:wearer.id,accessory:'glasses',model:wearer.civilian!.model};
  }
  return {target:cameraTarget,actorFocus,tick:a.tick(),scenario:a.getState().scenario,phase:state.phase,checkpoint:state.checkpoint,completed:state.completedObjectives,
    l1:state.l1?{phase:state.l1.phase,carrying:state.l1.carrying,clerkId:state.l1.clerkId,techId:state.l1.techId,handoverAt:state.l1.handoverAt,beat:state.l1.beat?.id}:null,
    l2:state.l2?{phase:state.l2.phase,benchIds:state.l2.benchIds}:null,
    l3:state.l3?{phase:state.l3.phase,finaleAt:state.l3.finaleAt}:null,
    l4:state.l4?{phase:state.l4.phase,turnAt:state.l4.turnAt,tankId:state.l4.tankId,tankPhase:state.l4.tankPhase}:null,
    l5:state.l5?{phase:state.l5.phase,found:state.l5.found,metroAt:state.l5.metroAt}:null,
    l6:state.l6?{phase:state.l6.phase,leaderX:state.l6.leaderX,leaderZ:state.l6.leaderZ,platform:state.l6.platform,exitAt:state.l6.exitAt}:null,
    l7:g.world.l7Departure?{phase:g.world.l7Departure.state.phase,boarded:g.world.l7Departure.state.boarded.length}:null,
    l8:g.world.missions?.l8?{breachedAt:g.world.missions.l8.state.breachedAt,escapeCheckpoint:g.world.missions.l8.state.escapeCheckpoint,boarded:g.world.vehicles!.active!==null}:null,
    l9:g.world.missions?.l9?{phase:g.world.missions.l9.state.phase,car:a.getEntity(g.world.missions.l9.state.carId)?.transform}:null,
    l10:stop.level==='L10'?{carried:state.states['cure-carried'],installed:state.states['cure-installed'],active:state.states['charge-active'],chargeTicks:state.counters['charge-ticks']}:null,
    campaign:{unlocked:a.campaign.state()?.unlockedLevel,completed:a.campaign.state()?.completedLevels,character:a.campaign.state()?.character},player:a.getState().player?.transform};
}

/** The authored game rig (25 degree FOV, isometric polar/azimuth) looks around without relocating the player. */
export async function readyFrame({target,zoom,ticks,injection,stopId,scriptedNpc}:{target:[number,number,number]|null;zoom:number;ticks:number;injection?:string;stopId:string;scriptedNpc?:number}) {
  const a=window.__SS__!,g=(window.__SCENE__ as unknown as {game:Game}).game;
  if(ticks) await a.step(ticks);
  // Opt-in fault fixtures run only on the local candidate. Fresh level loads isolate each stop.
  const mutations:unknown[]=[];
  const enabled=(name:string)=>injection===name||injection==='all';
  if(enabled('hide-npc')&&stopId==='l1-depot-contact'){
    const id=scriptedNpc,e=g.world.entities.get(id!);
    if(!e?.civilian||!ticks&&!e.civilian.story)throw new Error('Mutation requires the actual scripted depot clerk');
    e.hidden=true;mutations.push({kind:'hide-npc',id,clip:e.civilian.story?.clip});
  }
  if(enabled('hats')&&stopId==='l1-park'){
    g.view.scene.traverse(node=>{
      if(!/^acc\.hat-.*:lod[01]$/.test(node.name))return;
      const geometry=(node as unknown as {geometry:BufferGeometry}).geometry;
      if(!geometry.userData.qaAbDouble){geometry.scale(2,2,2);geometry.userData.qaAbDouble=true;geometry.computeBoundingSphere();}
      mutations.push({kind:'hats',mesh:node.name,scale:2});
    });
    if(!mutations.length)throw new Error('Mutation found no loaded hat geometry');
  }
  if(enabled('tank')&&stopId==='l4-tank-hold'){
    const id=a.missions.state()!.l4!.tankId!,tank=g.world.entities.get(id);
    if(!tank)throw new Error('Mutation requires the actual L4 tank');
    Object.assign(tank.transform,{x:-13,z:23});
    mutations.push({kind:'tank',id,at:{...tank.transform}});
  }
  if(enabled('bench')&&stopId==='l2-ride-start'){
    type Entry={id:string;refs:Object3D[];origin:[number,number];hero:InstancedGroup;near:InstancedGroup;far:InstancedGroup};
    const district=(g.view as unknown as {districts:{lodBatches:Entry[]}}).districts;
    const at=g.world.missions!.def.anchors['l2-bench-2'];
    const benches=district.lodBatches.filter(e=>e.id.includes('bench')).flatMap(entry=>entry.refs.map(ref=>({entry,ref,d:Math.hypot(ref.position.x+entry.origin[0]-at.x,ref.position.z+entry.origin[1]-at.z)}))).sort((a,b)=>a.d-b.d);
    const selected=benches[0];if(!selected||selected.d>4)throw new Error('Mutation found no bench at the authored ride-start stop');
    selected.ref.scale.setScalar(0);selected.ref.updateMatrix();selected.ref.updateMatrixWorld(true);
    for(const batch of [selected.entry.hero,selected.entry.near,selected.entry.far])batch.update();
    mutations.push({kind:'bench',asset:selected.entry.id,at:selected.ref.position.toArray(),removed:true});
  }
  const rig=g.view.view;
  if(target) {
    const radius=19*zoom,s=Math.sin(rig.polar)*radius;
    rig.inspectionPose={target,position:[target[0]+s*Math.sin(rig.azimuth),target[1]+Math.cos(rig.polar)*radius,target[2]+s*Math.cos(rig.azimuth)]};
    rig.inspectionGameLod=false;
  }
  // Present the tour camera before waiting: its first draw can request a different entity LOD.
  // A single pre-camera ready() can finish while that replacement is still pending.
  let previousAssets:string|undefined,settled=false;
  for(let pass=0;pass<6;pass++){
    g.view.update(1);await a.screenshotReady();
    const assets=JSON.stringify(a.getState().render.entityAssets);
    if(assets===previousAssets){settled=true;break;}
    previousAssets=assets;
  }
  if(!settled)throw new Error('Visible entity LOD/pose did not settle after readiness');
  const presentationReset:number[]=[];
  if(stopId.startsWith('l10-')&&!ticks){
    if(new URL(location.href).searchParams.get('test')!=='1')throw new Error('Presentation normalization requires test mode');
    // A long batched walk samples the corgi animator at render cadence. Recreate only its view from the
    // unchanged simulation actor so cross-fades and gait history do not depend on load/RAF timing.
    const npcs=g.view.labProbes().npcs as unknown as {heroes:Map<number,{root:Object3D}>;motion:{delete(id:number):void};presentation:{states:Map<number,unknown>}}|null;
    if(npcs)for(const e of g.world.entities.iterate())if(e.companion){
      npcs.heroes.get(e.id)?.root.removeFromParent();npcs.heroes.delete(e.id);npcs.motion.delete(e.id);npcs.presentation.states.delete(e.id);presentationReset.push(e.id);
    }
  }
  // Ready may warm assets through extra view updates. Draw this pose in a new node frame,
  // then finish the GPU submission before Playwright reads the canvas (including static set pieces).
  g.view.renderer.nextNodeFrame();g.view.update(1);await g.view.renderer.finishWarmUp();
  const focus=target??[a.getState().player!.transform.x,0,a.getState().player!.transform.z];
  const actors=a.query({}).filter(e=>(!!e.civilian||e.archetype==='veh.tank')&&Math.hypot(e.transform.x-focus[0],e.transform.z-focus[2])<15).map(e=>({id:e.id,archetype:e.archetype,at:e.transform,hidden:e.hidden,model:e.civilian?.model,clip:e.civilian?.story?.clip,activity:e.civilian?.schedule?.[e.civilian.scheduleStep??0]?.activity,state:e.civilian?.state,activityUntil:e.civilian?.activityUntil,pauseUntil:e.civilian?.pauseUntil}));
  const companions=a.query({}).filter(e=>e.companion).map(e=>({id:e.id,at:e.transform,motion:e.motion,state:e.companion!.state,clip:g.view.labProbes().npcs?.heroClip(e.id),pose:['body','head','legFL','legFR','legBL','legBR'].map(name=>{const node=g.view.labProbes().npcs?.heroRoot(e.id)?.getObjectByName(name);return{name,p:node?.position.toArray(),q:node?.quaternion.toArray()};})}));
  const render=a.getState().render;
  return {tick:a.tick(),mutations,companions,presentationReset,backend:a.perf().backend,quality:render.quality,camera:render.camera,entityAssets:render.entityAssets,actors,drawn:a.crowdFigures().filter(f=>f.drawn&&actors.some(e=>e.id===f.id)).map(f=>({id:f.id,lod:f.lod,clip:f.clip,accessory:f.appearance?.accessory}))};
}
