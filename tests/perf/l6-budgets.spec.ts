import {mkdirSync,writeFileSync} from 'node:fs';
import {devices} from '@playwright/test';
import {test,expect} from '../e2e/fixtures';
const dir='test-results/epics/E24/perf';
test.use({channel:'chrome',headless:true,launchOptions:{args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--disable-frame-rate-limit','--disable-gpu-vsync']}});
for(const tier of ['high','low'] as const)test.describe(tier,()=>{
  if(tier==='low')test.use({viewport:{width:390,height:844},deviceScaleFactor:devices['Pixel 7'].deviceScaleFactor,userAgent:devices['Pixel 7'].userAgent,isMobile:true,hasTouch:true});
  test(`T-E24-19 @E24 @E24-AC19 @perf perf-l6-tunnel community, infected, emergency lights and flashlight ${tier}`,async({page,context})=>{
    test.setTimeout(900_000);mkdirSync(dir,{recursive:true});
    if(tier==='low'){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
    await page.goto(`/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=${tier==='high'?1:1.5}&profile`);await page.waitForFunction(()=>!!window.__SS__);
    await page.evaluate(async tier=>{const a=window.__SS__!;await a.ready;await a.loadLevel('L6',{seed:1,progression:'L6-default'});a.pause();a.missions.begin();a.cheats.god(true);a.bot.start('complete');for(let i=0;i<180&&a.missions.state()!.l6!.leaderX<128;i++)await a.step(60);a.bot.stop();const friends=a.query({}).filter(e=>e.civilian?.survivor&&e.health.current>0&&!e.infected);friends.forEach((e,i)=>a.teleport(e.id,{x:122+Math.floor(i/3)*1.5,z:14+(i%3)*.8}));a.teleport(1,{x:119,z:15});a.cheats.killAll();await a.step(1);for(let i=0;i<Math.max(0,25-friends.length);i++)a.npcs.civilian('cashier',{x:138+i,z:15},{model:'npc.civilian-man-b.aftermath',waypoints:[{x:138+i,z:15},{x:200,z:15}]});for(let i=0;i<(tier==='high'?40:30);i++)a.spawn('infected.runner',{x:99+Math.floor(i/4)*1.2,z:13.8+(i%4)*.75});a.camera.follow();await a.step(30);await a.screenshotReady();},tier);
    const initial=await page.evaluate(()=>({perf:window.__SS__!.perf(),survivors:window.__SS__!.query({}).filter(e=>e.civilian?.adult&&!e.infected).length,infected:window.__SS__!.getState().ai!.count}));
    await page.locator('canvas').screenshot({path:`${dir}/tunnel-${tier}.png`,scale:'css'});
    const measurement=await page.evaluate(async()=>{const a=window.__SS__!,out:number[]=[],tasks:{start:number;duration:number}[]=[];const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));observer.observe({type:'longtask',buffered:false});a.bot.start('complete');a.resume();let previous=0;for(let i=0;i<1500;i++){const now=await new Promise<number>(resolve=>requestAnimationFrame(resolve));if(previous&&i>2)out.push(now-previous);previous=now;}a.pause();observer.disconnect();return{frames:out,tasks,endSurvivors:a.query({}).filter(e=>e.civilian?.adult&&!e.infected&&e.health.current>0).length};});const frames=measurement.frames;
    const q=(k:number)=>[...frames].sort((a,b)=>a-b)[Math.ceil(frames.length*k)-1];const proof={tier,...initial,p50:q(.5),p95:q(.95),max:Math.max(...frames),...measurement};writeFileSync(`${dir}/${tier}.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify({...proof,frames:undefined}));
    expect(initial.survivors).toBeGreaterThanOrEqual(25);expect(measurement.endSurvivors).toBeGreaterThanOrEqual(25);expect(initial.infected).toBeGreaterThanOrEqual(tier==='high'?40:30);expect(initial.perf.lighting!.heroShadow).toBe(1);expect(initial.perf.drawCalls).toBeLessThanOrEqual(tier==='high'?600:300);expect(initial.perf.triangles).toBeLessThanOrEqual(tier==='high'?1_500_000:500_000);if(tier==='high')expect(proof.p95).toBeLessThanOrEqual(14);else expect(proof.p50).toBeLessThanOrEqual(1000/30);expect(proof.max).toBeLessThanOrEqual(tier==='high'?50:80);
  });
});
for(const tier of ['high','low'] as const)test.describe(`transitions ${tier}`,()=>{
if(tier==='low')test.use({viewport:{width:390,height:844},deviceScaleFactor:devices['Pixel 7'].deviceScaleFactor,userAgent:devices['Pixel 7'].userAgent,isMobile:true,hasTouch:true});
test(`T-E24-19-transitions @E24 @E24-AC19 @perf breach2 and abandon switch without a 50ms frame ${tier}`,async({page,context})=>{
  test.setTimeout(600_000);mkdirSync(dir,{recursive:true});if(tier==='low'){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  await page.goto(`/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=${tier==='high'?1:1.5}`);await page.waitForFunction(()=>!!window.__SS__);
  const proof=await page.evaluate(async()=>{const a=window.__SS__!;await a.ready;await a.loadLevel('L6',{seed:1,progression:'L6-default'});a.pause();a.missions.begin();a.cheats.god(true);const rows=[];for(const beat of ['breach2','abandon'] as const){const s=a.missions.state()!.l6!,target=beat==='breach2'?s.breach2At:s.breach2At+900;await a.step(Math.max(0,target-a.getState().tick-3));await a.screenshotReady();const frames:number[]=[];let previous=0;a.resume();while(a.getState().tick<target+30){const now=await new Promise<number>(resolve=>requestAnimationFrame(resolve));if(previous)frames.push(now-previous);previous=now;}a.pause();rows.push({beat,max:Math.max(...frames),frames,state:a.missions.state()!.l6!});}return rows;});writeFileSync(`${dir}/transitions-${tier}.json`,JSON.stringify(proof,null,2));for(const row of proof){expect(row.max).toBeLessThanOrEqual(50);expect(row.state.emergency).toBe(true);if(row.beat==='abandon')expect(row.state.abandonAt).toBeGreaterThan(0);}
});

});
