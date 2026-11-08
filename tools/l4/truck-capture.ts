import { launchBrowser } from '../browser-pool/client';
import { mkdirSync, writeFileSync } from 'node:fs';
/** One headless L4 truck view at both requested zooms. Run through tools/e2e-lock.sh;
 * start a private QA Vite server first (L4_CAPTURE_ORIGIN, default localhost:3484).
 * Usage: node --import tsx/esm tools/l4/truck-capture.ts webgl|webgpu high|low
 */
const backend=process.argv[2]??'webgl', tier=process.argv[3]??'high';
if (!['webgl','webgpu'].includes(backend) || !['high','low'].includes(tier)) throw new Error('Expected webgl|webgpu high|low');
const out=process.env.L4_TRUCK_CAPTURE_OUT??'/private/tmp/r12-l4truck-captures';mkdirSync(out,{recursive:true});
const browser=await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--enable-unsafe-webgpu']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
page.setDefaultTimeout(120000);
const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
try {
 console.log('navigate',backend,tier);
 await page.goto(`${process.env.L4_CAPTURE_ORIGIN??'http://127.0.0.1:3484'}/?test=1&renderer=${backend}&quality=${tier}&audio=muted&ui=1&dpr=1`);
 await page.waitForFunction(()=>!!window.__SS__);
 await page.evaluate(async()=>{await window.__SS__!.ready;});
 console.log('initial ready; load L4');
 await page.evaluate(async()=>{const a=window.__SS__!;await a.loadLevel('L4',{seed:2,progression:'L4-default'});a.pause();});
 console.log('L4 ready');
 await page.getByRole('button',{name:'Begin mission'}).click();
 await page.evaluate(async()=>{const a=window.__SS__!;a.pause();a.cheats.god(true);a.cheats.completeObjective('ride');await a.step(60);});
 const truck=await page.evaluate(()=>{const a=window.__SS__!,s=a.missions.state()!.l4!;return a.getState().entities.find(e=>e.id===s.convoyIds[3])!.transform;});
 console.log('truck',truck);
 await page.evaluate(async p=>{const a=window.__SS__!;a.teleport(1,{x:p.x-1,z:p.z+3});a.camera.follow();a.cheats.completeObjective('quartermaster');await a.step(180);},truck);
 const captures:unknown[]=[]; const proof={backend,tier,truck,errors,captures};
 for(const zoom of [1,1.5]) {
  await page.evaluate(async z=>{const a=window.__SS__!;a.camera.zoom(z);await a.step(1);await a.screenshotReady();},zoom);
  const actual=await page.evaluate(()=>({backend:window.__SS__!.perf().backend,tier:window.__SS__!.perf().quality.tier,phase:window.__SS__!.missions.state()!.l4!.phase,cinematic:window.__SS__!.missions.state()!.cinematic,camera:window.__SS__!.getState().render.camera}));
  console.log('capture',zoom,actual.backend,actual.tier);
  if(actual.backend!==backend||actual.tier!==tier||actual.phase!=='war'||actual.cinematic)throw new Error('Backend/tier/active-war framing mismatch');
  const file=`${out}/${backend}-${tier}-z${zoom}.jpg`;await page.screenshot({path:file,type:'jpeg',quality:88});proof.captures.push({zoom,file,...actual});
 }
 writeFileSync(`${out}/${backend}-${tier}.json`,JSON.stringify(proof,null,2));
 console.log('done',errors);
}finally{await browser.close();}
