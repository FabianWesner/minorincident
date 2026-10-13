import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, test, expect } from '../e2e/fixtures';
import { qualityBudgets } from '../../src/core/Quality';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
// Run through tools/perf/quiet-run.sh on the Mac. Headless native Metal; counters on CI are not FPS evidence.
test.use({ channel:'chrome', headless:true, launchOptions:{ args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--disable-frame-rate-limit','--disable-gpu-vsync'] } });
for (const tier of ['high','low'] as const) test(`Mega distance audio/HUD ${tier} @E18-AC09 @perf`, async ({page,context}) => {
  test.setTimeout(90_000);
  await boot(page, `/?test=1&renderer=webgl&quality=${tier}&audio=muted&scenelab=1&dpr=1`);
  await page.waitForFunction(()=>!!window.__SCENE__);
  const spec:SceneSpec = { name:'mega-audio-budget',size:140,ground:'asphalt',dof:false,infectedCap:200,megaHud:true,megaAlpha:{at:[-40,0]},camera:{mode:'game',target:[0,0],zoom:1},actors:[{id:'courier',kind:'courier',at:[0,0],god:true}] };
  // Use the production spawn path: Scene Lab's per-actor clipping/pose probes are not gameplay heap.
  await page.evaluate(async ({spec,count})=>{
    await window.__SCENE__!.load(spec);const a=window.__SS__!;
    for(let i=0;i<count;i++){const angle=i/count*Math.PI*2;a.spawn('infected.runner',{x:Math.cos(angle)*20,z:Math.sin(angle)*20},{state:'chase'});}
    await a.audio.unlock();await window.__SCENE__!.step(120);await a.screenshotReady();a.resume();
  },{spec,count:tier==='high'?199:99});
  const cdp=await context.newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const proof=await page.evaluate(async()=>{
    const a=window.__SS__!, frames:number[]=[], sim:number[]=[]; let draws=0,triangles=0,voices=0; let previous=0;const start=performance.now();
    while(performance.now()-start<12000){ const now=await new Promise<number>(resolve=>requestAnimationFrame(resolve)); if(previous&&performance.now()-start>2000)frames.push(now-previous);previous=now; const perf=a.perf();draws=Math.max(draws,perf.drawCalls);triangles=Math.max(triangles,perf.triangles);voices=Math.max(voices,a.audio.snapshot().voices);if(performance.now()-start>2000&&perf.simTicks>0)sim.push(perf.simTickMs); }
    a.pause();frames.sort((a,b)=>a-b);sim.sort((a,b)=>a-b);
    const gl=document.querySelector('canvas')!.getContext('webgl2')!, ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {simP95:sim[Math.ceil(sim.length*.95)-1],simSamples:sim.length,draws,triangles,voices,frameP95:frames[Math.ceil(frames.length*.95)-1],gpu:ext?String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)):null,perf:a.perf(),audio:a.audio.snapshot(),count:a.getState().ai!.count};
  });
  // Same retained-heap method as the existing E18 memory gate; record raw heap too.
  await cdp.send('HeapProfiler.collectGarbage');
  const heap=await cdp.send('Runtime.getHeapUsage');
  mkdirSync('test-results/epics/E32/audio',{recursive:true});writeFileSync(`test-results/epics/E32/audio/perf-${tier}.json`,JSON.stringify({...proof,retainedHeapBytes:heap.usedSize},null,2));
  expect(proof.gpu).not.toMatch(/swiftshader|software|llvmpipe/i);expect(proof.count).toBe(tier==='high'?200:100);
  expect(proof.draws).toBeLessThanOrEqual(tier==='high'?600:300);expect(proof.triangles).toBeLessThanOrEqual(tier==='high'?1500000:500000);
  expect(proof.voices).toBeLessThanOrEqual(tier==='high'?32:16);expect(proof.frameP95).toBeLessThanOrEqual(tier==='high'?16.7:33.3);
  expect(proof.simSamples).toBeGreaterThan(300);expect(proof.simP95).toBeLessThanOrEqual(tier==='high'?4:6);
  expect(proof.perf.heapBytes).not.toBeNull();expect(heap.usedSize).toBeLessThanOrEqual(qualityBudgets[tier].heapMB*1_000_000);
});
