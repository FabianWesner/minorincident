/** Mortal physical keyboard cluster escapes; navigation assistance is explicit. */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {SceneSession,stopServer} from '../scenelab/session';
import {provenance} from './accept/probe';
import {l2Routes} from '../../src/debug/bot/LevelTwoBot';
import type {Game} from '../../src/Game';
type Trace={kills:{tick:number;source:number;target:number}[];alarms:unknown[];path:{path:number[];goal:number;pathIndex:number}};
const out=process.env.CLUSTER_OUT??'test-results/sweep-a2/cluster';mkdirSync(`${out}/captures`,{recursive:true});const runs:unknown[]=[];
const persist=()=>writeFileSync(`${out}/receipt.json`,JSON.stringify({...provenance(),method:'Ordinary complete InputFrame prefix to before Elm encounter; subsequent physical page.keyboard WASD/E and mouse melee only, mortal courier, no injected movement/attacks/protection/relocation/skips. Read-only coordinates and static nav steering choose physical key directions; not screenshot-only navigation. Unique cluster kill IDs include prefix. Inspection zooms restored before simulation.',runs},null,2));
try{for(const tier of (process.env.CLUSTER_TIER?[process.env.CLUSTER_TIER as 'low'|'high']:['low','high'] as const))for(const opening of (process.env.CLUSTER_OPENING?[process.env.CLUSTER_OPENING as 'side'|'alarm']:['side','alarm']as const)){
 const s=new SceneSession({tier,backend:'webgpu',query:{ui:'1'}}),frames:unknown[]=[],commands:unknown[]=[];let failure:string|undefined;
 try{
  await s.open();await s.page.evaluate('window.__name=f=>f');
  await s.page.evaluate(async({tier,opening})=>{const a=window.__SS__!;a.settings.set({quality:tier});await a.loadLevel('L2',{seed:1,progression:'L2-default'});a.missions.begin();a.pause();a.camera.follow();a.camera.zoom(1);
   document.documentElement.setAttribute('data-scene-hud','');document.querySelectorAll('#hud,.hud').forEach(n=>n.setAttribute('data-scene-hud',''));
   const w=(window.__SCENE__ as unknown as{game:Game}).game.world,trace:Trace={kills:[],alarms:[],path:{path:[],goal:-1,pathIndex:0}};(window as unknown as{qaCluster:Trace}).qaCluster=trace;
   w.events.on('combat.kill',e=>{if(e.type==='combat.kill')trace.kills.push({tick:e.tick,source:e.sourceId,target:e.targetId});});w.events.on('outbreak.distraction',e=>trace.alarms.push(e));
   a.bot.start('complete',{opening});
   let reached=false;
   for(let i=0;i<1200;i++){const p=w.entities.get(1)!.transform;if(w.missions!.state.l2!.doorsOpenAt&&(opening==='side'?p.x>=-32&&p.z>=28:p.x>=49&&p.z>=7)){reached=true;break;}await a.step(10);}
   a.bot.stop();a.input.clear();if(!reached)throw Error('Ordinary encounter prefix not reached');
  },{tier,opening});
  const read=()=>s.page.evaluate(()=>{const g=(window.__SCENE__ as unknown as{game:Game}).game,w=g.world,l=w.missions!.state.l2!,p=w.entities.get(1)!;const t=(window as unknown as{qaCluster:Trace}).qaCluster;const enemy=w.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission).sort((a,b)=>Math.hypot(a.transform.x-p.transform.x,a.transform.z-p.transform.z)-Math.hypot(b.transform.x-p.transform.x,b.transform.z-p.transform.z))[0];const projected=enemy&&g.view.project(enemy.transform.x,enemy.transform.y+.6,enemy.transform.z);return{threat:enemy&&{id:enemy.id,distance:Math.hypot(enemy.transform.x-p.transform.x,enemy.transform.z-p.transform.z),screen:projected&&[(projected[0]+1)*640,(1-projected[1])*360]},tick:w.tick,at:{...p.transform},hp:p.health.current,missionPhase:w.missions!.state.phase,crossedAt:l.crossedAt,clusterReached:l.clusterReached,ids:[...l.clusterIds],actors:l.clusterIds.map(id=>{const e=w.entities.get(id);return{id,hp:e?.health.current,hidden:!!e?.hidden,at:e?.transform,mode:e?.infected?.l1?.mode,target:e?.infected?.l1?.targetId};}),playerClusterKillIds:[...new Set(t.kills.filter(k=>k.source===1&&l.clusterIds.includes(k.target)).map(k=>k.target))],alarms:t.alarms};});
  const photograph=async(label:string)=>{for(const zoom of [.5,1.5]){await s.page.evaluate(async z=>{window.__SS__!.camera.zoom(z);await window.__SS__!.screenshotReady();},zoom);const file=`${out}/captures/${tier}-${opening}-${label}-z${zoom}.png`;await s.page.screenshot({path:file});frames.push({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),label,zoom,state:await read()});}await s.page.evaluate(()=>window.__SS__!.camera.zoom(1));};
  const start=await read();await photograph('before');const route=opening==='side'?l2Routes.side.slice(6):[{x:48.6,z:12.4},...l2Routes.alarm.slice(7)];let waypoint=0,alarmed=false;
  for(let c=0;c<1400;c++){
   const q=await read();if(q.crossedAt)break;if(q.hp<=0||q.missionPhase==='retry')throw Error('Mortal route died; trial incomplete');
   const target=route[Math.min(waypoint,route.length-1)],distance=Math.hypot(target.x-q.at.x,target.z-q.at.z);
   if(distance<(opening==='alarm'&&waypoint===0?2.2:.7)){if(opening==='alarm'&&waypoint===0&&!alarmed){await s.page.keyboard.down('KeyE');await s.page.evaluate(async()=>window.__SS__!.step(1));await s.page.keyboard.up('KeyE');alarmed=true;await photograph('alarm');}
    if(waypoint%3===0)await photograph(`waypoint-${waypoint}`);if(waypoint<route.length-1){waypoint++;continue;}}
   const desired=await s.page.evaluate(target=>{const g=(window.__SCENE__ as unknown as{game:Game}).game,w=g.world,p=w.entities.get(1)!.transform,t=(window as unknown as{qaCluster:Trace}).qaCluster,next={x:0,z:0};const clear=w.infected!.nav.steer(p,target,t.path,.45,next,Infinity,true);return{clear,dx:next.x-p.x,dz:next.z-p.z,azimuth:g.view.view.azimuth};},target);
   if(!desired.clear){await s.page.evaluate(()=>{(window as unknown as{qaCluster:Trace}).qaCluster.path={path:[],goal:-1,pathIndex:0};});}
   const d=Math.hypot(desired.dx,desired.dz)||1,right=Math.cos(desired.azimuth)*desired.dx-Math.sin(desired.azimuth)*desired.dz,down=Math.sin(desired.azimuth)*desired.dx+Math.cos(desired.azimuth)*desired.dz,keys=[];
   if(Math.abs(right)/d>.34)keys.push(right>0?'KeyD':'KeyA');if(Math.abs(down)/d>.34)keys.push(down>0?'KeyS':'KeyW');
   const attack=!!q.threat?.screen&&q.threat.distance<3&&!(q.playerClusterKillIds.length>=Number(process.env.CLUSTER_KILL_STOP??99)&&q.ids.includes(q.threat.id));
   if(attack){await s.page.mouse.move(q.threat!.screen![0],q.threat!.screen![1]);await s.page.mouse.down();}
   for(const key of keys)await s.page.keyboard.down(key);try{await s.page.evaluate(async n=>window.__SS__!.step(n),Math.hypot(desired.dx,desired.dz)<1?1:3);}finally{for(const key of keys)await s.page.keyboard.up(key);if(attack)await s.page.mouse.up();}
   commands.push({waypoint,target,keys,attackTarget:attack?q.threat?.id:null,before:q,after:await read()});
  }
  const final=await read();await photograph('after');runs.push({tier,opening,start,final,commands,frames,errors:s.errors});console.log(tier,opening,final.crossedAt,final.hp,final.ids.length,final.playerClusterKillIds.length);
 }catch(error){failure=String(error);runs.push({tier,opening,commands,frames,failure});console.log(tier,opening,failure);}
 finally{persist();await s.close();}
}}finally{stopServer();persist();}
