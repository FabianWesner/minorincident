import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {l7CorridorReceipts} from './l7-corridor-receipts.ts';
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
const p=provenance(),hash=browserHash(),root='docs/reports/sweep-c5/L7-08',ip=`${root}/low-physical.json.gz`,rp=`${root}/low-review.json`,np=`${root}/native-current.json.gz`,original=readFileSync(ip),originalReview=readFileSync(rp),originalNative=readFileSync(np),sha=b=>createHash('sha256').update(b).digest('hex');
const run=()=>l7CorridorReceipts(p.sourceHash,p.observerHash,hash).flatMap(r=>r.receipt.checks),cases=[];assert.equal(run().length,6);assert(run().every(c=>c.status==='PASS'),'baseline');
for(const fault of ['stale-source','wrong-browser','wrong-producer','below-initial-regulars','below-initial-alphas','native-control-diverged','native-driver','input-gap','no-physical-fire','no-rocket-kills','wrong-weapon','distant-blast','dead-human','misses-disc','not-crossed-west','wrong-carried-id','living-body-in-gap','unseen','missing-capture','wrong-quality','console-error']){
 try{const a=JSON.parse(gunzipSync(original)),r=a.result,v=JSON.parse(originalReview),n=JSON.parse(gunzipSync(originalNative));
  if(fault==='stale-source')a.sourceHash='0'.repeat(64);
  if(fault==='wrong-browser')a.browserHash='0'.repeat(64);
  if(fault==='wrong-producer')a.toolSha256='0'.repeat(64);
  if(fault==='below-initial-regulars')a.setup.initial.find(e=>e.archetype==='infected.runner').hp=0;
  if(fault==='below-initial-alphas')a.setup.initial.find(e=>e.archetype==='infected.alpha').hp=0;
  if(fault==='native-control-diverged')n.rows[0].controlIdentical=false;
  if(fault==='native-driver')r.inputs[100].nativeDriver=true;
  if(fault==='input-gap')r.inputs.splice(100,1);
  if(fault==='no-physical-fire')a.commands.forEach(c=>c.mouseDown=false);
  if(fault==='no-rocket-kills')r.events=r.events.filter(e=>e.type!=='combat.kill');
  if(fault==='wrong-weapon')r.events.filter(e=>e.type==='combat.kill').forEach(e=>e.actionId='weapon.bat');
  if(fault==='distant-blast')r.events.filter(e=>e.type==='explosion').forEach(e=>e.position.x+=500);
  if(fault==='dead-human')r.ticks.forEach(s=>s.humans.forEach(h=>h.hp=0));
  if(fault==='misses-disc')r.ticks.forEach(s=>s.humans.forEach(h=>h.position.x+=500));
  if(fault==='not-crossed-west')r.crossed.forEach(c=>c.position.x=0);
  if(fault==='wrong-carried-id')r.crossed.forEach(c=>c.id=999999);
  if(fault==='living-body-in-gap')r.ticks.forEach(s=>{const h=s.humans[0];if(h)s.final.push({...a.setup.initial[0],hp:300,position:{...h.position}});});
  if(fault==='unseen')v.captures.forEach(c=>c.seen='');
  if(fault==='missing-capture')a.captures.pop();
  if(fault==='wrong-quality')a.setup.quality='high';
  if(fault==='console-error')a.errors.push('control');
  const raw=Buffer.from(JSON.stringify(a));v.inputSha256=sha(raw);writeFileSync(ip,gzipSync(raw,{mtime:0}));writeFileSync(rp,JSON.stringify(v));writeFileSync(np,gzipSync(JSON.stringify(n),{mtime:0}));const c=run(),rejected=c.length!==6||c.some(c=>c.status!=='PASS');assert(rejected,fault);cases.push({fault,rejected});
 }finally{writeFileSync(ip,original);writeFileSync(rp,originalReview);writeFileSync(np,originalNative);}
}
assert.equal(run().length,6);assert(run().every(c=>c.status==='PASS'),'restored');writeFileSync(`${root}/coverage-proof.json`,JSON.stringify({...p,browserHash:hash,method:'Actual unchanged consumer; semantic mutations preserve rehashed input/review linkage. Exact original input/review/native bytes restored. Missing actors never counted as dead.',cases},null,2)+'\n');
