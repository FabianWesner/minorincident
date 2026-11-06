import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {l9StreamReceipts} from './l9-stream-receipts.ts';
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
const identity=provenance(),hash=browserHash(),root='docs/reports/sweep-c5/L9-09',ip=`${root}/high-road-physical.json.gz`,sp=`${root}/seams.json`,original=readFileSync(ip),originalSeams=readFileSync(sp),sha=b=>createHash('sha256').update(b).digest('hex');
const run=()=>l9StreamReceipts(identity.sourceHash,identity.observerHash,hash).flatMap(r=>r.receipt.checks),cases=[];
assert.equal(run().length,8);assert(run().every(c=>c.status==='PASS'),'baseline');
for(const fault of ['stale-source','wrong-browser','wrong-producer','missing-route','unfinished','lost-input-tick','wrong-throttle','wrong-steer','missing-command','renderer-over-budget','pending-over-budget','sim-over-budget','no-streaming','scripted-lock','wrong-quality','page-error','seam-too-high','missing-support','missing-edge','stale-assets','wrong-seam-producer']){
 try{
  const a=JSON.parse(gunzipSync(original)),r=a.rows[0],s=JSON.parse(originalSeams);
  if(fault==='stale-source')a.sourceHash='0'.repeat(64);
  if(fault==='wrong-browser')a.browserHash='0'.repeat(64);
  if(fault==='wrong-producer')a.toolSha256='0'.repeat(64);
  if(fault==='missing-route')a.rows=[];
  if(fault==='unfinished')r.result.phase='driving';
  if(fault==='lost-input-tick')r.result.inputs.splice(100,1);
  if(fault==='wrong-throttle')r.result.inputs[100].drive.throttle=0;
  if(fault==='wrong-steer')r.result.inputs[100].drive.steer=1;
  if(fault==='missing-command')r.commands=[];
  if(fault==='renderer-over-budget')r.samples[100].terrain.terrain.resident=26;
  if(fault==='pending-over-budget')r.samples[100].terrain.terrain.loading=26;
  if(fault==='sim-over-budget')r.samples[100].simChunks.resident=26;
  if(fault==='no-streaming')for(const f of r.samples)f.terrain.terrain.chunks=[...r.samples[0].terrain.terrain.chunks];
  if(fault==='scripted-lock')r.samples[100].storyLock={scripted:{id:'control'}};
  if(fault==='wrong-quality')r.setup.quality='low';
  if(fault==='page-error')r.errors.push('control');
  if(fault==='seam-too-high')s.rows[0].maxMismatch=.02001;
  if(fault==='missing-support')s.rows[0].missing=1;
  if(fault==='missing-edge')s.rows.pop();
  if(fault==='stale-assets')s.assets[0].sha256='0'.repeat(64);
  if(fault==='wrong-seam-producer')s.toolSha256='0'.repeat(64);
  writeFileSync(ip,gzipSync(JSON.stringify(a),{mtime:0}));writeFileSync(sp,JSON.stringify(s));const c=run(),rejected=c.length!==8||c.some(c=>c.status!=='PASS');assert(rejected,fault);cases.push({fault,rejected});
 }finally{writeFileSync(ip,original);writeFileSync(sp,originalSeams);}
}
assert.equal(run().length,8);assert(run().every(c=>c.status==='PASS'),'restored');
copyFileSync('tools/qa/accept/sweep-c5-l9-stream.mjs',`${root}/physical-producer.mjs`);copyFileSync('tools/qa/accept/sweep-c5-l9-seams.ts',`${root}/seam-producer.ts`);
writeFileSync(`${root}/coverage-proof.json`,JSON.stringify({...identity,browserHash:hash,method:'Actual unchanged consumer; mutate semantic data/asset digests, restore every original byte. No target changes.',inputs:[ip,sp].map(file=>({file,sha256:sha(readFileSync(file))})),cases},null,2)+'\n');
