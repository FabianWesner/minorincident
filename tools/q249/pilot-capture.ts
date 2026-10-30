import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, stopServer, origin, readSpec } from '../scenelab/session';
import type { CameraSpec } from '../../src/debug/scenelab/spec';
const [phase='after', reportRoot='docs/reports/q249/pilot-2'] = process.argv.slice(2);
const output=resolve(reportRoot), session=new SceneSession({tier:'high',viewport:{width:1200,height:900},query:{skin:'1'},log:()=>{}});
mkdirSync(output, {recursive:true});
try {
 await session.open();
 if(phase==='after') {
  await session.page.goto(`${origin}/tools/q249/pilot-studio.html?report=pilot-2`);
  await session.page.waitForFunction(()=>!!(window as unknown as {__PILOT__?:unknown}).__PILOT__);
  for(const state of ['before','after']) for(const view of ['front','three-quarter','side']) {
   const details=await session.page.evaluate(async ({state,view}) => {
    const studio=(window as unknown as {__PILOT__:{show:(p:string,v:string)=>Promise<unknown>}}).__PILOT__;
    return studio.show(state,view);
   },{state,view});
   await session.page.screenshot({path:resolve(output,`studio-${state}-${view}.png`)});
   console.log(details);
  }
 }
 const spec=readSpec(resolve(output,'scene.json'));
 await session.load(spec);await session.step(120);await session.ready();
 const cameras:Record<string,CameraSpec>={zoom15:{mode:'game',target:[2,.7,2],zoom:1.5},close3m:{mode:'close',target:[2,1.25,2],radius:3,azimuth:45}};
 const capture=async (pose:string)=>{
  for(const [view,camera] of Object.entries(cameras)){
   await session.page.evaluate(camera=>window.__SCENE__!.setCamera(camera),camera);await session.ready();
   await session.screenshot(resolve(output,`game-${phase}-${view}-${pose}.png`));
  }
 };
 await capture('idle');
 await session.page.evaluate(()=>window.__SCENE__!.command('pilot',{walk:[[3.3,2.7]]}));
 await session.step(12);await capture('walk12');
 await session.step(12);await capture('walk24');
 const metrics=await session.metrics();writeFileSync(resolve(output,`game-${phase}-metrics.json`),JSON.stringify({metrics,consoleErrors:session.errors},null,2)+'\n');
 console.log(`${phase}: high tier, zoom 1.5 + 3 m, idle + 2 walk frames; ${session.errors.length} console errors`);
} finally {await session.close();stopServer();}
