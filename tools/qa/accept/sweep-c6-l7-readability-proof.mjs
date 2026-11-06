import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {l7ReadabilityReceipts} from './l7-readability-receipts.ts';
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
const p=provenance(),hash=browserHash(),root='docs/reports/sweep-c6/L7-12';
const ip=`${root}/low-physical.json.gz`,cp=`${root}/low-city-physical.json.gz`,rp=`${root}/low-review.json`,pp=`${root}/contrast-proof.json`;
const original=readFileSync(ip),originalCity=readFileSync(cp),originalReview=readFileSync(rp),originalProof=readFileSync(pp),sha=b=>createHash('sha256').update(b).digest('hex');
const run=()=>l7ReadabilityReceipts(p.sourceHash,hash).flatMap(r=>r.receipt.checks),cases=[];
assert.equal(run().length,4);assert(run().every(c=>c.status==='PASS'),'baseline');
const faults=['stale-source','wrong-browser','wrong-producer','wrong-quality','native-driver','input-gap','no-device-commands','missing-zoom','wrong-actual-zoom','stepped-between-masks','missing-mask-link','empty-body-mask','missing-ring','invented-ratio','contrast-2.999','contrast-both-2.999','dead-alpha','replaced-alpha','motion-gap','missing-city-frame','wrong-city-zoom','unreviewed','blank-seen-note','alpha-not-human','no-destruction-review','stale-analyzer','console-error'];
for(const fault of [...faults,'contrast-exactly-3']){
 try{
  const a=JSON.parse(gunzipSync(original)),city=JSON.parse(gunzipSync(originalCity)),v=JSON.parse(originalReview),proof=JSON.parse(originalProof),m=proof.rows.find(r=>r.tier==='low');
  if(fault==='stale-source')a.sourceHash='0'.repeat(64);
  if(fault==='wrong-browser')a.browserHash='0'.repeat(64);
  if(fault==='wrong-producer')a.toolSha256='0'.repeat(64);
  if(fault==='wrong-quality')a.setup.quality='high';
  if(fault==='native-driver')a.result.inputs[10].nativeDriver=true;
  if(fault==='input-gap')a.result.inputs.splice(10,1);
  if(fault==='no-device-commands')a.commands=[];
  if(fault==='missing-zoom')a.cells=a.cells.filter(c=>c.zoom!==.5);
  if(fault==='wrong-actual-zoom')a.cells[0].state.camera.zoom=1.5;
  if(fault==='stepped-between-masks')a.cells[0].afterTick++;
  if(fault==='missing-mask-link')m.captures.mask.sha256='0'.repeat(64);
  if(fault==='empty-body-mask')m.courierMaskPixels=0;
  if(fault==='missing-ring')m.ringSamples=[];
  if(fault==='invented-ratio')m.contrast05+=1;
  if(fault==='contrast-2.999'||fault==='contrast-both-2.999'||fault==='contrast-exactly-3'){
   const target=fault==='contrast-exactly-3'?3:2.999,offset=fault==='contrast-both-2.999'?.02:.05;m.courierP90=target*(m.ringMedian+offset)-offset;
   m.contrast05=(Math.max(m.courierP90,m.ringMedian)+.05)/(Math.min(m.courierP90,m.ringMedian)+.05);if(fault==='contrast-exactly-3')m.contrast05=3;m.contrast02=(Math.max(m.courierP90,m.ringMedian)+.02)/(Math.min(m.courierP90,m.ringMedian)+.02);
  }
  if(fault==='dead-alpha')a.cells.filter(c=>c.label==='horde-0').forEach(c=>c.state.alphas.forEach(a=>a.hp=0));
  if(fault==='replaced-alpha')a.cells.filter(c=>c.label==='horde-6').forEach(c=>c.state.alphas.forEach(a=>a.id+=10000));
  if(fault==='motion-gap')a.cells.filter(c=>c.label==='horde-6').forEach(c=>c.state.tick++);
  if(fault==='missing-city-frame')city.captures.pop();
  if(fault==='wrong-city-zoom')city.cells[0].state.camera.zoom=1.5;
  if(fault==='unreviewed')v.allPersonallyReviewed=false;
  if(fault==='blank-seen-note')v.captures.forEach(c=>c.seen='');
  if(fault==='alpha-not-human')v.alphaHuman=false;
  if(fault==='no-destruction-review')v.cityDestruction=false;
  if(fault==='stale-analyzer')proof.producerSha256='0'.repeat(64);
  if(fault==='console-error')a.errors.push('injected console error');
  const raw=Buffer.from(JSON.stringify(a)),cityRaw=Buffer.from(JSON.stringify(city));v.inputSha256=sha(raw);v.cityInputSha256=sha(cityRaw);
  writeFileSync(ip,gzipSync(raw));writeFileSync(cp,gzipSync(cityRaw));writeFileSync(rp,JSON.stringify(v));writeFileSync(pp,JSON.stringify(proof));
  const checks=run(),passed=checks.length===4&&checks.every(c=>c.status==='PASS');
  if(fault==='contrast-exactly-3')assert(passed,fault);else assert(!passed,fault);
  if(fault==='contrast-2.999')assert.equal(checks.find(c=>c.tier==='low'&&c.clause.includes('contrast')).status,'NOT CHECKED','offset ambiguity must not be a false measured FAIL');
  if(fault==='contrast-both-2.999')assert.equal(checks.find(c=>c.tier==='low'&&c.clause.includes('contrast')).status,'FAIL','both offsets below target');
  cases.push({fault,expected:fault==='contrast-exactly-3'?'PASS':'reject',passed});
 }finally{writeFileSync(ip,original);writeFileSync(cp,originalCity);writeFileSync(rp,originalReview);writeFileSync(pp,originalProof);}
}
assert.equal(run().length,4);assert(run().every(c=>c.status==='PASS'),'restored');
writeFileSync(`${root}/coverage-proof.json`,JSON.stringify({...p,browserHash:hash,toolSha256:sha(readFileSync(new URL(import.meta.url))),method:'Actual dedicated consumer; semantic faults, inclusive3.0boundary and explicit offset-ambiguity control. Mutated input/review links are rehashed. Exact original input/city/review/analysis bytes restored after every case; no game change.',cases},null,2)+'\n');
