import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../../sim-runner/levels';
import { LevelNineBot } from '../../../src/debug/bot/LevelNineBot';
import { preset } from '../../../src/sim/progression/Campaign';
import { crossing } from '../../../src/levels/L9/district';
import { l9Groups } from '../../../src/data/l9';
import { stateHash } from '../../../src/sim/world/stateHash';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';
const identity=provenance(), rows=[];
for(const tier of ['low','high'] as const) for(const mode of ['canonical','zero','shortcut'] as const){
 const campaign=preset('L9-default'); campaign.settings.quality=tier;
 const world=await loadLevel('L9',1,campaign,0,{quality:tier});
 try{
  const mission=world.missions!, car=world.vehicles!.cars.get(mission.l9!.state.carId)!;
  const bot=new LevelNineBot(world,mode==='shortcut'?'dry-shortcut':'road',mode!=='shortcut');
  const initial={tick:world.tick,carId:car.entity.id,hp:car.entity.health.current,position:{...car.entity.transform},driver:car.entity.vehicle!.driver,passengers:structuredClone(car.entity.vehicle!.passengers)};
  if(mode==='zero')world.vehicles!.damage(car.entity.id,car.entity.health.max);
  const hits:unknown[]=[],signals:{tick:number;name:string}[]=[],objectives:{tick:number;id:string}[]=[],states:unknown[]=[];
  world.events.on('vehicle.durability-hit',event=>hits.push({...event}));
  world.events.on('mission.signal',event=>{if(event.type==='mission.signal')signals.push({tick:event.tick,name:event.name});});
  world.events.on('objective.started',event=>{if(event.type==='objective.started')objectives.push({tick:event.tick,id:event.id});});
  let firstDrive:number|null=null,firstMotion:number|null=null,peakChunks=0,signature='',distance=0,zeroTicks=0,zeroMovingTicks=0,minZeroCap=Infinity,maxZeroCap=0,smokingTicks=0;
  let previous={...car.entity.transform};
  for(let i=0;i<1200*60&&!bot.finished;i++){
   const frame=bot.sample();if(frame.drive?.throttle)firstDrive??=world.tick;
   world.applyInput(frame,'keyboard');world.update();
   const p=car.entity.transform, moved=Math.hypot(p.x-previous.x,p.z-previous.z);
   if(mission.l9!.state.phase==='driving'){
    distance+=moved;if(moved>.001)firstMotion??=world.tick;
    if(car.entity.health.current===0){zeroTicks++;if(moved>.01)zeroMovingTicks++;minZeroCap=Math.min(minZeroCap,car.physics.speedCap);maxZeroCap=Math.max(maxZeroCap,car.physics.speedCap);if(car.entity.vehicle!.damage==='smoking')smokingTicks++;}
   }
   previous={...p};peakChunks=Math.max(peakChunks,world.chunks?.stats().resident??0);
   const next=mission.l9!.state.phase;
   if(next!==signature){states.push({tick:world.tick,phase:next,hp:car.entity.health.current,position:{...p},driver:car.entity.vehicle!.driver,wheels:car.physics.wheels.length,entityPresent:!!world.entities.get(car.entity.id)});signature=next;}
  }
  const finalHash=stateHash(world.getState()),control=JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L9-${tier}-complete.json`,'utf8')) as NativeReceipt;
  if(mode==='canonical'){assert.equal(control.sourceHash,identity.sourceHash);assert.equal(finalHash,control.nativeStateHash);}
  rows.push({tier,mode,setup:mode==='zero'?'One production vehicle.damage(maxHP) call immediately after ordinary Begin; normal bot thereafter.':mode==='shortcut'?'Ordinary physical-input native dry-shortcut route, no actor writes.':'Exact canonical road detour, read-only observer; final state equals independent control.',initial,finished:bot.finished,finalHash,controlIdentical:mode==='canonical'?finalHash===control.nativeStateHash:null,firstDrive,firstMotion,drivenMetres:distance,zero:{ticks:zeroTicks,movingTicks:zeroMovingTicks,minCap:Number.isFinite(minZeroCap)?minZeroCap:null,maxCap:maxZeroCap,smokingTicks},peakChunks,preCrashDurability:mission.l9!.state.preCrashDurability,hits,signals,objectives,states,encounters:structuredClone(mission.l9!.state.encounters)});
  console.log(tier,mode,bot.finished,distance,zeroMovingTicks);
 }finally{world.dispose();}
}
const segmentDistance=(p:readonly number[],a:readonly number[],b:readonly number[])=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);};
const groups=l9Groups.map(group=>{const route=crossing.routes.find(route=>route.id===group.route)!;return {...group,detourClearance:Math.min(...route.detour.slice(1).map((b,i)=>segmentDistance(group.at,route.detour[i],b)))};});
atomicJson('docs/reports/fix55-c/L9-native.json',{...identity,toolSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),method:'Native simulation, seed1 both tiers. Canonical exact state control; explicitly separate zero-durability and risky-shortcut capability runs. No rendered pose/smoke/HUD/seam or frame-time claim.',groups,rows});
export type L9NativeProof={sourceHash:string;observerHash:string;toolSha256:string;rows:typeof rows;groups:typeof groups};
