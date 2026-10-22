import { gameplayZoomCounters } from './gameplay-zoom-counters';
import { collectedHeap } from './collected-heap';
import {mkdirSync,writeFileSync} from 'node:fs';
import {devices} from '@playwright/test';
import {test,expect} from '../e2e/fixtures';
const dir='test-results/epics/E24/perf';
const renderer=process.env.E2E_RENDERER==='webgpu'?'webgpu':'webgl';
test.use({channel:'chrome',headless:true,launchOptions:{args:['--use-angle=metal','--enable-gpu','--enable-unsafe-webgpu','--ignore-gpu-blocklist','--disable-frame-rate-limit','--disable-gpu-vsync']}});
for(const tier of ['high','low'] as const)test.describe(tier,()=>{
  if(tier==='low')test.use({viewport:{width:390,height:844},deviceScaleFactor:devices['Pixel 7'].deviceScaleFactor,userAgent:devices['Pixel 7'].userAgent,isMobile:true,hasTouch:true});
  test(`T-E24-19 @E24 @E24-AC19 @perf perf-l6-tunnel community, infected, emergency lights and flashlight ${tier}`,async({page,context})=>{
    test.setTimeout(900_000);mkdirSync(dir,{recursive:true});
    if(tier==='low'){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
    await page.goto(`/?test=1&renderer=${renderer}&quality=${tier}&audio=muted&dpr=${tier==='high'?1:1.5}&profile${process.env.L6_LOAD_PROFILE==='1'?'&loadProfile=1':''}`);await page.waitForFunction(()=>!!window.__SS__);
    await page.evaluate(async tier=>{const a=window.__SS__!;await a.ready;await a.loadLevel('L6',{seed:1,progression:'L6-default'});a.pause();a.missions.begin();a.cheats.god(true);const lamp=a.query({}).find(e=>e.archetype==='pickup.headlamp')!;a.teleport(1,lamp.transform);a.input.set({interact:true});await a.step(24);a.input.clear();a.bot.start('complete');for(let i=0;i<180&&a.missions.state()!.l6!.leaderX<128;i++)await a.step(60);a.bot.stop();const friends=a.query({}).filter(e=>e.civilian?.survivor&&e.health.current>0&&!e.infected);friends.forEach((e,i)=>a.teleport(e.id,{x:122+Math.floor(i/3)*1.5,z:14+(i%3)*.8}));a.teleport(1,{x:119,z:15});a.cheats.killAll();await a.step(1);for(let i=0;i<Math.max(0,25-friends.length);i++)a.npcs.civilian('cashier',{x:138+i,z:15},{model:'npc.civilian-man-b.aftermath',waypoints:[{x:138+i,z:15},{x:200,z:15}]});for(let i=0;i<(tier==='high'?40:30);i++)a.spawn('infected.runner',{x:99+Math.floor(i/4)*1.2,z:13.8+(i%4)*.75});a.camera.follow();await a.step(30);await a.screenshotReady();},tier);
    const initial=await page.evaluate(()=>{const a=window.__SS__!,survivors=a.query({}).filter(e=>e.civilian?.adult&&!e.infected&&e.health.current>0),s=a.missions.state()!.l6!;return{perf:a.perf(),survivors:survivors.length,movingSurvivors:survivors.filter(e=>(e.motion?.speed??0)>.05).length,infected:a.query({kind:'infected'}).filter(e=>e.health.current>0&&!e.hidden&&!e.infectionRise&&e.infected?.state!=='dead').length,directorInfectedCount:a.getState().ai!.count,retainedInfectedBodies:a.query({kind:'infected'}).filter(e=>e.corpse||e.health.current<=0).length,emergency:s.emergency,flashlight:s.flashlight};});
    expect(initial.perf.backend).toBe(renderer);expect(initial.perf.quality.tier).toBe(tier);
    expect(initial.movingSurvivors,'the stress population is walking, not only present').toBeGreaterThanOrEqual(25);expect(initial.emergency).toBe(true);expect(initial.flashlight).toBe(true);
    await page.locator('canvas').screenshot({path:`${dir}/tunnel-${tier}.png`,scale:'css'});
    const zoomMatrix=await gameplayZoomCounters(page,tier,`${dir}/zoom-${renderer}-${tier}.json`);
    const profiler=process.env.L6_CPU_PROFILE==='1'?await context.newCDPSession(page):undefined;let profileStarted=0,profileClock=0;if(profiler){await profiler.send('Performance.enable');await profiler.send('Profiler.enable');await profiler.send('Profiler.start');profileClock=(await profiler.send('Performance.getMetrics')).metrics.find(m=>m.name==='Timestamp')!.value;profileStarted=await page.evaluate(()=>performance.now());}
    const measurement=await page.evaluate(async()=>{const a=window.__SS__!,out:number[]=[],simSteps:number[]=[],tasks:{start:number;duration:number}[]=[];const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));observer.observe({type:'longtask',buffered:false});a.bot.start('complete');a.resume();let previous=0;for(let i=0;i<1500;i++){const now=await new Promise<number>(resolve=>requestAnimationFrame(resolve));if(previous&&i>2){out.push(now-previous);const p=a.perf();if(p.simTicks>0)simSteps.push(p.simTickMs);}previous=now;}a.pause();observer.disconnect();return{frames:out,simSteps,tasks,endLevel:a.getState().scenario,endPerf:a.perf(),endPlayer:a.getEntity(1)!.transform,endSurvivors:a.query({}).filter(e=>e.civilian?.adult&&!e.infected&&e.health.current>0).length};});if(profiler){writeFileSync(`test-results/l6-po/cpu-${tier}.json`,JSON.stringify({profileStarted,profileClock,...await profiler.send('Profiler.stop')}));}const frames=measurement.frames;
    const q=(k:number)=>[...frames].sort((a,b)=>a-b)[Math.ceil(frames.length*k)-1];const heap=await collectedHeap(page,context);const proof={tier,zoomMatrix,...heap,simP95:[...measurement.simSteps].sort((a,b)=>a-b)[Math.ceil(measurement.simSteps.length*.95)-1],...initial,p50:q(.5),p95:q(.95),max:Math.max(...frames),...measurement};writeFileSync(`${dir}/${tier}.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify({tier,p50:proof.p50,p95:proof.p95,max:proof.max,survivors:proof.survivors,infected:proof.infected,drawCalls:proof.perf.drawCalls,triangles:proof.perf.triangles,lighting:proof.perf.lighting,tasks:proof.tasks}));
    if(process.env.PHONE_PERF==='1'&&tier==='low')expect(proof.p95).toBeLessThanOrEqual(33.3);
    expect(measurement.endLevel).toBe('L6');expect(proof.simP95).toBeLessThanOrEqual(tier==='high'?4:6);expect(heap.heapMB).toBeLessThanOrEqual(tier==='high'?400:250);
    expect(initial.survivors).toBeGreaterThanOrEqual(25);expect(measurement.endSurvivors).toBeGreaterThanOrEqual(25);expect(initial.infected).toBeGreaterThanOrEqual(tier==='high'?40:30);expect(initial.perf.lighting!.heroShadow).toBe(tier==='high'?1:0);expect(initial.perf.drawCalls).toBeLessThanOrEqual(tier==='high'?600:300);expect(initial.perf.triangles).toBeLessThanOrEqual(tier==='high'?1_500_000:500_000);if(tier==='high')expect(proof.p95).toBeLessThanOrEqual(14);else expect(proof.p50).toBeLessThanOrEqual(1000/30);expect(proof.max).toBeLessThanOrEqual(tier==='high'?50:80);
  });
});
for(const tier of ['high','low'] as const)test.describe(`transitions ${tier}`,()=>{
if(tier==='low')test.use({viewport:{width:390,height:844},deviceScaleFactor:devices['Pixel 7'].deviceScaleFactor,userAgent:devices['Pixel 7'].userAgent,isMobile:true,hasTouch:true});
test(`T-E24-19-transitions @E24 @E24-AC19 @perf breach2 and abandon switch without a 50ms frame ${tier}`,async({page,context})=>{
  test.setTimeout(600_000);mkdirSync(dir,{recursive:true});if(tier==='low'){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  await page.goto(`/?test=1&renderer=${renderer}&quality=${tier}&audio=muted&dpr=${tier==='high'?1:1.5}`);await page.waitForFunction(()=>!!window.__SS__);
  const proof=await page.evaluate(async()=>{
    const a=window.__SS__!;await a.ready;await a.loadLevel('L6',{seed:1,progression:'L6-default'});a.pause();a.missions.begin();a.cheats.god(true);
    await a.step(Math.max(0,a.missions.state()!.l6!.breach2At-a.tick()-3));await a.screenshotReady();
    const startTick=a.tick(),before=structuredClone(a.missions.state()!.l6!),frames:{fromTick:number;toTick:number;ms:number}[]=[];
    let previous=await new Promise<number>(resolve=>requestAnimationFrame(resolve)),previousTick=startTick;const deadline=performance.now()+30_000;a.resume();
    while(performance.now()<deadline){
      const now=await new Promise<number>(resolve=>requestAnimationFrame(resolve)),tick=a.tick();
      frames.push({fromTick:previousTick,toTick:tick,ms:now-previous});previous=now;previousTick=tick;
      const s=a.missions.state()!.l6!;if(s.abandonAt>0&&tick>=s.abandonAt+30)break;
    }
    a.pause();const state=a.missions.state()!.l6!,events=a.events();
    return(['breach2','abandon']as const).map(beat=>{
      const event=events.find(e=>e.type===`l6.${beat}`),eventTick=event?.tick??null;
      const window=eventTick===null?[]:frames.filter(f=>f.toTick>=eventTick-3&&f.fromTick<=eventTick+30);
      return{beat,startTick,before,eventTick,captured:eventTick!==null&&eventTick>startTick&&eventTick<=previousTick,max:window.length?Math.max(...window.map(f=>f.ms)):null,frames:window,state};
    });
  });
  writeFileSync(`${dir}/transitions-${tier}.json`,JSON.stringify(proof,null,2));
  for(const row of proof){expect(row.before.emergency).toBe(false);expect(row.before.abandonAt).toBe(0);expect(row.captured,`${row.beat} event occurs inside the measured interval`).toBe(true);expect(row.frames.length).toBeGreaterThan(0);expect(row.max).not.toBeNull();expect(row.max!).toBeLessThanOrEqual(50);expect(row.state.emergency).toBe(true);if(row.beat==='abandon')expect(row.eventTick).toBe(row.state.abandonAt);}

});

});
