import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {l9ArrivalReceipts} from './l9-arrival-receipts.ts';
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
const identity=provenance(),hash=browserHash(),root='docs/reports/sweep-c5/L9-01',ip=`${root}/high-arrival.json.gz`,rp=`${root}/high-review.json`,original=readFileSync(ip),originalReview=readFileSync(rp),sha=b=>createHash('sha256').update(b).digest('hex');
const run=()=>l9ArrivalReceipts(identity.sourceHash,hash).flatMap(r=>r.receipt.checks),cases=[];
assert.equal(run().length,2);assert(run().every(c=>c.status==='PASS'),'baseline');
for(const fault of ['stale-source','wrong-browser','wrong-producer','late-motion','no-throttle','lost-roster','repaired-hp','wrong-apc-id','visible-dog','dog-render-copy','unseated-driver','missing-zoom','unseen','wrong-quality','console-error','loading-overlay']){
 try{
  const a=JSON.parse(gunzipSync(original)),v=JSON.parse(originalReview);
  if(fault==='stale-source')a.sourceHash='0'.repeat(64);
  if(fault==='wrong-browser')a.browserHash='0'.repeat(64);
  if(fault==='wrong-producer')a.toolSha256='0'.repeat(64);
  if(fault==='late-motion')for(const s of a.samples.filter(s=>s.tick<=30))s.car.transform={...a.samples[0].car.transform};
  if(fault==='no-throttle')for(const s of a.samples)s.inputs=[];
  if(fault==='lost-roster')a.samples[0].roster.pop();
  if(fault==='repaired-hp')a.result.car.health.current=1000;
  if(fault==='wrong-apc-id')a.result.car.id=999999;
  if(fault==='visible-dog')a.samples.at(-1).companions[0].hidden=false;
  if(fault==='dog-render-copy')a.samples.at(-1).view[0].occupants.push({actorId:a.samples.at(-1).companions[0].id,seated:true});
  if(fault==='unseated-driver')a.captures.at(-1).state.view[0].occupants.find(o=>o.actorId===1).seated=false;
  if(fault==='missing-zoom')a.captures.pop();
  if(fault==='unseen')v.captures.forEach(c=>c.seen='');
  if(fault==='wrong-quality')a.result.quality='low';
  if(fault==='console-error')a.errors.push('control');
  if(fault==='loading-overlay')a.result.loading=true;
  const raw=Buffer.from(JSON.stringify(a));v.inputSha256=sha(raw);writeFileSync(ip,gzipSync(raw,{mtime:0}));writeFileSync(rp,JSON.stringify(v));
  const c=run(),rejected=c.length!==2||c.some(c=>c.status!=='PASS');assert(rejected,fault);cases.push({fault,rejected});
 }finally{writeFileSync(ip,original);writeFileSync(rp,originalReview);}
}
assert.equal(run().length,2);assert(run().every(c=>c.status==='PASS'),'restored');writeFileSync(`${root}/coverage-proof.json`,JSON.stringify({...identity,browserHash:hash,method:'Actual consumer, each mutated input/review rehashed; all original bytes restored.',cases},null,2)+'\n');
