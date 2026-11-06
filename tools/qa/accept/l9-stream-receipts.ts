import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import type {FixtureReceipt} from './fixtures';
import {atomicJson,reportRoot} from './report';
type Hashed={file:string;sha256:string};
type Terrain={resident:number;loading:number;limit:number;unloaded:number;chunks:string[]};
type Proof={sourceHash:string;browserHash:string;toolSha256:string;rows:{tier:string;mode:string;setup:{backend:string;quality:string};commands:{tick:number;keys:string[]}[];samples:{tick:number;phase:string;terrain:{terrain:Terrain};simChunks:{resident:number};active:number;storyLock:{scripted:object|null}|null}[];result:{phase:string;inputs:{tick:number;drive:{throttle:number;steer:number}}[];events:{tick:number;name?:string}[]};errors:string[]}[]};
type Seams={sourceHash:string;observerHash:string;toolSha256:string;layout:Hashed;assets:Hashed[];piecewiseAffine:boolean;rows:{a:string;b:string;samples:number;maxMismatch:number;missing:number}[]};
export function l9StreamReceipts(sourceHash:string,observerHash:string,browserHash:string):{path:string;receipt:FixtureReceipt}[]{
 const root='docs/reports/sweep-c5/L9-09',sp=`${root}/seams.json`,sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex'),results=[];
 if(!existsSync(sp))return[];const seams=JSON.parse(readFileSync(sp,'utf8')) as Seams;
 if(seams.sourceHash!==sourceHash||seams.observerHash!==observerHash||seams.toolSha256!==sha(readFileSync('tools/qa/accept/sweep-c5-l9-seams.ts')))return[];
 const assets=seams.assets.length===97&&[seams.layout,...seams.assets].every(a=>existsSync(a.file)&&sha(readFileSync(a.file))===a.sha256),uniquePairs=new Set(seams.rows.map(r=>`${r.a}/${r.b}`)),seamPass=assets&&seams.piecewiseAffine&&seams.rows.length===172&&uniquePairs.size===172&&seams.rows.every(r=>r.samples>0&&r.missing===0&&Number.isFinite(r.maxMismatch)&&r.maxMismatch<=.02);
 for(const tier of ['low','high'] as const){const checks:FixtureReceipt['checks']=[];
  checks.push({id:'L9-09',clause:'actual terrain GLB shared-edge heights',tier,policy:'streaming-physical',status:seamPass?'PASS':'FAIL',value:{assets,sharedEdges:seams.rows.length,samples:seams.rows.reduce((n,r)=>n+r.samples,0),maxMismatch:Math.max(...seams.rows.map(r=>r.maxMismatch)),missing:seams.rows.reduce((n,r)=>n+r.missing,0)},target:'all172adjacent100m terrain boundaries, actual96GLBs transformed to world space; exhaustive affine segment partitions using production GroundField; ≤0.02m gap, no missing detail supports. Auxiliary horizon includes permanent structural faces, not paired terrain cells.',receipt:sp});
  for(const mode of ['road','countryside','dry-shortcut']){
   const path=`${root}/${tier}-${mode}-physical.json.gz`;if(!existsSync(path))continue;const a=JSON.parse(gunzipSync(readFileSync(path)).toString()) as Proof;
   if(a.sourceHash!==sourceHash||a.browserHash!==browserHash||a.toolSha256!==sha(readFileSync('tools/qa/accept/sweep-c5-l9-stream.mjs')))continue;
   const r=a.rows[0];if(!r)continue;const limit=tier==='low'?9:25,end=r.result.events.find(e=>e.name==='l9.crash-approach')?.tick,frames=r.result.inputs.filter(f=>end!==undefined&&f.tick<end);
   let j=0;const input=end!==undefined&&frames.length===end&&frames.every((f,i)=>{while(j+1<r.commands.length&&r.commands[j+1].tick<=f.tick)j++;const keys=r.commands[j]?.keys??[];return f.tick===i&&keys.length>0&&f.drive.throttle===Number(keys.includes('KeyW'))-Number(keys.includes('KeyS'))&&f.drive.steer===Number(keys.includes('KeyD'))-Number(keys.includes('KeyA'));});
   const detailed=r.samples.every(s=>s.terrain.terrain.resident===s.terrain.terrain.chunks.length&&s.terrain.terrain.resident+s.terrain.terrain.loading<=limit&&s.terrain.terrain.limit===limit&&s.simChunks.resident<=limit),changes=new Set(r.samples.map(s=>[...s.terrain.terrain.chunks].sort().join(','))).size,unloaded=r.samples.at(-1)?.terrain.terrain.unloaded??0;
   const complete=r.tier===tier&&r.mode===mode&&!r.errors.length&&r.setup.backend==='webgl'&&r.setup.quality===tier&&r.result.phase==='approach'&&r.samples.length>400&&r.samples.every((s,i)=>s.tick===i*12)&&r.samples.slice(0,-1).every(s=>s.phase==='driving'&&s.active>0&&!s.storyLock?.scripted)&&changes>=5&&unloaded>0;
   checks.push({id:'L9-09',clause:`${mode} physical streaming residency and continuous input`,tier,policy:'streaming-physical',status:complete&&detailed&&input?'PASS':'FAIL',value:{complete,detailed,input,streamingSets:changes,unloaded,inputTicks:frames.length,peakDetailed:Math.max(...r.samples.map(s=>s.terrain.terrain.resident)),peakSim:Math.max(...r.samples.map(s=>s.simChunks.resident)),errors:r.errors},target:'actual WASD authored route to bridge, ≤25/9 resident+loading detail slots, input accepted every simulation tick matching held keys across actual streaming changes, no scripted driving lock. No frame/performance claim.',receipt:path});
  }
  const path=`${reportRoot}/receipts/L9-${tier}-streaming-browser.json`,receipt:FixtureReceipt={version:1,level:'L9',tier,sourceHash,fixtureHash:sha(readFileSync(new URL(import.meta.url))),errors:[],observations:{root},checks};atomicJson(path,receipt);results.push({path,receipt});
 }
 return results;
}
