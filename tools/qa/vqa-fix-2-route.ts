/** Physical input qualification, using the same observer as fix56-c plus the unassisted L9 drive.
 * runSession uses launchProfile through the shared browser pool. */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { createServer } from 'node:net';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { createHash } from 'node:crypto';
import { preset, type ProgressionPreset } from '../../src/sim/progression/Campaign';
import { SAVE_KEY } from '../../src/sim/progression/Save';
import { runSession, type SessionOptions } from '../playtest/session';
import { provenance } from './accept/probe';
const [level,tier,route='direct',label='after']=process.argv.slice(2);
assert(['L9','L10'].includes(level)&&['low','high'].includes(tier));
const out=resolve(`test-results/vqa-fix-2/${level}-${tier}-${route}-${label}`),profile=join(out,'profile');mkdirSync(profile,{recursive:true});
const socket=createServer();await new Promise<void>(done=>socket.listen(0,'127.0.0.1',done));const address=socket.address();assert(address&&typeof address!=='string'&&address.port!==3300);const port=address.port;await new Promise<void>(done=>socket.close(()=>done()));
const origin=`http://127.0.0.1:${port}`;
const save=level==='L10'?JSON.parse(gunzipSync(execFileSync('git', ['show', `40f3d1de9:docs/reports/fix51-r10c/L10-${tier}-second-resume.json.gz`])).toString()):preset('L9-default' as ProgressionPreset);save.settings.quality=tier;
writeFileSync(join(profile,'pool-storage.json'),JSON.stringify({cookies:[],origins:[{origin,localStorage:[{name:SAVE_KEY,value:JSON.stringify(save)}]}]}));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{stdio:'ignore'});
const identity=provenance(),sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
let result:Awaited<ReturnType<typeof runSession>>|null=null,error:string|null=null;
try{
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{/* startup */}await new Promise(done=>setTimeout(done,100));}
 Object.assign(process.env,{PLAYTEST_BACKEND:'webgl2',PLAYTEST_GOD:'1',PLAYTEST_NO_FRAME_TIMING:'1',PLAYTEST_FRAME_GATE:'0',PLAYTEST_CPU_PROFILE:'0',PLAYTEST_THREAT_CAPTURES:'1',PLAYTEST_ACCEPTANCE_LEDGER:'1'});
 result=await runSession({origin,out,levels:[level],quality:tier as 'low'|'high',zoom:1.5,heroine:save.character,entry:'continue',profile,levelMinutes:8,sampleSeconds:level==='L10'?300:480,stopAfterLevel:true,tag:'physical',noSkip:true,l9Route:route==='direct'?undefined:route as SessionOptions['l9Route']});
}catch(caught){error=String(caught);}finally{server.kill('SIGTERM');}
const log=join(out,'log-physical.jsonl');
const entries=existsSync(log)?readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line)):[];
const observations=entries.flatMap(e=>e.observation?[e.observation]:[]),driving=observations.filter(e=>e.driving),positive=driving.filter(e=>e.enemies.some((b:{drawn:boolean})=>b.drawn));
const maximumSamplingSeconds=driving.length>1?Math.max(...driving.slice(1).map((e,i)=>(e.tick-driving[i].tick)/60)):null;
const ticks=[0,...positive.map(e=>e.tick),driving.at(-1)?.tick??0];
const largestGapSeconds=ticks.length>1?Math.max(...ticks.slice(1).map((tick,i)=>(tick-ticks[i])/60)):null;
const completed=!!result?.runs.length&&result.runs.every(r=>r.finished&&!r.skipped.length);
const receipt={...identity,level,tier,route,label,out,method:'Headless shared ANGLE Metal WebGL2; physical WASD/mouse. Direct L9 follows the visible objective without route assistance; prescribed routes use fix56-c map steering. L10 uses the exact saved physical research-to-complex route with the same persistent Mega. Courier protected; no skips, actor relocation, or performance timing.',result,error,logSha256:existsSync(log)?sha(log):null,visibility:{driving:driving.length,positive:positive.length,maximumSamplingSeconds,largestGapSeconds,conservativeGapSeconds:largestGapSeconds!==null&&maximumSamplingSeconds!==null?largestGapSeconds+maximumSamplingSeconds:null},completed};
writeFileSync(join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
process.exitCode=error?1:0;
