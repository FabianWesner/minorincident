import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {l8AnimalReceipts} from './l8-animal-receipts.ts';
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
const identity=provenance(),hash=browserHash(),root='docs/reports/sweep-c5/L8-08',ip=`${root}/animals-high-zebra.json.gz`,rp=`${root}/animals-high-zebra-review.json`,original=readFileSync(ip),originalReview=readFileSync(rp),sha=b=>createHash('sha256').update(b).digest('hex');
const run=()=>l8AnimalReceipts(identity.sourceHash,hash).flatMap(r=>r.receipt.checks),cases=[];
assert.equal(run().length,14);assert(run().every(c=>c.status==='PASS'),'baseline');
for(const fault of ['stale-source','wrong-browser','wrong-producer','no-row','no-input','wrong-quality','console-error','not-converted','unrelated-animal','missing-zoom','missing-pose','not-drawn','unseen','no-cleanup','changed-review-source']){
 try{
  const a=JSON.parse(gunzipSync(original)),r=a.rows[0],v=JSON.parse(originalReview);
  if(fault==='stale-source')a.sourceHash='0'.repeat(64);
  if(fault==='wrong-browser')a.browserHash='0'.repeat(64);
  if(fault==='wrong-producer')a.toolSha256='0'.repeat(64);
  if(fault==='no-row')a.rows=[];
  if(fault==='no-input')r.commands=[];
  if(fault==='wrong-quality')r.setup.quality='low';
  if(fault==='console-error')r.errors.push('control');
  if(fault==='not-converted')r.settled=false;
  if(fault==='unrelated-animal')r.captures.at(-1).state.target.id=999999;
  if(fault==='missing-zoom')r.captures=r.captures.filter(c=>c.zoom!==1.5);
  if(fault==='missing-pose')r.captures=r.captures.filter(c=>c.label!=='move30');
  if(fault==='not-drawn')r.captures.at(-1).state.figure.drawn=false;
  if(fault==='unseen')v.captures.forEach(c=>c.seen='');
  if(fault==='no-cleanup')v.rawCleanup.allPersonallyReviewed=false;
  if(fault==='changed-review-source')v.sourceHash='0'.repeat(64);
  const raw=Buffer.from(JSON.stringify(a));v.inputSha256=sha(raw);writeFileSync(ip,gzipSync(raw,{mtime:0}));writeFileSync(rp,JSON.stringify(v));
  const checks=run(),rejected=checks.length!==14||checks.some(c=>c.status!=='PASS');assert(rejected,fault);cases.push({fault,rejected});
 }finally{writeFileSync(ip,original);writeFileSync(rp,originalReview);}
}
assert.equal(run().length,14);assert(run().every(c=>c.status==='PASS'),'restored');
writeFileSync(`${root}/coverage-proof.json`,JSON.stringify({...identity,browserHash:hash,method:'Actual consumer; semantic mutations have rehashed input/review linkage. Every original byte restored. Pixel judgement belongs to exact O-review, not metadata.',cases},null,2)+'\n');
