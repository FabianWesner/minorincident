import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {launchBrowser as pooledLaunchBrowser} from '../../browser-pool/client.ts';const launchBrowser=async options=>{try{return await pooledLaunchBrowser(options)}catch(e){if(!String(e).includes('Pool disappeared after admission'))throw e;const h=await fetch('http://127.0.0.1:4329/health');if(!h.ok)throw e;return await pooledLaunchBrowser(options)}};
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
const identity=provenance(),hash=browserHash(),out=resolve(`test-results/final-c/ballistics-${Date.now()}`);mkdirSync(out,{recursive:true});
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));assert.notEqual(port,3300);
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{stdio:'ignore'});
const rows=[],browser=await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break;}catch{}await delay(100);}
 for(const tier of ['low','high']){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();page.setDefaultTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.addInitScript('window.__name=f=>f');await page.goto(`http://127.0.0.1:${port}/?test=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);
   await page.waitForFunction(()=>!!window.__SS__&&!!window.__SCENE__);
   for(const kind of ['first-hit','far-click','direction-range']){
    const setup=await page.evaluate(async({tier,kind})=>{
     const a=window.__SS__,g=window.__SCENE__.game;await a.ready;a.pause();await a.loadScenario('horde-arena',{seed:1});a.pause();a.settings.set({quality:tier,vfx:true,timeOfDay:'night',cameraShake:false,cheapDof:false,aimAssist:'Off'});a.cheats.god(true);a.setLoadout(['weapon.rocket-launcher'],['weapon.kick']);
     g.driver=null;g.ui.show(null);g.input.release();g.world.clearInput();g.world.infected.update=()=>{};
     const point=kind==='far-click'?{x:50,z:0}:{x:12,z:0},ids=[];
     if(kind==='first-hit')ids.push(a.spawn('infected.runner',{x:6,z:0},{state:'idle'}));
     a.camera.cinematic({position:[65,70,50],target:[20,.7,0]},true);if(kind==='pointblank'){a.camera.follow();a.camera.zoom(.5);a.step(120);}await a.screenshotReady();
     const inputs=[];g.input.tap=frame=>inputs.push({tick:a.tick(),aimPoint:frame.aimPoint,mouseAttack:frame.mouseAttack,activeAttack:frame.activeAttack,aimSource:frame.aimSource});window.__rocketProof={point,ids,inputs,start:a.tick(),initial:ids.map(id=>{const e=g.world.entities.get(id);return {id,hp:e.health.current,maxHp:e.health.max,position:{...e.transform}};})};
     return {point,ids,backend:a.perf().backend,quality:a.getState().render.quality};
    },{tier,kind});
    const cursor=await page.evaluate(()=>window.__SS__.input.project(window.__rocketProof.point,'destination'));assert(cursor.x>0&&cursor.x<1280&&cursor.y>0&&cursor.y<720,JSON.stringify(cursor));
    await page.mouse.move(cursor.x,cursor.y);if(kind==='direction-range')await page.keyboard.down('Space');else{await page.keyboard.down('ShiftLeft');await page.mouse.down();}
    const captures=[];let previous=0;
    for(const tick of [1,40,120,200]){
     await page.evaluate(n=>window.__SS__.step(n),tick-previous);previous=tick;
     if(kind!=='cadence'&&tick===1){await page.mouse.up();await page.keyboard.up('ShiftLeft');await page.keyboard.up('Space');}
     if([1,40,200].includes(tick)){
      await page.evaluate(()=>window.__SS__.screenshotReady());const file=resolve(out,`${tier}-${kind}-${tick}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:88});captures.push({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});
     }
    }
    await page.mouse.up();await page.keyboard.up('ShiftLeft');await page.keyboard.up('Space');await page.evaluate(()=>window.__SS__.step(100));
    const result=await page.evaluate(()=>{const a=window.__SS__,g=window.__SCENE__.game,r=window.__rocketProof;return {...r,events:a.events(r.start).filter(e=>['combat.attack','combat.hit','combat.kill','explosion'].includes(e.type)),final:r.ids.map(id=>{const e=g.world.entities.get(id);return {id,hp:e.health.current,position:{...e.transform},radius:e.combat?.radius};})};});
    rows.push({tier,kind,setup,cursor,captures,result,errors:[...errors]});console.log(tier,kind,result.events.filter(e=>e.type==='combat.attack'&&e.sourceId===1).length,result.final.filter(e=>e.hp===0).length);
   }
  }finally{await context.close();}
 }
}finally{await browser.close();server.kill('SIGTERM');writeFileSync('docs/reports/final-c/L7-03/ballistics.json',JSON.stringify({...identity,browserHash:hash,toolSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),out,method:'Controlled first-hit, beyond-catalog ground-click and direction-only range fixtures at both tiers through shared headless Metal WebGL2. One normal60HP regular at6m before clicked12m ground, empty ground clicked50m, or actual Space with no aimPoint for the catalog35m fallback. Actual Shift+LMB or Space input; production projectiles; AI frozen to isolate ballistics. No performance timing.',rows},null,2)+'\n');}
