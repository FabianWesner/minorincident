// Native menu flow on deployed URLs; fresh context cold, same context reload warm.
// Run under tools/e2e-lock.sh. Each level/profile/mode pair gets a fresh browser profile.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { loadavg } from 'node:os';
import { preset, newCampaign } from '../../src/sim/progression/Campaign.ts';
const [base='https://minor-incident.com', label='prod', levels='L3', profiles='50mbit', modes='select'] = process.argv.slice(2);
const dir='docs/reports/l3-load-data'; mkdirSync(dir,{recursive:true});
const output=`${dir}/${label}.json`;
const results=process.env.RESUME==='1'&&existsSync(output)?JSON.parse(readFileSync(output,'utf8')):[];
let activePage, activeErrors, browser;
const launch=()=>chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required',...(process.env.LOAD_SPKI?['--ignore-certificate-errors-spki-list='+process.env.LOAD_SPKI]:[])]});
try { for(const profile of profiles.split(',')) for(const level of levels.split(',')) for(const mode of modes.split(',')) {
 if(mode==='transition'&&level!=='L3')continue;
 if(['cold','warm'].every(cache=>results.some(r=>r.level===level&&r.profile===profile&&r.mode===mode&&r.cache===cache)))continue;
 browser=await launch();
 const context=await browser.newContext({viewport:{width:1600,height:900}});
 const save=level==='L1'?newCampaign():preset(`${mode==='transition'?'L2':level}-default`); save.settings.quality='high';
 await context.addInitScript({content:`localStorage.setItem('minor-incident.campaign',${JSON.stringify(JSON.stringify(save))});
 window.probe={tasks:[],frames:[],stages:[],gl:{compile:0,link:0,waitMs:0},gpuCalls:{}};
 const ctx=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){const r=ctx.call(this,type,...args);if(r&&(type==='webgpu'||type==='webgl2'))probe.backend=type;return r};
 if(navigator.gpu){const request=navigator.gpu.requestAdapter.bind(navigator.gpu);navigator.gpu.requestAdapter=async function(...args){const a=await request(...args);if(a)probe.adapter={vendor:a.info.vendor,architecture:a.info.architecture,device:a.info.device,description:a.info.description,isFallbackAdapter:a.info.isFallbackAdapter};return a};}
 for(const name of ['GPUDevice','GPUQueue'])if(window[name])for(const method of name==='GPUDevice'?['createRenderPipeline','createRenderPipelineAsync','createShaderModule']:['writeTexture','onSubmittedWorkDone']){const original=window[name].prototype[method];window[name].prototype[method]=function(...args){const t=performance.now(),r=original.apply(this,args),c=probe.gpuCalls[method]??={count:0,ms:0};c.count++;c.ms+=performance.now()-t;return r}}
 new PerformanceObserver(l=>probe.tasks.push(...l.getEntries().map(e=>({at:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
 const gl=WebGL2RenderingContext.prototype,compile=gl.compileShader,link=gl.linkProgram,get=gl.getProgramParameter;
 gl.compileShader=function(s){probe.gl.compile++;return compile.call(this,s)};
 gl.linkProgram=function(p){probe.gl.link++;return link.call(this,p)};
 gl.getProgramParameter=function(p,n){const t=performance.now(),r=get.call(this,p,n);probe.gl.waitMs+=performance.now()-t;return r};
 addEventListener('click',e=>{if(e.target.closest('[data-testid="level-${level}"]')){probe.start=performance.now();probe.glStart={...probe.gl}};if(e.target.textContent==='Begin mission')probe.begin=performance.now()},true);
 let last;
 function watch(t){const p=probe,card=document.querySelector('[data-testid="level-transition"]');
 if(p.start){if(card&&!card.hidden&&!p.card)p.card=t;if(p.card&&card.hidden&&!p.end){p.end=t;p.glEnd={...p.gl}};
 const status=document.querySelector('[data-testid="transition-status"]')?.textContent;if(status!==p.status){p.status=status;p.stages.push({at:t,status})}
 if(p.begin&&p.end&&!p.playable)p.playable=t;
 if(p.playable&&t-p.playable<10000&&last)p.frames.push(t-last)}last=t;requestAnimationFrame(watch)}requestAnimationFrame(watch);`});
 for(const cache of ['cold','warm']){
  const page=await context.newPage(),cdp=await context.newCDPSession(page),requests=new Map(),errors=[];
  activePage=page;activeErrors=errors;page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url()}`)});
  if(process.env.FIX_ROOT) await page.route('**/*',async route=>{const u=new URL(route.request().url()),file=process.env.FIX_ROOT+u.pathname;if(u.origin===new URL(base).origin&&existsSync(file)&&u.pathname!=='/'){await route.fulfill({path:file});}else if(u.pathname==='/'){await route.fulfill({path:process.env.FIX_ROOT+'/index.html'});}else await route.continue();});
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:profile==='50mbit'?20:150,downloadThroughput:(profile==='50mbit'?50e6:10e6)/8,uploadThroughput:10e6/8});
  cdp.on('Network.requestWillBeSent',e=>requests.set(e.requestId,{id:e.requestId,url:e.request.url,at:e.wallTime*1000,ts:e.timestamp,bytes:0,transfers:[]}));
  cdp.on('Network.dataReceived',e=>{const r=requests.get(e.requestId);if(r)r.transfers.push({at:r.at+(e.timestamp-r.ts)*1000,bytes:e.encodedDataLength})});
  cdp.on('Network.responseReceived',e=>{const r=requests.get(e.requestId);if(r)Object.assign(r,{cached:e.response.fromDiskCache||e.response.fromServiceWorker,headers:e.response.headers,status:e.response.status})});
  cdp.on('Network.requestServedFromCache',e=>{const r=requests.get(e.requestId);if(r)r.cached=true});
  cdp.on('Network.loadingFinished',e=>{const r=requests.get(e.requestId);if(r)Object.assign(r,{bytes:e.encodedDataLength,ms:(e.timestamp-r.ts)*1000})});
  console.log(`${label} ${level} ${profile} ${mode} ${cache} boot`);
  await page.goto(base+'/?quality=high'+(process.env.RENDERER?'&renderer='+process.env.RENDERER:'')+(mode==='transition'?'&testApi=1&debug=true':''),{waitUntil:'commit',timeout:120000});
  await page.locator('[data-testid=title-levels]').waitFor({state:'visible',timeout:Number(process.env.TITLE_TIMEOUT??180000)});
  await page.locator('[data-testid=title-levels]').click();
  await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  if(process.env.TRACE==='1')await cdp.send('Tracing.start',{categories:'devtools.timeline,loading,blink.user_timing,v8,gpu,disabled-by-default-v8.cpu_profiler',transferMode:'ReturnAsStream'});
  if(mode==='select') await page.locator(`[data-testid=level-${level}]`).click();
  else {
   await page.locator('[data-testid=level-L2]').click();await page.getByRole('button',{name:'Begin mission'}).click({timeout:180000});
   await page.evaluate(async()=>{const a=window.__SS__;a.pause();for(let i=0;i<80&&a.missions.state().steps.bridge.status!=='active';i++){const active=Object.entries(a.missions.state().steps).find(([id,s])=>id!=='bridge'&&s.status==='active');if(active)a.missions.completeObjective(active[0]);else a.missions.setState('radio',true);await a.step(1)}});
   await page.waitForTimeout(Number(process.env.L2_DWELL_MS??10000));
   await page.evaluate(()=>{probe.start=performance.now();probe.glStart={...probe.gl};probe.card=probe.end=probe.playable=probe.begin=undefined;probe.frames=[];probe.stages=[];performance.clearMeasures();window.__SS__.missions.completeObjective('bridge')});
  }
  await page.getByRole('button',{name:'Begin mission'}).waitFor({state:'visible',timeout:240000});
  await page.getByRole('button',{name:'Begin mission'}).click();
  await page.waitForFunction(()=>probe.playable&&performance.now()-probe.playable>=10000,undefined,{timeout:240000});
  const {profile:cpu}=await cdp.send('Profiler.stop');
  if(process.env.TRACE==='1'){const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const {stream}=await done;let trace='';for(;;){const r=await cdp.send('IO.read',{handle:stream});trace+=r.data;if(r.eof)break}await cdp.send('IO.close',{handle:stream});const {gzipSync}=await import('node:zlib');writeFileSync(`${dir}/${label}-${level}-${profile}-${mode}-${cache}.trace.json.gz`,gzipSync(trace));}
  const data=await page.evaluate(()=>({...probe,origin:performance.timeOrigin,measures:performance.getEntriesByType('measure').map(e=>({name:e.name,at:e.startTime,ms:e.duration})),resources:performance.getEntriesByType('resource').map(e=>({url:e.name,at:e.startTime,ms:e.duration,bytes:e.transferSize,decoded:e.decodedBodySize})),gpu:(()=>{if(probe.backend!=='webgl2')return probe.adapter;const gl=document.querySelector('canvas').getContext('webgl2');const ex=gl?.getExtension('WEBGL_debug_renderer_info');return ex?gl.getParameter(ex.UNMASKED_RENDERER_WEBGL):null})()}));
  const times=new Map();cpu.samples?.forEach((id,i)=>times.set(id,(times.get(id)??0)+(cpu.timeDeltas[i]??0)));data.cpu=cpu.nodes.map(n=>({fn:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber,ms:(times.get(n.id)??0)/1000})).filter(n=>n.ms).sort((a,b)=>b.ms-a.ms).slice(0,60);
  Object.assign(data,{label,base,level,profile,mode,cache,load:loadavg(),freshBrowserProfile:true,errors,requests:[...requests.values()],clickToCard:data.card-data.start,cardMs:data.end-data.card,clickToPlayable:data.playable-data.start,beginToPlayable:data.playable-data.begin,readingMs:data.begin-data.end});
  const sorted=[...data.frames].sort((a,b)=>a-b);data.frameSummary={count:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:Math.max(...sorted),over50:sorted.filter(x=>x>50).length};
  results.push(data);writeFileSync(`${dir}/${label}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({label,level,profile,mode,cache,card:data.cardMs,playable:data.clickToPlayable,frames:data.frameSummary,errors}));if(process.env.CAPTURE==='1'){await page.screenshot({path:`${dir}/${label}-${level}-${profile}-${mode}-${cache}.png`});if(mode==='transition')for(const spot of ['l3-station-yard','l3-army-checkpoint']){await page.evaluate(async spot=>{const a=window.__SS__;a.pause();a.camera.preset('D-CORRIDOR/W2/'+spot);await a.screenshotReady()},spot);await page.screenshot({path:`${dir}/${label}-${profile}-${cache}-${spot}.png`})}}await page.close();
 }
 await context.close();await browser.close();
}}catch(error){console.log(String(error),JSON.stringify(activeErrors));if(activePage)console.log(await activePage.evaluate(()=>document.body.textContent?.slice(0,1500)).catch(()=>''));throw error}finally{await browser?.close()}
