/** Publish finished staged native/fixture receipts after both browser matrices terminate. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {provenance} from './accept/probe.ts';
import {fixtureHash} from './accept/fixtures.ts';
const identity=provenance(),hash=fixtureHash(),native=[],fixtures=[],pending=[];
for(let n=1;n<=10;n++)for(const tier of ['low','high']){
 for(const policy of ['complete','stationary']){
  const name=`L${n}-${tier}-${policy}.json`,bytes=readFileSync(`test-results/fix51-r4/native-final/${name}`),r=JSON.parse(bytes);
  const dest=`docs/reports/fix51-verify/receipts/${name}`,old=JSON.parse(execFileSync('git',['show',`524ea45a6:${dest}`],{encoding:'utf8',maxBuffer:32*1024*1024}));
  assert.equal(r.sourceHash,identity.sourceHash);assert.equal(r.observerHash,identity.observerHash);assert.equal(r.error,null);assert(r.observation&&r.threat&&r.run);
  assert.equal(r.sourceHash,old.sourceHash);assert.equal(r.nativeStateHash,old.nativeStateHash,`${name}: observer changed actual native state`);
  if(policy==='complete')assert(r.run.completed);
  native.push({name,nativeStateHash:r.nativeStateHash,baselineStateHash:old.nativeStateHash,identical:true});pending.push([dest,bytes]);
 }
 const name=`L${n}-${tier}-fixtures.json`,bytes=readFileSync(`test-results/fix51-r4/fixtures-final/${name}`),r=JSON.parse(bytes);
 assert.equal(r.sourceHash,identity.sourceHash);assert.equal(r.fixtureHash,hash);assert.deepEqual(r.errors,[]);
 fixtures.push({name,checks:r.checks.length,errors:r.errors});pending.push([`docs/reports/fix51-verify/receipts/${name}`,bytes]);
}
assert.equal(native.length,40);assert.equal(fixtures.length,20);
if(!process.argv.includes('--check-only'))for(const [path,bytes]of pending)writeFileSync(path,bytes);
writeFileSync('docs/reports/fix51-r4/native-equivalence.json',JSON.stringify({...identity,baseline:'524ea45a6',method:'Fresh final observer: every complete/stationary native route at both qualities versus the initial merged-head receipts; full final native state hashes equal. No game source changed.',native,fixtures},null,2)+'\n');
console.log(`${process.argv.includes('--check-only')?'Checked':'Published'} 40 native and 20 fixture receipts; all 40 native final states equal the initial merged-head observations.`);
