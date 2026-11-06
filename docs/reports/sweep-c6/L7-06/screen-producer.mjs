import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {launchBrowser} from '../../browser-pool/client.ts';
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
import {markerWalkKeys} from '../../playtest/input.ts';
const [tier,route]=process.argv.slice(2);assert(['low','high'].includes(tier)&&['screen'].includes(route));
const root='docs/reports/sweep-c6/L7-06',sha=b=>createHash('sha256').update(b).digest('hex'),seedFile=`docs/reports/fix51-r10c/L7-${tier}-carried-save.json.gz`,seedBytes=readFileSync(seedFile),campaign=JSON.parse(gunzipSync(seedBytes)),identity=provenance();
mkdirSync(root,{recursive:true});const out=resolve(`test-results/sweep-c6/L7-06/${tier}-${route}-${Date.now()}`);mkdirSync(out,{recursive:true});
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));assert.notEqual(port,3300);
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{stdio:'ignore'}),browser=await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const errors=[],captures=[],commands=[],samples=[],reached=[];let setup,inputs;
const goals=route==='A'?[[88,-40],[78,-40],[-78,-40],[-78,-20],[-78,0],[-78,20],[-76,40],[-76,47]]:[[88,46],[60,46],[20,46],[-30,46],[-35,41.7],[-70.5,41.7],[-70.5,47.5]];
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break;}catch{}await delay(100);}
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),timer=setTimeout(()=>void context.close(),8*60_000),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.addInitScript('window.__name=f=>f');await page.goto(`http://127.0.0.1:${port}/?test=1&ui=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);await page.waitForFunction(()=>!!window.__SS__&&!!window.__SCENE__);
 setup=await page.evaluate(async({campaign,tier})=>{const a=window.__SS__,g=window.__SCENE__.game;await a.ready;a.pause();a.campaign.restore(campaign);await a.loadLevel('L7',{seed:1});a.pause();a.settings.set({quality:tier,cameraShake:false,cheapDof:false,aimAssist:'Off'});a.missions.begin();a.cheats.god(true);g.ui.show(null);g.input.release();g.world.clearInput();a.camera.zoom(.5);a.bot.start('complete');window.__policy=g.driver;a.bot.stop();window.__walk={path:[],goal:-1,pathIndex:0};window.__physical=[];g.input.tap=f=>window.__physical.push({tick:g.world.tick,move:f.move,nativeDriver:!!g.driver});return{backend:a.perf().backend,quality:a.getState().render.quality,driverDetached:!g.driver};},{campaign,tier});
 const snap=()=>page.evaluate(()=>{const g=window.__SCENE__.game,w=g.world,p=w.entities.get(1);return{tick:w.tick,player:{...p.transform},phase:w.missions.state.phase,camera:g.view.getState().camera};});
 const photo=async label=>{for(const z of [.5,1.5]){await page.evaluate(async z=>{window.__SS__.camera.zoom(z);await window.__SS__.screenshotReady();},z);const file=resolve(out,`${label}-z${z}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:90});captures.push({file,sha256:sha(readFileSync(file)),label,zoom:z,state:await snap()});}await page.evaluate(()=>window.__SS__.camera.zoom(.5));};
 await page.locator('canvas').first().focus();let held=[],firing=false,selected=false,index=-1,lastProgress=0,recovery=-1;
 for(let i=0;i<6000;i++){
 const s=await snap();samples.push(s);if(index<0&&i%400===0)console.log(tier,route,{i,tick:s.tick,p:s.player,index});
 if(index===-1&&s.player.x<90){await photo('branch-junction');index=0;lastProgress=s.tick;}
 if(false&&index>=0&&index<goals.length&&Math.hypot(s.player.x-goals[index][0],s.player.z-goals[index][1])<1.1){reached.push({index,goal:goals[index],...s});await photo(`waypoint-${index}`);index++;lastProgress=s.tick;}
 if(index>=0){
 for(const k of held)await page.keyboard.up(k);held=[];if(firing){await page.mouse.up();firing=false;}
 console.log('SCREEN_READY',captures.at(-1)?.file);const control=resolve('test-results/sweep-c6/L7-06/screen-action.json');
 while(!existsSync(control))await delay(150);
 const action=JSON.parse(readFileSync(control,'utf8'));unlinkSync(control);assert(action.reason,'Visible-screen reason required');if(action.done){reached.push({screenshotOnlyFinished:true,tick:s.tick});break;}
 assert(Array.isArray(action.keys)&&action.keys.every(k=>['KeyW','KeyA','KeyS','KeyD'].includes(k)));assert(action.steps>=1&&action.steps<=180);
 for(const k of action.keys)await page.keyboard.down(k);commands.push({tick:s.tick,screenshotOnly:true,...action});await page.evaluate(n=>window.__SS__.step(n),action.steps);for(const k of action.keys)await page.keyboard.up(k);await photo(`screen-${commands.filter(c=>c.screenshotOnly).length}`);continue;
 }
 if(index===goals.length){await photo('corridor-reached');break;}
 if(index>=0&&s.tick-lastProgress>5400){await photo(`stalled-${index}`);errors.push(`Waypoint not reached within90s at${index}`);break;}
 const plan=await page.evaluate(()=>{const g=window.__SCENE__.game,w=g.world,f=window.__policy.sample();return{f,rocket:w.entities.get(1).weapons.RIGHT.rack.some(s=>s.id==='weapon.rocket-launcher'),cursor:f.aimPoint?window.__SS__.input.project(f.aimPoint,'destination'):null};});
 if(plan.rocket&&!selected){await page.keyboard.press('Digit7');selected=true;}
 const f=plan.f;if(index>=0){const [x,z]=goals[index],next=await page.evaluate(goal=>{const w=window.__SCENE__.game.world,p=w.entities.get(1),next={...goal};w.infected.nav.steer(p.transform,goal,window.__walk,.45,next,Infinity,true);return next;},{x,z}),d=Math.hypot(next.x-s.player.x,next.z-s.player.z);f.move=d>.01?{x:(next.x-s.player.x)/d,z:(next.z-s.player.z)/d}:{x:0,z:0};f.interact=false;}
 let next=markerWalkKeys((f.move.x-f.move.z)*100,(f.move.x+f.move.z)*100,(i%10)/10);if(f.interact)next.push('KeyE');
 if(index>=0&&samples.length>60&&Math.hypot(s.player.x-samples.at(-60).player.x,s.player.z-samples.at(-60).player.z)<.15&&s.tick-recovery>240){recovery=s.tick;await photo(`blocked-${index}-${s.tick}`);}
 if(recovery>=0&&s.tick-recovery<60)next=[['KeyW','KeyD','KeyS','KeyA'][Math.floor((recovery-lastProgress)/240)%4]];
 const shoot=!!f.right.held&&!!plan.cursor&&plan.cursor.x>0&&plan.cursor.x<1280&&plan.cursor.y>0&&plan.cursor.y<720;if(shoot){next.push('ShiftLeft');await page.mouse.move(plan.cursor.x,plan.cursor.y);}for(const k of held.filter(k=>!next.includes(k)))await page.keyboard.up(k);for(const k of next.filter(k=>!held.includes(k)))await page.keyboard.down(k);held=next;if(shoot&&!firing)await page.mouse.down();if(!shoot&&firing)await page.mouse.up();firing=shoot;commands.push({tick:s.tick,keys:[...held],mouseDown:firing,cursor:plan.cursor,routeWaypoint:index});await page.evaluate(()=>window.__SS__.step(6));
 }
 if(firing)await page.mouse.up();for(const k of held)await page.keyboard.up(k);inputs=await page.evaluate(()=>window.__physical);
 }finally{clearTimeout(timer);await context.close();}
}catch(e){errors.push(String(e));}
finally{await browser.close();server.kill('SIGTERM');writeFileSync(`${root}/${tier}-${route}-physical.json.gz`,gzipSync(JSON.stringify({...identity,browserHash:browserHash(),toolSha256:sha(readFileSync(new URL(import.meta.url))),seed:{file:seedFile,sha256:sha(seedBytes)},tier,route,goals,setup,inputs,commands,samples,reached,captures,errors,method:'Real carried L5/L6 save; ordinary completion recommendations translated to actual keyboard/mouse until east junction; then read-only production nav steering between explicit authored-map route A/Harbor or B/Lakeshore waypoints with physical WASD, collision, live AI. Courier god only. Native driver detached before firsttick. After logged ordinary physical prefix to east junction, screenshot-only manual key commands. No map/nav/planner decisions afterjunction. Controller receives images only; hidden ledger archived for audit. Every waypoint and actual blockage photographed at actual zoom.5/1.5. No relocation, no objective skip, no perf timing.'})));}
console.log({tier,route,reached:reached.length,total:goals.length,captures:captures.length,errors});process.exitCode=errors.length?1:0;
