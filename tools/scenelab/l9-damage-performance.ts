import { strict as assert } from 'node:assert';
import { SceneSession, stopServer, writeJson } from './session';
import type { Game } from '../../src/Game';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

// Reuse L9-S1's populated resolver fixture with the worst damage state and both player zooms.
const output = 'test-results/epics/E31/l9-a1/performance';
try {
  for (const tier of ['high','low'] as const) {
    const session = new SceneSession({tier,nativeFrameTiming:true,viewport:tier==='high'?{width:1600,height:900}:{width:390,height:844}});
    try {
      await session.open();
      for (const zoom of [1,.5]) {
        const count=tier==='high'?200:100;
        const spec: SceneSpec = {name:'l9-damage-budget',seed:31,size:100,ground:'asphalt',time:'night',infectedCap:200,
          actors:[{id:'courier',kind:'courier',at:[4,4]},...Array.from({length:count},(_,i)=>({id:`infected-${i}`,kind:'infected' as const,archetype:'infected.runner',at:[-18+(i%20)*1.8,-12-Math.floor(i/20)*1.8] as [number,number]}))],
          vehicles:[{id:'apc',asset:'vehicle.military-apc',at:[0,0],floor:true,health:0}],camera:{mode:'game',target:'apc',zoom}};
        await session.load(spec); await session.step(1); await session.ready();
        const cdp=await session.page.context().newCDPSession(session.page); await cdp.send('HeapProfiler.collectGarbage');
        if(tier==='low') await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
        const proof=await session.page.evaluate(async()=>{
          const api=window.__SS__!, w=(window.__SCENE__ as unknown as {game:Game}).game.world;
          // Same stationary chase fixture as tools/scenelab/l9-apc.ts: AI runs; keep the population spatially stable.
          for(const e of w.infected!.active){delete e.infected!.l1;e.infected!.speed=0;e.infected!.state='chase';}
          api.resume();const frames:number[]=[],sim:number[]=[];let previous=0;const start=performance.now();
          for(let i=0;i<840||performance.now()-start<14000;i++){
            const now=await new Promise<number>(requestAnimationFrame);
            if(i>=120&&previous){frames.push(now-previous);sim.push(api.perf().simMs);}previous=now;
          }
          api.pause();frames.sort((a,b)=>a-b);sim.sort((a,b)=>a-b);const perf=api.perf();
          const gl=document.querySelector('canvas')!.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');
          return {gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,backend:perf.backend,infected:w.infected!.active.length,frameP95:frames[Math.ceil(frames.length*.95)-1],simP95:sim[Math.ceil(sim.length*.95)-1],draws:perf.drawCalls,triangles:perf.triangles,samples:frames.length,carHP:[...w.vehicles!.cars.values()][0].entity.health.current,damage:(window.__SCENE__ as unknown as {game:Game}).game.view.labProbes().vehicles!.snapshot()[0].apcDamage};
        });
        await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');await cdp.detach();
        const result={tier,zoom,headless:true,cpuThrottle:tier==='low'?4:1,...proof,heapMB:heap.usedSize/1_000_000,errors:session.errors};
        writeJson(`${output}/${tier}-z${zoom}.json`,result);await session.screenshot(`${output}/${tier}-z${zoom}.png`);
        assert.equal(proof.backend,'webgl');assert(proof.gpu&&!/swiftshader|software|llvmpipe/i.test(proof.gpu));assert.equal(proof.infected,count);assert.equal(proof.carHP,0);
        assert(proof.frameP95<=(tier==='high'?16.7:33.3));assert(proof.simP95<=(tier==='high'?4:6));assert(proof.draws<=(tier==='high'?600:300));assert(proof.triangles<=(tier==='high'?1500000:500000));assert(result.heapMB<=(tier==='high'?400:250));assert.equal(session.errors.length,0);
        console.log(JSON.stringify(result));
      }
    } finally {await session.close();}
  }
} finally {stopServer();}
