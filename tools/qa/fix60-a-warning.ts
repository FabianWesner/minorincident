/** First natural L1 encounter, using the production simulation camera/frustum. */
import {loadLevel} from '../sim-runner/levels';
import {l1Frames} from '../../src/debug/bot/LevelOneBot';
import {View,playerSteers} from '../../src/render/View';
import {Matrix4} from 'three';
import {writeFileSync} from 'node:fs';import{gzipSync}from'node:zlib';import{provenance}from'./accept/probe';
const runs=[];
for(const tier of ['low','high']as const)for(let seed=1;seed<=10;seed++){
 const w=await loadLevel('L1',seed,undefined,0,{quality:tier});
 try{const view=new View(),matrix=new Matrix4();view.resize(1280,720);view.update(w.entities.get(1)!.transform,1);const warnings:unknown[]=[];let first:{id:number;tick:number;distance:number;visible:boolean;warningTick:number|null;appearedAt?:number}|null=null;const alreadySeen=new Set<number>();const eligible=new Map<number,{tick:number;distance:number}>();
 const warned=new Map<number,number>();w.events.on('corgi.warn',e=>{if(e.type==='corgi.warn'){warnings.push(e);if(e.stage!=='nervous'&&!warned.has(e.threatId))warned.set(e.threatId,e.tick);}});
 for(const frame of l1Frames(w,w.missions!,'complete',{seed,maxSeconds:300})){
  w.applyInput(frame,'keyboard');const camera=view.simCamera;matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);w.infected!.director.setFrustum(matrix.elements,camera.position);w.update();view.driving=playerSteers(w.vehicles);view.driverWide=view.driving;view.update(w.entities.get(1)!.transform,1/60);
  const p=w.entities.get(1)!.transform;
  const near=w.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission).map(e=>({e,d:Math.hypot(e.transform.x-p.x,e.transform.z-p.z)})).filter(q=>q.d<=20).sort((a,b)=>a.d-b.d);
  for(const q of near)if(!alreadySeen.has(q.e.id)&&!w.infected!.director.visible(q.e.transform)&&!eligible.has(q.e.id))eligible.set(q.e.id,{tick:w.tick,distance:q.d});
  for(const e of w.infected!.active)if(!e.hidden&&!e.pendingAdmission&&w.infected!.director.visible(e.transform)){
   if(!alreadySeen.has(e.id)&&eligible.has(e.id)&&!first){const q=eligible.get(e.id)!;first={id:e.id,tick:q.tick,distance:q.distance,visible:false,warningTick:warned.get(e.id)??null,appearedAt:w.tick};}alreadySeen.add(e.id);
  }
  if(first)break;
 }
 runs.push({tier,seed,first,warnings,pass:!!first&&first.warningTick!==null&&first.appearedAt!==undefined&&first.warningTick<first.appearedAt&&!first.visible});console.log(tier,seed,first,runs.at(-1)!.pass);
 }finally{w.dispose();}
}
writeFileSync(process.env.L1_WARNING_OUT ?? 'docs/reports/fix60-a/L1-10-native.json.gz',gzipSync(JSON.stringify({...provenance(),method:'First actual camera appearance of a natural admitted enemy previously observed OFFSCREEN within20m on ordinary complete InputFrames, production follow camera/frustum1280x720. No protection/spawn/relocation. Success requires same-ID actual warning before that actor first appears in camera. Visible-first actors are tracked and excluded from offscreen-first opportunities; offscreen candidates that never appear are not encounters; missing any qualifying encounter remains unqualified. Ten seeds per tier; no removal of visible-first failures.',runs})));
