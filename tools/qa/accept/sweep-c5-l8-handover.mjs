import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from '../../browser-pool/client.ts';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';

// Focused adaptation of tools/perf/campaign-handover-time.ts: current physical saves, unique owned preview, no frame/profiler collection.
const tier = process.argv[2]; assert(['low','high'].includes(tier));
const identity=provenance(), hash=browserHash(), sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const build=JSON.parse(readFileSync('dist/.qa-accept-build.json','utf8'));assert.equal(build.sourceHash,identity.sourceHash);assert.equal(build.browserHash,hash);
const base=`docs/reports/fix51-r10c/L7-L8-carried-${tier}`, inputPath=`${base}-input.json`, input=JSON.parse(readFileSync(inputPath,'utf8'));
assert.equal(input.sourceHash,identity.sourceHash);assert.equal(input.browserHash,hash);assert(!input.error&&input.result.runs.some(r=>r.level==='L8'&&r.finished&&!r.skipped.length));
const completionPath=`${base}/late-input-completion.json.gz`, completionBytes=readFileSync(completionPath), completion=JSON.parse(gunzipSync(completionBytes).toString()), campaign=completion.campaign;
const root='docs/reports/sweep-c5/L8-10', out=resolve(`test-results/sweep-c5/L8-10-${tier}-${Date.now()}`);mkdirSync(out,{recursive:true});
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));assert.notEqual(port,3300);
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{stdio:'ignore'});
const browser=await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const errors=[],captures=[];let setup,result;
try {
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break;}catch{/* owned preview starts */}await delay(100);}
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 try {
  const page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.stack??e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript('window.__name=f=>f');await page.goto(`http://127.0.0.1:${port}/?test=1&ui=1&scenelab=1&renderer=webgl&quality=${tier}&audio=muted&preload=0&dpr=1`);
  await page.waitForFunction(()=>!!window.__SS__&&!!window.__SCENE__);
  setup=await page.evaluate(async campaign=>{
   const a=window.__SS__,g=window.__SCENE__.game;await a.ready;await g.continueCampaign(campaign,8);a.pause();
   return {level:g.world.scenario,backend:a.perf().backend,quality:a.getState().render.quality,outgoingResidentEntities:g.world.entities.size,physicalDeparture:structuredClone(campaign.transport)};
  },campaign);
  await delay(6000);await page.evaluate(()=>window.__SS__.pause());
  const capture=async stage=>{await page.evaluate(()=>window.__SS__.screenshotReady());const file=resolve(out,`${tier}-${stage}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:88});captures.push({file,sha256:sha(readFileSync(file)),stage});};
  await capture('outgoing-resident');
  result=await page.evaluate(async campaign=>{
   const a=window.__SS__,g=window.__SCENE__.game,start=performance.now();await g.continueCampaign(campaign,9);const end=performance.now();a.pause();
   const w=g.world,car=w.entities.get(w.missions.l9.state.carId);
   return {ms:end-start,level:w.scenario,backend:a.perf().backend,quality:a.getState().render.quality,active:w.vehicles.active,car:structuredClone(car),physicalDeparture:structuredClone(campaign.transport),loading:!document.querySelector('[data-testid="level-transition"]').hidden};
  },campaign);
  await capture('incoming');console.log(tier,{ms:result.ms,id:result.car.id,hp:result.car.health.current,errors});
 }finally{await context.close();}
}catch(error){errors.push(String(error));}
finally{await browser.close();server.kill('SIGTERM');writeFileSync(`${root}/${tier}-handover.json`,JSON.stringify({...identity,browserHash:hash,toolSha256:sha(readFileSync(new URL(import.meta.url))),physical:{input:{file:inputPath,sha256:sha(readFileSync(inputPath))},completion:{file:completionPath,sha256:sha(completionBytes)}},out,setup,result,captures,errors,
 method:'Current qualified physical L7/L8 completion campaign, exact unmodified save. Same continueCampaign API as CampaignUI and existing campaign-handover-time probe. Normally constructed outgoing L8 fully resident, six-second background settle, then continueCampaign toL9 with actual physical departure transport. Wall clock includes cloning/settings/teardown/load through first frame. Compare incoming live APC against actual physical L8 departure ID/HP/passengers, not the reconstructed initial outgoing hull. No Resume/actor/objective writes, frame timing, profiler or budget changes; functional handover clock only.'},null,2)+'\n');}
process.exitCode=errors.length?1:0;
