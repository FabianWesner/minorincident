import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {launchBrowser} from '../../browser-pool/client.ts';
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
import {markerWalkKeys} from '../../playtest/input.ts';
const tier=process.argv[2];assert(['low','high'].includes(tier),'Supply tier');const identity=provenance(),hash=browserHash(),sha=b=>createHash('sha256').update(b).digest('hex'),seedFile=`docs/reports/final-c/campaign/L7-${tier}-carried-save.json.gz`,seedBytes=readFileSync(seedFile),campaign=JSON.parse(gunzipSync(seedBytes));
mkdirSync('docs/reports/final-c/L7-11',{recursive:true});
writeFileSync(`docs/reports/final-c/L7-11/${tier}-producer.mjs`,readFileSync(new URL(import.meta.url)));
const out=resolve(`test-results/final-c-l7-departure-${tier}-${Date.now()}`);mkdirSync(out,{recursive:true});const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));assert.notEqual(port,3300);
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{stdio:'ignore'}),browser=await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const errors=[],captures=[],samples=[],commands=[];let setup,result;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break;}catch{}await delay(100);}
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),timer=setTimeout(()=>{void context.close();},8*60_000),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  await page.addInitScript('window.__name=f=>f');await page.goto(`http://127.0.0.1:${port}/?test=1&ui=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);await page.waitForFunction(()=>!!window.__SS__&&!!window.__SCENE__);
  setup=await page.evaluate(async({campaign,tier})=>{
   const a=window.__SS__,g=window.__SCENE__.game;await a.ready;a.pause();a.campaign.restore(campaign);await a.loadLevel('L7',{seed:1});a.pause();a.settings.set({quality:tier,cameraShake:false,cheapDof:false,aimAssist:'Off'});a.missions.begin();a.cheats.god(true);g.ui.show(null);g.input.release();g.world.clearInput();a.camera.zoom(1.5);
   // Construct the ordinary completion policy while paused, detach it before any simulation tick.
   a.bot.start('complete');window.__l7Policy=g.driver;a.bot.stop();
   const w=g.world,ids=w.infected.active.filter(e=>e.infected.pack===700).map(e=>e.id),read=e=>({id:e.id,archetype:e.archetype,hp:e.health.current,hidden:!!e.hidden,pending:!!e.pendingAdmission,position:{...e.transform}}),initial=ids.map(id=>read(w.entities.get(id)));
   const receipt=window.__l7Corridor={ids,initial,events:[],ticks:[],inputs:[],crossed:[],previous:new Map(),sourceWorld:w};
   for(const type of ['explosion','combat.attack','combat.kill','mission.signal'])w.events.on(type,event=>{if(type==='explosion')receipt.events.push({...event,finalDeadBefore:ids.filter(id=>w.entities.get(id)&&w.entities.get(id).health.current<=0)});else if(type==='mission.signal'||type==='combat.attack'&&event.sourceId===1||type==='combat.kill'&&ids.includes(event.targetId))receipt.events.push({...event});if(type==='mission.signal'&&event.name==='l7.departed')receipt.finish={tick:w.tick,departure:structuredClone(w.l7Departure.state),bus:read(w.entities.get(w.l7Departure.state.busId)),player:{...w.entities.get(1).transform}};});
   g.input.tap=f=>receipt.inputs.push({tick:w.tick,move:{...f.move},mouseAttack:!!f.mouseAttack,interact:f.interact,aimPoint:f.aimPoint,selected:f.selectedWeaponKey,nativeDriver:!!g.driver});
   w.events.on('sim.tick',()=>{const p=w.entities.get(1),humans=w.l7Encounters.state.roster.flatMap(r=>{const e=w.entities.get(r.id);return e?[{id:e.id,hp:e.health.current,hidden:!!e.hidden,infected:!!e.infected,position:{...e.transform},status:r.status}]:[];});
    for(const e of humans){const prev=receipt.previous.get(e.id);if(prev&&prev.x>=-68&&e.position.x<-68&&!e.hidden&&!e.infected&&e.hp>0)receipt.crossed.push({tick:w.tick,...e});receipt.previous.set(e.id,e.position);}
    if(w.l7Departure.state.phase==='departing'){const d=w.l7Departure.state;receipt.ticks.push({tick:w.tick,player:{...p.transform},humans,final:ids.map(id=>w.entities.get(id)).filter(Boolean).map(read),departure:structuredClone(d),bus:read(w.entities.get(d.busId)),camera:g.view.getState().camera});}
   });
   return{initial,roster:structuredClone(w.l7Encounters.state.roster),incomingIds:campaign.results.L6.escapedSurvivors.map(e=>e.id),backend:a.perf().backend,quality:a.getState().render.quality,driverDetached:g.driver===null};
  },{campaign,tier});
  const snap=()=>page.evaluate(()=>{const g=window.__SCENE__.game,r=window.__l7Corridor;if(r.finish)return{tick:r.finish.tick,player:r.finish.player,phase:'result',departure:r.finish.departure,blasts:r.events.filter(e=>e.type==='explosion'&&r.events.some(k=>k.type==='combat.kill'&&k.tick===e.tick&&k.sourceId===1&&k.actionId==='weapon.rocket-launcher'&&r.ids.includes(k.targetId))).length,crossed:r.crossed.length,finalAlive:0,weapon:'weapon.rocket-launcher'};const w=g.world,p=w.entities.get(1);return{tick:w.tick,player:{...p.transform},phase:w.missions.state.phase,departure:structuredClone(w.l7Departure.state),blasts:r.events.filter(e=>e.type==='explosion'&&r.events.some(k=>k.type==='combat.kill'&&k.tick===e.tick&&k.sourceId===1&&k.actionId==='weapon.rocket-launcher'&&r.ids.includes(k.targetId))).length,crossed:r.crossed.length,finalAlive:r.ids.filter(id=>w.entities.get(id)?.health.current>0).length,weapon:w.combat.runner.loadout.state[w.combat.runner.loadout.state.selectedSide].rack[w.combat.runner.loadout.state[w.combat.runner.loadout.state.selectedSide].index]?.id??null};});
  const photo=async label=>{for(const zoom of label.startsWith('departure-')?[1.5]:[.5,1.5]){await page.evaluate(async z=>{window.__SS__.camera.zoom(z);await window.__SS__.screenshotReady();},zoom);const file=resolve(out,`${tier}-${label}-z${zoom}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:90});captures.push({file,sha256:sha(readFileSync(file)),label,zoom,state:await snap()});}await page.evaluate(()=>window.__SS__.camera.zoom(1.5));};
  await page.locator('canvas').first().focus();let held=[],firing=false,selected=false,mouth=false,blast=false,crossing=false,lastCine=-1,recoveryUntil=-1,recoveryIndex=0,lastRecovery=-Infinity,assist=-1;const assistRoute=[{x:-35,z:41.7},{x:-70.5,z:41.7},{x:-70.5,z:47.5}];
  for(let i=0;i<7000;i++){
   const state=await snap();samples.push(state);if(i%400===0)console.log(tier,{iteration:i,tick:state.tick,x:state.player.x,departure:state.departure.phase,finalAlive:state.finalAlive});
   if(!mouth&&state.player.x<0){await photo('corridor-mouth');mouth=true;}
   if(!blast&&state.blasts>0){await photo('rocket-gap');blast=true;}
   if(!crossing&&state.crossed>0){await photo('survivor-crossing');crossing=true;}
   
   
   
   if(state.departure.phase==='departing'){const seconds=Math.floor((state.tick-state.departure.startedAt)/30);if(seconds!==lastCine){await photo(`departure-${seconds/2}`);lastCine=seconds;}}
   if(['done'].includes(state.departure.phase)||['result','progression'].includes(state.phase))break;
   const plan=await page.evaluate(()=>{const g=window.__SCENE__.game,w=g.world,f=window.__l7Policy.sample(),rocket=w.entities.get(1).weapons.RIGHT.rack.some(s=>s.id==='weapon.rocket-launcher');return{tick:w.tick,frame:f,rocket,cursor:f.aimPoint?window.__SS__.input.project(f.aimPoint,'destination'):null};});
   if(plan.rocket&&!selected){await page.keyboard.press('Digit7');selected=true;}
   const f=plan.frame;if(tier==='high'&&state.player.x<-30&&assist<0){assist=0;console.log('map assist: southern corridor road edge then bus entrance');}
   if(assist>=0){while(assist<assistRoute.length&&Math.hypot(state.player.x-assistRoute[assist].x,state.player.z-assistRoute[assist].z)<.8)assist++;const goal=assistRoute[assist];if(goal){const dx=goal.x-state.player.x,dz=goal.z-state.player.z,d=Math.hypot(dx,dz);f.move={x:dx/d,z:dz/d};}else f.move={x:0,z:0};}
   const x=f.move.x-f.move.z,y=f.move.x+f.move.z;let next=markerWalkKeys(x*100,y*100,(i%10)/10);if(f.interact)next.push('KeyE');if(state.tick-lastRecovery>300&&samples.length>80&&Math.hypot(state.player.x-samples.at(-80).player.x,state.player.z-samples.at(-80).player.z)<.2&&Math.hypot(f.move.x,f.move.z)>.05){lastRecovery=state.tick;recoveryUntil=state.tick+90;recoveryIndex++;}if(state.tick<recoveryUntil)next=[['KeyW','KeyD','KeyS','KeyA'][(recoveryIndex-1)%4]];
   const shoot=!!f.right.held&&!!plan.cursor&&plan.cursor.x>0&&plan.cursor.x<1280&&plan.cursor.y>0&&plan.cursor.y<720;if(shoot){next.push('ShiftLeft');await page.mouse.move(plan.cursor.x,plan.cursor.y);}
   for(const k of held.filter(k=>!next.includes(k)))await page.keyboard.up(k);for(const k of next.filter(k=>!held.includes(k)))await page.keyboard.down(k);held=next;
   if(shoot&&!firing)await page.mouse.down();if(!shoot&&firing)await page.mouse.up();firing=shoot;commands.push({tick:plan.tick,keys:[...held],mouseDown:firing,cursor:plan.cursor,plannedMove:f.move,mapAssist:assist>=0?{index:assist,goal:assistRoute[assist]??null}:null,recovery:state.tick<recoveryUntil});await page.evaluate(()=>window.__SS__.step(3));
  }
  if(firing)await page.mouse.up();for(const k of held)await page.keyboard.up(k);
  result=await page.evaluate(()=>{const r=window.__l7Corridor;return{initial:r.initial,events:r.events,ticks:r.ticks,inputs:r.inputs,crossed:r.crossed,finish:r.finish,final:r.finish?.departure??structuredClone(r.sourceWorld.l7Departure?.state??null)};});if(!result.finish)errors.push('Physical route did not reach departure');console.log(tier,{last:samples.at(-1),captures:captures.length,crossed:result.crossed.length,errors});
 }catch(e){errors.push(String(e));try{result=await page.evaluate(()=>{const r=window.__l7Corridor;return r?{initial:r.initial,events:r.events,ticks:r.ticks,inputs:r.inputs,crossed:r.crossed,finish:r.finish,final:r.finish?.departure??structuredClone(r.sourceWorld.l7Departure?.state??null)}:null;});}catch{}throw e;}finally{clearTimeout(timer);await context.close();}
}catch(e){errors.push(String(e));console.error(String(e));}
finally{await browser.close();server.kill('SIGTERM');writeFileSync(`docs/reports/final-c/L7-11/${tier}-physical.json.gz`,gzipSync(JSON.stringify({...identity,browserHash:hash,toolSha256:sha(readFileSync(new URL(import.meta.url))),seed:{file:seedFile,sha256:sha(seedBytes)},out,setup,result,samples,commands,captures,errors,method:'Actual progressed L5/L6 campaign seed. Ordinary L7 completion planner constructed while paused then detached: only its map/threat recommendations are read, translated to actual physical WASD/E/Digit7/ShiftLMB with the existing markerWalkKeys shorter-axis duty cycle. The earlier sign-only adapter generated the wrong world bearing near diagonal goals; archived as a failed harness run. Native bot driver never runs a tick. Normal AI/populations/health/caps; courier protected only. Initial finalgroup census, actual physical rockets and carried survivor crossing; every departure tick records bus identity/HP/position and camera, half-second cinematic photos at native camera zoom. Requested zoom is overridden by the native cinematic, so paired zoom coverage is not claimed. Ordinary physical cardinal sidestep recovery after fourseconds commanded movement withoutprogress, logged explicitly. High tier uses an explicitly logged authored-map assist along the south corridor edge then the bus entrance after the original intermediate waypoint stalls. Every move remains physical WASD with normal collision and live threats/followers. No actor relocations/objective skips/native input injection/performance timing.'})));}
process.exitCode=errors.length?1:0;
