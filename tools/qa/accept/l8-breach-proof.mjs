import assert from 'node:assert/strict';
import{createHash}from'node:crypto';
import{readFileSync,writeFileSync}from'node:fs';
import{gzipSync,gunzipSync}from'node:zlib';
import{l8BreachReceipts}from'./l8-breach-receipts.ts';
import{provenance}from'./probe.ts';
import{browserHash}from'./browser.ts';
const root='docs/reports/sweep-c5/L8-04',identity=provenance(),hash=browserHash(),sha=b=>createHash('sha256').update(b).digest('hex'),run=()=>l8BreachReceipts(identity.sourceHash,hash).flatMap(r=>r.receipt.checks);
assert(run().length===8&&run().every(c=>c.status==='PASS'));const cases=[];
for(const fault of ['stale-source','missing-high','wrong-tier','wrong-quality','console-error','unfinished','missing-input','not-at-door','late-breach','missing-packet','close-outlets','born-on-apron','admitted-on-apron','jump','late-door','sparse-observer','unseen-image']){
 const tier=fault==='missing-high'?'high':'low',ip=`${root}/${tier}-0-physical.json.gz`,rp=`${root}/${tier}-0-review.json`,ib=readFileSync(ip),rb=readFileSync(rp);
 try{
  const proof=JSON.parse(gunzipSync(ib)),review=JSON.parse(rb),r=proof.rows[0],start=r.samples.find(s=>s.tick===3600),own=start.tunnelActors.find(e=>e.outlet===0),o=r.outlet;
  if(fault==='stale-source')proof.sourceHash='0'.repeat(64);
  if(fault==='missing-high')proof.rows=[];
  if(fault==='wrong-tier')r.tier='high';
  if(fault==='wrong-quality')r.setup.quality='high';
  if(fault==='console-error')r.errors.push('control');
  if(fault==='unfinished')r.completed=false;
  if(fault==='missing-input')r.commands=[];
  if(fault==='not-at-door')r.samples.find(s=>s.tick===3540).position={x:0,z:0};
  if(fault==='late-breach')start.breached=false;
  if(fault==='missing-packet')start.arrivals.pop();
  if(fault==='close-outlets')r.setup.outlets[1]={...r.setup.outlets[0]};
  if(fault==='born-on-apron'||fault==='admitted-on-apron'){
   const entry=fault==='born-on-apron'?own:r.samples.flatMap(s=>s.tunnelActors).find(e=>e.outlet===0&&!e.hidden&&!e.pending&&e.id!==own.id);
   assert(entry);entry.position={x:o.x+o.nx*2,z:o.z+o.nz*2};
  }
  if(fault==='jump'){const sample=r.samples.find(s=>s.tick===3630);sample.tunnelActors.find(e=>e.id===own.id).position.x+=5;}
  if(fault==='late-door')start.doors.find(([id])=>id===`door-${o.house}`)[1].at=3601;
  if(fault==='sparse-observer')r.samples.splice(610,1);
  if(fault==='unseen-image')review.captures[0].seen='';
  const raw=Buffer.from(JSON.stringify(proof));review.inputSha256=sha(raw);writeFileSync(ip,gzipSync(raw,{mtime:0}));writeFileSync(rp,JSON.stringify(review));
  const checks=run(),rejected=checks.length!==8||checks.some(c=>c.status!=='PASS');assert(rejected,fault);cases.push({fault,rejected});
 }finally{writeFileSync(ip,ib);writeFileSync(rp,rb);}
}
assert(run().length===8&&run().every(c=>c.status==='PASS'));writeFileSync(`${root}/coverage-proof.json`,JSON.stringify({...identity,method:'Actual consumer; temporary semantic evidence faults paired with recomputed raw input SHA, exact original input/review bytes restored. The O-review handles visible pixels; submission is not treated as absence of depth occlusion.',cases},null,2)+'\n');
