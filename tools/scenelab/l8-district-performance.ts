/** Locked native-GPU district budget probe; L8 encounters add the full outbreak fixture later. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from './session';
import type { ActorSpec, SceneSpec } from '../../src/debug/scenelab/spec';
const output = 'test-results/epics/E30/l8-district';
mkdirSync(output, { recursive: true });
const results: unknown[] = [];
try {
  for (const tier of ['high','low'] as const) {
    const cap = tier === 'high' ? 200 : 100;
    const actors: ActorSpec[] = [{ id:'courier',kind:'courier',at:[60,0],yaw:180,state:'idle' }];
    // Z-S3 owns the zebra brain; measure its shipped rig through the same lion alias as Z-D2.
    for (let i=0;i<cap;i++) actors.push({ id:`threat-${i}`,kind:'infected',archetype:i<3?'infected.alpha':i<8?['infected.lion','infected.gorilla','infected.elephant','infected.lion','infected.flamingo'][i-3]:'infected.runner',look:i===6?{model:'inf.zebra'}:undefined,at:[38+(i%20)*1.1,-3-Math.floor(i/20)*.7],yaw:0,state:'idle' });
    for (let i=0;i<30;i++) actors.push({ id:`crowd-${i}`,kind:'pedestrian',at:[40+i*.9,2],yaw:90,look:{model:i<6?'npc.national-guard':'npc.civilian-man-a',tint:i>=26?'#5a9871':undefined},state:'idle' });
    const spec: SceneSpec = {name:`l8-district-perf-${tier}`,seed:30,ground:'district',time:'L8-zoo',infectedCap:200,layout:{district:'D-ZOO',bbox:[[-120,-90],[120,90]]},actors,camera:{mode:'game',target:[60,0,0],zoom:3},dof:false};
    const session = new SceneSession({tier,nativeFrameTiming:true});
    try {
      await session.open(); await session.load(spec); await session.step(120); await session.ready();
      const cdp = await session.page.context().newCDPSession(session.page);
      await cdp.send('HeapProfiler.collectGarbage');
      const proof = await session.page.evaluate(async () => {
        const api = window.__SS__!, frames: number[] = [], sims: number[] = [];
        let previous = 0, draws = 0, triangles = 0, lights = 0, props = 0;
        const gl = document.querySelector('canvas')!.getContext('webgl2')!, extension = gl.getExtension('WEBGL_debug_renderer_info');
        const gpu = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) as string : null;
        api.resume(); const start = performance.now(), tick = api.tick(), rendered = api.perf().renderedFrames;
        while (performance.now()-start < 10000) {
          const now = await new Promise<number>(requestAnimationFrame), p = api.perf();
          if (previous && performance.now()-start > 2000) { frames.push(now-previous); sims.push(p.simMs); }
          previous = now; draws = Math.max(draws,p.drawCalls); triangles = Math.max(triangles,p.triangles);
          lights = Math.max(lights,p.lighting?.heroLights ?? 0); props = Math.max(props,p.awakeProps);
        }
        // Remove binary subtraction residue below a microsecond; budgets stay exact.
        api.pause(); frames.sort((a,b)=>a-b); sims.sort((a,b)=>a-b);
        return { gpu,headless:true,unthrottled:true,ticks:api.tick()-tick,renderedFrames:api.perf().renderedFrames-rendered,samples:frames.length, frameP95:Number(frames[Math.ceil(frames.length*.95)-1].toFixed(6)), simP95:Number(sims[Math.ceil(sims.length*.95)-1].toFixed(6)), draws, triangles, lights, props, count:api.getState().ai!.count };
      });
      await cdp.send('HeapProfiler.collectGarbage');
      const heap = await cdp.send('Runtime.getHeapUsage');
      const result = {tier,...proof,heapMB:heap.usedSize/1048576,consoleErrors:session.errors};
      results.push(result); writeFileSync(`${output}/performance.json`,JSON.stringify(results,null,2)+'\n');
      console.log(JSON.stringify(result));
      const max = tier === 'high' ? {draws:600,triangles:1500000,simP95:4,frameP95:16.7,heapMB:400,lights:8,props:150} : {draws:300,triangles:500000,simP95:6,frameP95:33.3,heapMB:250,lights:3,props:60};
      for (const key of Object.keys(max) as (keyof typeof max)[]) if (result[key] > max[key]) throw new Error(`${tier} ${key}: ${result[key]} > ${max[key]}`);
      if (result.count !== cap || session.errors.length) throw new Error(`${tier}: crowd cap/console error`);
      if (!result.gpu || /swiftshader|llvmpipe|software/i.test(result.gpu) || result.ticks < 300 || result.renderedFrames < 600) throw new Error(`${tier}: native GPU/active simulation window`);
    } finally { await session.close(); }
  }
} finally { stopServer(); }
