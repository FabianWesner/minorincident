import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {launchBrowser} from '../../browser-pool/client.ts';
import {markerWalkKeys} from '../../playtest/input.ts';
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
const tier=process.argv[2];assert(['low','high'].includes(tier));
const identity=provenance(),hash=browserHash(),sha=b=>createHash('sha256').update(b).digest('hex');
const root='docs/reports/final-c/L7-12',seedFile=`docs/reports/final-c/campaign/L7-${tier}-carried-save.json.gz`,seedBytes=readFileSync(seedFile),campaign=JSON.parse(gunzipSync(seedBytes));
mkdirSync(root,{recursive:true});
const out=resolve(`test-results/final-c-l7-readability-${tier}-${Date.now()}`);mkdirSync(out,{recursive:true});
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));assert.notEqual(port,3300);
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{stdio:'ignore'});
const browser=await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const captures=[],cells=[],commands=[],errors=[];let setup,result;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break;}catch{}await delay(100);}
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const timer=setTimeout(()=>{void context.close();},8*60_000),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  await page.addInitScript('window.__name=f=>f');
  await page.goto(`http://127.0.0.1:${port}/?test=1&ui=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);
  await page.waitForFunction(()=>!!window.__SS__&&!!window.__SCENE__);
  setup=await page.evaluate(async({campaign,tier})=>{
   const a=window.__SS__,g=window.__SCENE__.game;await a.ready;a.pause();a.campaign.restore(campaign);await a.loadLevel('L7',{seed:1});a.pause();
   a.settings.set({quality:tier,cameraShake:false,aimAssist:'Off'});a.missions.begin();a.cheats.god(true);g.ui.show(null);g.input.release();g.world.clearInput();a.camera.zoom(1.5);
   a.bot.start('complete');window.__l7ReadabilityPolicy=g.driver;a.bot.stop();
   window.__l7Readability={inputs:[]};g.input.tap=f=>window.__l7Readability.inputs.push({tick:g.world.tick,move:{...f.move},mouseAttack:!!f.mouseAttack,interact:f.interact,nativeDriver:!!g.driver});
   return{incomingIds:campaign.results.L6.escapedSurvivors.map(e=>e.id),backend:a.perf().backend,quality:a.getState().render.quality,driverDetached:g.driver===null};
  },{campaign,tier});
  const saveCanvas=async(label,zoom,kind)=>{
   const url=await page.evaluate(async()=>{await window.__SS__.screenshotReady();return document.querySelector('canvas').toDataURL('image/png');});
   const file=resolve(out,`${tier}-${label}-z${zoom}-${kind}.png`),bytes=Buffer.from(url.slice(url.indexOf(',')+1),'base64');writeFileSync(file,bytes);
   const capture={file,sha256:sha(bytes),label,zoom,kind};captures.push(capture);return capture;
  };
  const photo=async label=>{
   for(const zoom of [.5,1.5]){
    const state=await page.evaluate(async zoom=>{
     const a=window.__SS__,g=window.__SCENE__.game,w=g.world;a.camera.zoom(zoom);await a.screenshotReady();const p=w.entities.get(1).transform;
     const alphas=w.infected.active.filter(e=>e.archetype==='infected.alpha'&&e.health.current>0&&!e.hidden).map(e=>({id:e.id,hp:e.health.current,appearance:e.appearance,position:{...e.transform},distance:Math.hypot(e.transform.x-p.x,e.transform.z-p.z)}));
     const ring=Array.from({length:64},(_,i)=>{const angle=i/64*Math.PI*2,x=p.x+2*Math.cos(angle),z=p.z+2*Math.sin(angle),q=a.camera.project(x,p.y-.7,z);return{world:[x,p.y-.7,z],screen:{x:(q[0]+1)*innerWidth/2,y:(1-q[1])*innerHeight/2}};});
     return{tick:w.tick,player:{...p},ring,alphas,nearbyInfected:w.infected.active.filter(e=>e.health.current>0&&!e.hidden&&Math.hypot(e.transform.x-p.x,e.transform.z-p.z)<30).length,backend:a.perf().backend,quality:a.getState().render.quality,camera:a.getState().render.camera};
    },zoom);
    const normal=await saveCanvas(label,zoom,'normal');let hidden,mask;
    try{
     await page.evaluate(()=>{const a=window.__SS__,g=window.__SCENE__.game;window.__SCENE__.hideProbe(true,false,false,true);g.view.update(1);a.settings.set({idPass:false});});hidden=await saveCanvas(label,zoom,'hidden');
     await page.evaluate(()=>{const a=window.__SS__,g=window.__SCENE__.game;window.__SCENE__.hideProbe(false,false,false,true);a.settings.set({idPass:true});g.view.update(1);});mask=await saveCanvas(label,zoom,'id');
    }finally{await page.evaluate(async()=>{window.__SS__.settings.set({idPass:false});window.__SCENE__.hideProbe(false,false,false,false);window.__SCENE__.game.view.update(1);await window.__SS__.screenshotReady();});}
    const afterTick=await page.evaluate(()=>window.__SCENE__.game.world.tick);assert.equal(afterTick,state.tick,'same-pose redraws cannot advance simulation');
    cells.push({label,zoom,state,normal,hidden,mask,afterTick});
   }
   await page.evaluate(()=>window.__SS__.camera.zoom(1.5));
  };
  await page.locator('canvas').first().focus();let held=[],selected=false,rocketPhoto=false,alphaPhoto=false;
  for(let i=0;i<4000;i++){
   const plan=await page.evaluate(()=>{const g=window.__SCENE__.game,w=g.world,p=w.entities.get(1),f=window.__l7ReadabilityPolicy.sample();const alphas=w.infected.active.filter(e=>e.archetype==='infected.alpha'&&e.health.current>0&&!e.hidden).map(e=>({id:e.id,distance:Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z)})).sort((a,b)=>a.distance-b.distance);return{tick:w.tick,player:{...p.transform},frame:f,rocket:p.weapons.RIGHT.rack.some(s=>s.id==='weapon.rocket-launcher'),alpha:alphas[0]??null};});
   if(i%400===0)console.log(tier,{tick:plan.tick,x:plan.player.x,alpha:plan.alpha});
   if(plan.rocket&&!selected){await page.keyboard.press('Digit7');selected=true;}
   if(plan.rocket&&!rocketPhoto){await photo('rocket');rocketPhoto=true;}
   if(plan.alpha&&plan.alpha.distance<=5){
    for(const key of held)await page.keyboard.up(key);held=[];
    await photo('horde-0');await page.keyboard.down('KeyD');commands.push({tick:plan.tick,keys:['KeyD'],method:'physical side-step burst'});await page.evaluate(()=>window.__SS__.step(6));
    await photo('horde-6');await page.evaluate(()=>window.__SS__.step(6));await page.keyboard.up('KeyD');await photo('horde-12');alphaPhoto=true;break;
   }
   const f=plan.frame,x=f.move.x-f.move.z,y=f.move.x+f.move.z,next=markerWalkKeys(x*100,y*100,(i%10)/10);if(f.interact)next.push('KeyE');
   for(const key of held.filter(k=>!next.includes(k)))await page.keyboard.up(key);for(const key of next.filter(k=>!held.includes(k)))await page.keyboard.down(key);held=next;
   // Deliberately approach without firing, so an original living Alpha reaches the ordinary game camera.
   commands.push({tick:plan.tick,keys:[...held],mouseDown:false,plannedMove:f.move});await page.evaluate(()=>window.__SS__.step(3));
  }
  for(const key of held)await page.keyboard.up(key);
  result=await page.evaluate(()=>({inputs:window.__l7Readability.inputs,tick:window.__SCENE__.game.world.tick}));
  if(!rocketPhoto||!alphaPhoto)errors.push('Missing actual pickup/close live Alpha frame burst');console.log(tier,{cells:cells.length,frames:captures.length,tick:result.tick,errors});
 }finally{clearTimeout(timer);await context.close();}
}catch(error){errors.push(String(error));console.error(error);}
finally{
 await browser.close();server.kill('SIGTERM');
 writeFileSync(`${root}/${tier}-physical.json.gz`,gzipSync(JSON.stringify({...identity,browserHash:hash,toolSha256:sha(readFileSync(new URL(import.meta.url))),seed:{file:seedFile,sha256:sha(seedBytes)},out,setup,result,commands,cells,captures,errors,method:'Actual L5/L6 progressed save, current L7, physical WASD/E/Digit7 using detached ordinary planner and existing shorter-axis key pulses. Approach without firing to retain an original living Alpha, then physical six/twelve-tick sidestep burst. Both actual qualities and userzoom0.5/1.5 at rocket/close-horde spots. Courier protection only, no actor/health/pose/objective writes. Paused same-tick native/hidden-courier/production-depth ID redraws; actual projected2m XZ ring. No performance measurements.'})));
}
process.exitCode=errors.length?1:0;
