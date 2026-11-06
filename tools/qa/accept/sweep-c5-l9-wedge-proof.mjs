import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {l9WedgeReceipts} from './l9-wedge-receipts.ts';
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
const identity=provenance(),hash=browserHash(),root='docs/reports/sweep-c5/L9-06',ip=`${root}/high-physical.json.gz`,rp=`${root}/high-review.json`,original=readFileSync(ip),originalReview=readFileSync(rp),sha=b=>createHash('sha256').update(b).digest('hex');
const run=()=>l9WedgeReceipts(identity.sourceHash,identity.observerHash,hash).flatMap(r=>r.receipt.checks),cases=[];
assert.equal(run().length,6);assert(run().every(c=>c.status==='PASS'),'baseline');
for(const fault of ['stale-source','wrong-browser','wrong-producer','missing-target','not-stalled','no-press','not-escaped','too-short','forwards','no-reverse-input','wrong-hud','missing-zoom','unseen','wrong-quality','console-error']){
 try{const a=JSON.parse(gunzipSync(original)),r=a.rows[0],c=r.challenges[0],v=JSON.parse(originalReview);
  if(fault==='stale-source')a.sourceHash='0'.repeat(64);
  if(fault==='wrong-browser')a.browserHash='0'.repeat(64);
  if(fault==='wrong-producer')a.toolSha256='0'.repeat(64);
  if(fault==='missing-target')r.challenges.pop();
  if(fault==='not-stalled')for(const s of r.samples)s.speed=1;
  if(fault==='no-press')r.samples=r.samples.filter(s=>s.stage!=='press-contact');
  if(fault==='not-escaped')c.escaped=false;
  if(fault==='too-short')c.escape.position={...c.contact.position};
  if(fault==='forwards'){c.escape.position.x=c.contact.position.x+10*Math.cos(c.contact.position.yaw);c.escape.position.z=c.contact.position.z-10*Math.sin(c.contact.position.yaw);}
  if(fault==='no-reverse-input')r.commands=[];
  if(fault==='wrong-hud')r.captures[0].state.hud='Armor 0 / 1000';
  if(fault==='missing-zoom')r.captures.pop();
  if(fault==='unseen')v.captures.forEach(c=>c.seen='');
  if(fault==='wrong-quality')r.setup.quality='low';
  if(fault==='console-error')r.errors.push('control');
  const raw=Buffer.from(JSON.stringify(a));v.inputSha256=sha(raw);writeFileSync(ip,gzipSync(raw,{mtime:0}));writeFileSync(rp,JSON.stringify(v));const checks=run(),rejected=checks.length!==6||checks.some(c=>c.status!=='PASS');assert(rejected,fault);cases.push({fault,rejected});
 }finally{writeFileSync(ip,original);writeFileSync(rp,originalReview);}
}
assert.equal(run().length,6);assert(run().every(c=>c.status==='PASS'),'restored');writeFileSync(`${root}/coverage-proof.json`,JSON.stringify({...identity,browserHash:hash,method:'Actual consumer semantic faults; rehashed input/review linkage, exact original bytes restored.',cases},null,2)+'\n');
