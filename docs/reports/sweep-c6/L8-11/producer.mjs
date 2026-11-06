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
const tier=process.argv[2];assert(['low','high'].includes(tier));const root='docs/reports/sweep-c6/L8-11',sha=b=>createHash('sha256').update(b).digest('hex'),seedFile=`docs/reports/sweep-c4/L8-07-actual-${tier}-campaign.json.gz`,seedBytes=readFileSync(seedFile),campaign=JSON.parse(gunzipSync(seedBytes)),identity=provenance();
mkdirSync(root,{recursive:true});const out=resolve(`test-results/sweep-c6/L8-11/${tier}-${Date.now()}`);mkdirSync(out,{recursive:true});
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));assert.notEqual(port,3300);
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{stdio:'ignore'}),browser=await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const errors=[],captures=[],commands=[],samples=[],reached=[];let setup,ledger;const goals=[[24,64],[-45,64],[-60,54],[-60,35]];
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break;}catch{}await delay(100);}
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),timer=setTimeout(()=>void context.close(),8*60_000),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
 await page.addInitScript('window.__name=f=>f');await page.goto(`http://127.0.0.1:${port}/?test=1&ui=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);await page.waitForFunction(()=>!!window.__SS__&&!!window.__SCENE__);
 setup=await page.evaluate(async({campaign,tier})=>{const a=window.__SS__,g=window.__SCENE__.game;await a.ready;a.pause();a.campaign.restore(campaign);await a.loadLevel('L8',{seed:1});a.pause();a.settings.set({quality:tier,cameraShake:false,cheapDof:false,aimAssist:'Off'});a.missions.begin();a.cheats.god(true);g.driver=null;g.ui.show(null);g.input.release();g.world.clearInput();a.camera.zoom(1.5);window.__walk={path:[],goal:-1,pathIndex:0};window.__proof={inputs:[],events:[]};g.input.tap=f=>window.__proof.inputs.push({tick:g.world.tick,move:f.move,nativeDriver:!!g.driver});for(const type of ['combat.attack','combat.kill','infection.started','infection.turned','mission.signal'])g.world.events.on(type,e=>window.__proof.events.push(structuredClone(e)));return{backend:a.perf().backend,quality:a.getState().render.quality,driverDetached:!g.driver,roster:structuredClone(g.world.missions.l8.state.roster)};},{campaign,tier});
 const snap=()=>page.evaluate(()=>{const g=window.__SCENE__.game,w=g.world,p=w.entities.get(1);return{tick:w.tick,player:{...p.transform},phase:w.missions.state.phase,breachedAt:w.missions.l8.state.breachedAt,camera:g.view.getState().camera,figures:g.view.crowdFigures().filter(f=>f.drawn).map(f=>({id:f.id,clip:f.clip,phase:f.phase,drawn:f.drawn})),actors:[...w.entities.iterate()].filter(e=>!e.hidden&&e.health?.current>0&&(e.infected||e.civilian||e.companion)).map(e=>({id:e.id,archetype:e.archetype,hp:e.health.current,species:e.civilian?.zooAnimal,infected:!!e.infected,infection:!!e.infection,position:{...e.transform},distance:Math.hypot(p.transform.x-e.transform.x,p.transform.z-e.transform.z)}))};});
 const photo=async label=>{for(const z of [.5,1.5]){await page.evaluate(async z=>{window.__SS__.camera.zoom(z);await window.__SS__.screenshotReady();},z);const file=resolve(out,`${label}-z${z}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:90});captures.push({file,sha256:sha(readFileSync(file)),label,zoom:z,state:await snap()});}await page.evaluate(()=>window.__SS__.camera.zoom(1.5));};
 await page.locator('canvas').first().focus();await photo('sanctuary-arrival');let held=[],index=0,lastShot=0,burst=false;
 for(let i=0;i<1800;i++){
 const s=await snap();samples.push(s);if(i%300===0)console.log(tier,{i,tick:s.tick,p:s.player,index,infectedAnimals:s.actors.filter(e=>e.infected&&!['infected.runner','infected.alpha','infected.dog'].includes(e.archetype)).map(e=>({id:e.id,type:e.archetype,distance:e.distance}))});
 if(index<goals.length&&Math.hypot(s.player.x-goals[index][0],s.player.z-goals[index][1])<1){reached.push({index,goal:goals[index],tick:s.tick,player:s.player});await photo(`sanctuary-${index}`);index++;}
 if(s.tick>=3540&&lastShot<3540){await photo('sanctuary-before-breach');lastShot=s.tick;}
 if(s.tick>=3600&&lastShot<3600){await photo('breach');lastShot=s.tick;}
 if(s.tick>=4200&&s.tick-lastShot>=1200){await photo(`battle-${s.tick}`);lastShot=s.tick;}
 const animals=s.actors.filter(e=>e.infected&&e.distance<20&&!['infected.runner','infected.alpha','infected.dog'].includes(e.archetype));const humans=s.actors.filter(e=>e.infected&&e.distance<20&&['infected.runner','infected.alpha'].includes(e.archetype));
 if(animals.length&&humans.length&&s.tick>4200){await photo('mixed-0');await page.keyboard.down('KeyD');commands.push({tick:s.tick,keys:['KeyD'],reason:'Physical sidestep during mixed battle motion strip'});for(const n of [6,12]){await page.evaluate(()=>window.__SS__.step(6));await photo(`mixed-${n}`);}await page.keyboard.up('KeyD');burst=true;break;}
 if(s.tick>=12000)break;
 let next=[];if(index<goals.length){const [x,z]=goals[index],q=await page.evaluate(goal=>{const w=window.__SCENE__.game.world,p=w.entities.get(1),q={...goal};w.infected.nav.steer(p.transform,goal,window.__walk,.45,q,Infinity,true);return q;},{x,z}),dx=q.x-s.player.x,dz=q.z-s.player.z;next=markerWalkKeys((dx-dz)*100,(dx+dz)*100,(i%10)/10);}
 for(const k of held.filter(k=>!next.includes(k)))await page.keyboard.up(k);for(const k of next.filter(k=>!held.includes(k)))await page.keyboard.down(k);held=next;commands.push({tick:s.tick,keys:[...held],waypoint:index});await page.evaluate(()=>window.__SS__.step(12));
 }
 for(const k of held)await page.keyboard.up(k);await photo(burst?'mixed-end':'final-natural-battle');ledger=await page.evaluate(()=>window.__proof);console.log({tier,burst,reached:reached.length,captures:captures.length,errors});
 }finally{clearTimeout(timer);await context.close();}
}catch(e){errors.push(String(e));}
finally{await browser.close();server.kill('SIGTERM');writeFileSync(`${root}/${tier}-physical.json.gz`,gzipSync(JSON.stringify({...identity,browserHash:browserHash(),toolSha256:sha(readFileSync(new URL(import.meta.url))),seed:{file:seedFile,sha256:sha(seedBytes)},tier,goals,setup,ledger,commands,samples,reached,captures,errors,method:'Actual physically progressed L7 campaign, normal L8 constructor/Begin, actual WASD tour through sanctuary to elephant enclosure, then natural outbreak with unchanged actors/AI/counts/timers. Read-only nav steering translated to device keys. Courier god only. No enemy spawn, target/HP/actor write, mission skip or perf timing. Both actual PO zooms; mixed-species condition tied to live actor IDs and distance with physical sidestep motion strip if witnessed. Raw frames require personal review and Opus taste decision.'})));}process.exitCode=errors.length?1:0;
