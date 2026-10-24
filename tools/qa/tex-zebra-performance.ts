/** Native, uncapped, quiet-run A/B in the actual L8 zoo. One browser at a time. */
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
const out='docs/reports/tex-zebra'; mkdirSync(out,{recursive:true});
const baseline=process.env.ZEBRA_BASELINE??'/Users/wesner/Workspace/tex-zebra-baseline';
const old=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4511','--strictPort','--configLoader','runner'],{cwd:baseline,stdio:'ignore'});
const rows: unknown[]=[];
try {
 for(let i=0;i<120;i++){try{if((await fetch('http://127.0.0.1:4511')).ok)break;}catch{/* boot */}await new Promise(r=>setTimeout(r,500));}
 for(const version of ['main','replacement','replacement','main']){
  const session=new SceneSession({backend:'webgl2',tier:'low',nativeFrameTiming:true,viewport:{width:1280,height:800}});
  try {
   await session.open();const url=session.page.url();
   if(version==='main'){await session.page.goto(url.replace(':4512',':4511'));await session.page.waitForFunction(()=>!!window.__SS__,null,{timeout:120000});await session.page.evaluate(async()=>{await window.__SS__!.ready;});}
   await session.page.evaluate(async()=>{
    const a=window.__SS__!;await a.loadScenario('L8',{seed:7});a.pause();a.cheats.god(true);
    const anchor=a.inspect.anchors().find(p=>p.id.includes('animal-zebra'));if(!anchor)throw new Error('No L8 zebra anchor');
    a.teleport('player',{x:anchor.position[0]+3,z:anchor.position[2]+3});a.camera.follow();a.camera.zoom(1.5);await a.step(120);await a.screenshotReady();
   });
   const proof=await session.page.evaluate(async()=>{
    const a=window.__SS__!,gl=document.querySelector('canvas')!.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');const gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null;
    const before=a.getState().render.crowd;if(!before?.batches.some(b=>b.id.includes('zebra')&&b.instances>0))throw new Error('No drawn L8 zebra');
    a.resume();const frames:number[]=[],sim:number[]=[],draws:number[]=[],triangles:number[]=[];let previous=0;const start=performance.now(),tick=a.tick();
    for(let i=0;i<840||performance.now()-start<16000;i++){const now=await new Promise<number>(requestAnimationFrame);if(i>=180&&previous){frames.push(now-previous);const p=a.perf();sim.push(p.simMs);draws.push(p.drawCalls);triangles.push(p.triangles);}previous=now;}
    const quantile=(v:number[],q:number)=>v.sort((a,b)=>a-b)[Math.ceil(v.length*q)-1];const crowd=a.getState().render.crowd,perf=a.perf();a.pause();
    return {backend:perf.backend,gpu,samples:frames.length,durationMs:performance.now()-start,ticks:a.tick()-tick,frameMsP95:quantile(frames,.95),frameMsP50:quantile(frames,.5),simMsP95:quantile(sim,.95),drawCallsMax:Math.max(...draws),drawCallsP95:quantile(draws,.95),trianglesMax:Math.max(...triangles),crowd,baselineCrowd:before,headless:true,uncapped:true,quality:'low',recordedAt:new Date().toISOString()};
   });
   rows.push({version,revision:execFileSync('git',['-C',version==='main'?baseline:process.cwd(),'rev-parse','HEAD'],{encoding:'utf8'}).trim(),...proof,errors:[...session.errors]});
   writeFileSync(`${out}/performance.json`,JSON.stringify(rows,null,2)+'\n');console.log(version,proof.frameMsP95,proof.drawCallsMax,proof.trianglesMax);
   if(session.errors.length)throw new Error(session.errors.join('\n'));
  }finally{await session.close();}
 }
 const data=rows as {version:string;frameMsP95:number;drawCallsMax:number}[];
 const mean=(key:'frameMsP95'|'drawCallsMax',version:string)=>data.filter(r=>r.version===version).reduce((sum,r)=>sum+r[key],0)/2;
 const delta=mean('frameMsP95','replacement')-mean('frameMsP95','main'),drawDelta=mean('drawCallsMax','replacement')-mean('drawCallsMax','main');
 writeFileSync(`${out}/performance-verdict.json`,JSON.stringify({deltaMs:delta,drawDelta,pass:delta<=.5&&drawDelta<=0},null,2)+'\n');
 if(delta>.5||drawDelta>0)throw new Error(`Zoo budget failed: p95 +${delta}ms, draws +${drawDelta}`);
}finally{old.kill();stopServer();}
