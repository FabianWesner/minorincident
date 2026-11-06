import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {l8PopulationReceipts} from './l8-population-receipts.ts';
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
const root='docs/reports/sweep-c5/L8-03',rp=`${root}/review.json`,rb=readFileSync(rp),baseline=JSON.parse(rb),identity=provenance(),hash=browserHash(),sha=b=>createHash('sha256').update(b).digest('hex');
const run=()=>l8PopulationReceipts(identity.sourceHash,hash).flatMap(r=>r.receipt.checks);
assert(run().length===6&&run().every(c=>c.status==='PASS'));const cases=[];
for(const fault of ['missing-local','missing-staff','missing-species','long-idle','hostile-local','different-control','outside-crossed','outside-dead','outside-hit','inside-sample','stale-source','missing-high','no-input','breached','render-idle','unseen-frame']){
 const review=structuredClone(baseline),nativeFault=!['missing-high','no-input','breached','render-idle','unseen-frame'].includes(fault),ref=nativeFault?review.native:review.inputs[1],file=ref.file,bytes=readFileSync(file);
 try{
  const candidate=JSON.parse(gunzipSync(bytes));
  if(nativeFault){const natural=candidate.rows.find(r=>r.tier==='high'&&r.mode==='natural'),outside=candidate.rows.find(r=>r.tier==='high'&&r.mode==='outside');
   if(fault==='missing-local')natural.original=natural.original.filter(e=>e.carried||e.archetype!=='npc.cashier');
   if(fault==='missing-staff')natural.original=natural.original.filter(e=>!/^npc\.(zookeeper|vet|groundskeeper)$/.test(e.archetype));
   if(fault==='missing-species')natural.original=natural.original.filter(e=>e.species!=='lion');
   if(fault==='long-idle'){natural.activity[0].maximum=181;natural.activity[0].maximumIdleFacingNowhereSeconds=181/60;}
   if(fault==='hostile-local')natural.activity[0].hostileTicks=1;
   if(fault==='different-control')natural.controlHash='0'.repeat(64);
   if(fault==='outside-crossed')outside.crossed=1;
   if(fault==='outside-dead')outside.dead=1;
   if(fault==='outside-hit')outside.hits.push({type:'combat.hit'});
   if(fault==='inside-sample')outside.samples[0].fixture[0].position={x:0,z:0};
   if(fault==='stale-source')candidate.sourceHash='0'.repeat(64);
  }else{
   const row=candidate.rows[0];
   if(fault==='missing-high')candidate.rows=[];
   if(fault==='no-input')row.commands=[];
   if(fault==='breached')row.samples[0].breached=true;
   if(fault==='render-idle')for(const s of row.samples.slice(0,32))s.figures.push({id:999,clip:'idle',phase:0,drawn:true});
   if(fault==='unseen-frame')review.captures[0].seen='';
  }
  const changed=gzipSync(JSON.stringify(candidate),{mtime:0});writeFileSync(file,changed);ref.sha256=sha(changed);writeFileSync(rp,JSON.stringify(review));
  const checks=run(),rejected=checks.length!==6||checks.some(c=>c.status!=='PASS');assert(rejected,fault);cases.push({fault,rejected});
 }finally{writeFileSync(file,bytes);writeFileSync(rp,rb);}
}
assert(run().length===6&&run().every(c=>c.status==='PASS'));writeFileSync(`${root}/coverage-proof.json`,JSON.stringify({...identity,method:'Actual production consumer, paired artifact SHA updated for semantic negative controls; exact original bytes restored.',cases},null,2)+'\n');
