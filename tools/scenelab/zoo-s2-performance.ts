import { uncappedArgs } from '../perf/uncapped';
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { attachErrorGuard } from '../../tests/e2e/fixtures';
const port=Number(process.env.SCENE_PORT??3473), origin=`http://127.0.0.1:${port}`;
if(port===3300)throw new Error('Private port required');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{stdio:'ignore'});
const out:unknown[]=[];
try{
 let up=false;for(let i=0;i<120&&!up;i++){try{up=(await fetch(origin)).ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,500));}if(!up)throw new Error('Vite not ready');
 for(const tier of ['high','low'] as const){
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist',...uncappedArgs()]});
  try{
   const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const page=await context.newPage();const guard=attachErrorGuard(page);
   await page.goto(`${origin}/?test=1&renderer=webgl&quality=${tier}&audio=muted&profile=1&dpr=1&seed=1`);
   await page.waitForFunction(()=>!!window.__SS__,null,{timeout:120000});
   await page.evaluate(async quality=>{const a=window.__SS__!;await a.ready;await a.loadScenario('horde-arena');a.pause();a.cheats.god(true);const count=quality==='high'?200:100;for(let i=0;i<count;i++)a.spawn(i<4?'infected.elephant':i<8?'infected.gorilla':'infected.runner',{x:(i%20)*.8-8,z:Math.floor(i/20)*.8-12},{state:'chase'});a.camera.preset('perf-horde');await a.step(120);await a.screenshotReady();},tier);
   const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');
   const proof=await page.evaluate(async quality=>{
    const a=window.__SS__!,gl=document.querySelector('canvas')!.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');
    const gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null;
    a.resume();const frames:number[]=[],sim:number[]=[];let previous=0;const start=performance.now(),startTick=a.tick(),startFrame=a.perf().renderedFrames;
    for(let i=0;i<720||performance.now()-start<12000;i++){const now=await new Promise<number>(requestAnimationFrame);if(i>=120&&previous){frames.push(now-previous);sim.push(a.perf().simMs);}previous=now;}
    frames.sort((a,b)=>a-b);sim.sort((a,b)=>a-b);
    const perf=a.perf(),crowd=a.getState().render.crowd;
    const result={quality,gpu,backend:perf.backend,headless:true,unthrottled:true,count:a.getState().ai!.count,elephantCount:crowd?.batches.filter(b=>b.id==='inf.elephant').reduce((n,b)=>n+b.instances,0),specialActivations:a.events().filter(e=>e.type==='infected.special'&&e.stage==='active').length,durationMs:performance.now()-start,ticks:a.tick()-startTick,renderedFrames:perf.renderedFrames-startFrame,samples:frames.length,frameMsP95:frames[Math.ceil(frames.length*.95)-1],frameMsP50:frames[Math.ceil(frames.length*.5)-1],simMsP95:sim[Math.ceil(sim.length*.95)-1],heapBytes:perf.heapBytes,drawCalls:perf.drawCalls,triangles:perf.triangles,crowdDrawCalls:crowd?.meshDrawCalls,nonInstancedMeshes:crowd?.nonInstancedMeshes,recordedAt:new Date().toISOString()};a.pause();return result;
   },tier);
   const heap=await cdp.send('Runtime.getHeapUsage');out.push({...proof,cdpHeapUsedBytes:heap.usedSize,consoleErrors:guard.errors});writeFileSync('docs/reports/zoo-s2/frame-performance.json',JSON.stringify(out,null,2)+'\n');
  }finally{await browser.close();}
 }
}finally{server.kill();}
