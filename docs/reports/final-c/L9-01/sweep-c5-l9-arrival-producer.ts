import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {launchBrowser as pooledLaunchBrowser} from '../../browser-pool/client.ts';const launchBrowser=async options=>{try{return await pooledLaunchBrowser(options)}catch(e){if(!String(e).includes('Pool disappeared after admission'))throw e;const h=await fetch('http://127.0.0.1:4329/health');if(!h.ok)throw e;return await pooledLaunchBrowser(options)}};
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';

// Focused adaptation of tools/perf/campaign-handover-time.ts: current physical saves, unique owned preview, no frame/profiler collection.
const tier = process.argv[2]; assert(['low','high'].includes(tier));
const identity=provenance(), hash=browserHash(), sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const build=JSON.parse(readFileSync('dist/.qa-accept-build.json','utf8'));assert.equal(build.sourceHash,identity.sourceHash);assert.equal(build.browserHash,hash);
const inputPath='docs/reports/final-c/campaign/transport-boundaries.json',input=JSON.parse(readFileSync(inputPath,'utf8'));const completionPath=`docs/reports/final-c/campaign/L9-${tier}-transport-campaign.json.gz`,completionBytes=readFileSync(completionPath),campaign=JSON.parse(gunzipSync(completionBytes).toString());assert(campaign.transport&&campaign.transport.occupants.length>1,'actual carried transport required');
const root='docs/reports/final-c/L9-01', out=resolve(`test-results/final-c5/L9-01-${tier}-${Date.now()}`);mkdirSync(out,{recursive:true});
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));assert.notEqual(port,3300);
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{stdio:'ignore'});
const browser=await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const errors=[],captures=[],samples=[],commands=[];let setup,result;
try {
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break;}catch{/* owned preview starts */}await delay(100);}
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const timer=setTimeout(()=>{void context.close();},8*60_000);
 try {
  const page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.stack??e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript('window.__name=f=>f');await page.goto(`http://127.0.0.1:${port}/?test=1&ui=1&scenelab=1&renderer=webgl&quality=${tier}&audio=muted&preload=0&dpr=1&controls=wasd`);
  await page.waitForFunction(()=>!!window.__SS__&&!!window.__SCENE__);
  setup=await page.evaluate(async campaign=>{
   const a=window.__SS__,g=window.__SCENE__.game;await a.ready;await g.continueCampaign(campaign,8);a.pause();
   return {level:g.world.scenario,backend:a.perf().backend,quality:a.getState().render.quality,outgoingResidentEntities:g.world.entities.size,physicalDeparture:structuredClone(campaign.transport)};
  },campaign);
  await delay(6000);await page.evaluate(()=>window.__SS__.pause());
  const capture=async stage=>{await page.evaluate(()=>window.__SS__.screenshotReady());const file=resolve(out,`${tier}-${stage}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:88});captures.push({file,sha256:sha(readFileSync(file)),stage});};
  // The exact carried departure payload is retained; no extra outgoing photo needed.
  result=await page.evaluate(async campaign=>{
   const a=window.__SS__,g=window.__SCENE__.game,start=performance.now();await g.continueCampaign(campaign,9);const end=performance.now();a.pause();g.driver=null;g.ui.show(null);g.input.release();g.world.clearInput();g.input.tap=frame=>{window.__driveFrames.push({tick:g.world.tick,drive:{...frame.drive},brake:frame.brake});};window.__driveFrames=[];
   const w=g.world,car=w.entities.get(w.missions.l9.state.carId);
   return {ms:end-start,level:w.scenario,backend:a.perf().backend,quality:a.getState().render.quality,active:w.vehicles.active,car:structuredClone(car),physicalDeparture:structuredClone(campaign.transport),loading:!document.querySelector('[data-testid="level-transition"]').hidden};
  },campaign);
  const snap=()=>page.evaluate(()=>{const g=window.__SCENE__.game,w=g.world,c=w.vehicles.cars.get(w.missions.l9.state.carId);return{tick:w.tick,active:w.vehicles.active,phase:w.missions.l9.state.phase,car:structuredClone(c.entity),speed:c.physics.speed,player:structuredClone(w.entities.get(1)),companions:[...w.entities.iterate()].filter(e=>e.companion).map(e=>structuredClone(e)),roster:(c.entity.vehicle.passengers??[]).map(p=>({passenger:structuredClone(p),entity:structuredClone(w.entities.get(p.id))})),view:g.view.vehicles.snapshot(),hud:document.querySelector('[data-testid="vehicle-durability"]')?.textContent,inputs:window.__driveFrames.splice(0)};});
  const paired=async label=>{for(const zoom of [.5,1.5]){await page.evaluate(async z=>{window.__SS__.camera.zoom(z);await window.__SS__.screenshotReady();},zoom);await capture(`${label}-z${zoom}`);captures.at(-1).zoom=zoom;captures.at(-1).state=await snap();}};
  samples.push(await snap());await paired('arrival');await page.locator('canvas').first().focus();await page.keyboard.down('KeyW');commands.push({tick:samples.at(-1).tick,keys:['KeyW']});
  for(let i=0;i<30;i++){await page.evaluate(()=>window.__SS__.step(1));samples.push(await snap());}
  await paired('first-half-second');
  for(let i=0;i<150;i++){const t=samples.at(-1).tick;if(t===300){await page.keyboard.down('KeyD');commands.push({tick:t,keys:['KeyW','KeyD']});}if(t===420){await page.keyboard.up('KeyD');commands.push({tick:t,keys:['KeyW']});}if(t===600){await page.keyboard.down('KeyA');commands.push({tick:t,keys:['KeyW','KeyA']});}if(t===720){await page.keyboard.up('KeyA');commands.push({tick:t,keys:['KeyW']});}await page.evaluate(()=>window.__SS__.step(6));samples.push(await snap());if([300,420,600,720,900].includes(samples.at(-1).tick))await paired(`drive-${samples.at(-1).tick}`);}
  await page.keyboard.up('KeyW');commands.push({tick:samples.at(-1).tick,keys:[]});console.log(tier,{car:result.car.id,hp:result.car.health.current,first:samples[0].tick,last:samples.at(-1).tick,captures:captures.length,errors});
 }finally{clearTimeout(timer);await context.close();}
}catch(error){errors.push(String(error));}
finally{await browser.close();server.kill('SIGTERM');writeFileSync(`${root}/${tier}-handover.json`,JSON.stringify({...identity,browserHash:hash,toolSha256:sha(readFileSync(new URL(import.meta.url))),physical:{input:{file:inputPath,sha256:sha(readFileSync(inputPath))},completion:{file:completionPath,sha256:sha(completionBytes)}},out,setup,result,samples,commands,captures,errors,
 method:'First30ticks sampled eachtick with actual physicalW throttle, then normal6tick steering turns and paired POzoom photos. No actor writes/cheats. Corgi passengers/hidden flags and renderer occupants read alongside exact physical incoming payload; this is not a performance/frame budget. Actual native completed L8 production transport campaign, exact unmodified save. Same continueCampaign API as CampaignUI and existing campaign-handover-time probe. Normally constructed outgoing L8 fully resident, six-second background settle, then continueCampaign toL9 with actual physical departure transport. Wall clock includes cloning/settings/teardown/load through first frame. Compare incoming live APC against actual physical L8 departure ID/HP/passengers, not the reconstructed initial outgoing hull. No Resume/actor/objective writes, frame timing, profiler or budget changes; functional handover clock only.'},null,2)+'\n');}
process.exitCode=errors.length?1:0;
