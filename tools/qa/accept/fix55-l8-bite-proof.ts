import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {evaluate} from './evaluate';
import {provenance,type NativeReceipt} from './probe';
import {atomicJson} from './report';
const path='docs/reports/fix55-c/L8-bite-fixtures.json',raw=readFileSync(path),proof=JSON.parse(raw.toString()),nativePath='docs/reports/fix51-verify/receipts/L8-low-complete.json',native=JSON.parse(readFileSync(nativePath,'utf8')) as NativeReceipt,rows=[];
const checks=()=>evaluate(native,nativePath).filter(check=>check.id==='L8-05'&&['unprotected local-threat victim class coverage','all five same-ID species convert after actual bites'].includes(check.clause));
try{
 assert.equal(checks().length,2);assert(checks().every(check=>check.status==='PASS'));
 for(const fault of ['missing-staff-bite','early-turn','late-turn','wrong-species','wrong-id','no-actual-bite']){
  const candidate=structuredClone(proof),low=candidate.rows.find((row:{tier:string})=>row.tier==='low'),lion=low.turns.find((turn:{kind:string})=>turn.kind==='lion');
  if(fault==='missing-staff-bite')low.hits=low.hits.filter((hit:{kind:string})=>hit.kind!=='staff');
  if(fault==='early-turn')lion.seconds=2.49;if(fault==='late-turn')lion.seconds=3.51;
  if(fault==='wrong-species')lion.archetype='infected.gorilla';if(fault==='wrong-id')lion.id++;
  if(fault==='no-actual-bite')low.hits=low.hits.filter((hit:{kind:string})=>hit.kind!=='lion');
  writeFileSync(path,JSON.stringify(candidate));const failed=checks().filter(check=>check.status==='FAIL');assert(failed.length>0,fault);rows.push({fault,failures:failed.map(check=>check.clause)});
 }
}finally{writeFileSync(path,raw);}
assert(readFileSync(path).equals(raw));
atomicJson('docs/reports/fix55-c/L8-05-bite-fault-proof.json',{...provenance(),toolSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),method:'Six temporary production receipt faults must fail the actual evaluator; exact original bytes restored in finally. Actual Outbreak.bite is positive landed-bite evidence even without combat.hit.',rows});console.log(rows);
