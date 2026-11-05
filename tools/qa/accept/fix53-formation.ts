/** Preserve current native L5 straight-calm counterexamples; missing coverage cannot pass. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { evaluate } from './evaluate';
import { provenance, type NativeReceipt } from './probe';
const identity = provenance(), root='docs/reports/fix53-b';
const sha=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
const rows=[];
for(const tier of ['low','high'] as const){
  const path=`docs/reports/fix51-verify/receipts/L5-${tier}-complete.json`;
  const receipt=JSON.parse(readFileSync(path,'utf8')) as NativeReceipt;
  assert.equal(receipt.sourceHash,identity.sourceHash); assert(receipt.run?.completed);
  const formation=receipt.observation!.l5Formation!;
  const checks=evaluate(receipt,path).filter(c=>c.id==='L5-08');
  const band=checks.find(c=>c.clause.includes('straight-walk'))!; assert.equal(band.status,'FAIL');
  const controls=[];
  for(const kind of ['empty formation','missing counterexamples','79percent within8m']){
    const copy=structuredClone(receipt);
    if(kind==='empty formation')copy.observation!.l5Formation=[];
    else if(kind==='missing counterexamples')for(const row of copy.observation!.l5Formation!){row.counterexample=null;row.badStraightTicks=0;}
    else for(const row of copy.observation!.l5Formation!)row.within8Ticks=Math.floor(row.calmTicks*.79);
    const clauses=evaluate(copy,'control').filter(c=>c.id==='L5-08');
    const result=clauses.find(c=>c.clause.includes(kind==='79percent within8m'?'share within8m':'straight-walk'))!.status;
    assert.equal(result,kind==='79percent within8m'?'FAIL':'NOT CHECKED');controls.push({kind,result});
  }
  rows.push({tier,path,sha256:sha(path),run:receipt.run,nativeStateHash:receipt.nativeStateHash,formation,checks,controls});
}
const path=`${root}/L5-08.json`;
writeFileSync(path,JSON.stringify({...identity,row:'L5-08',status:'FAIL',rows,scope:'Conservative calm straight-movement subset; counterexamples disprove2–5m. Does not establish every rendered bar or absolute non-discontinuous speed.',whyNoSmallFix:'Both native routes reproduce rear-band failures with normal game inputs. A formation/path controller change needs combined3.8m/s, route-clearance and pace qualification; no teleport, hidden catch-up speed or criterion change is introduced.'},null,2)+'\n');
const reviewPath='docs/qa/reviews/L5-08.json',review=JSON.parse(readFileSync(reviewPath,'utf8'));
Object.assign(review,{reviewer:'Codex/fix53-b',date:'2026-11-04',commit:identity.revision});
review.clauses[0].note='Fresh current-source native complete routes at both qualities reproduce calm sustained-straight rear-band counterexamples: low follower31 is5.536m behind at tick3394; high follower30 is6.005m behind at tick4713. Calm within8m share passes in the observed five-person groups. Every rendered bar and a continuous absolute speed proof remain unqualified.';
review.evidence=[{file:path,sha256:sha(path),what:'Both current full native routes, exact counterexample positions/ticks and six absent-coverage/79percent controls.'}];
review.notes='Measured FAIL with unchanged2–5m criterion. No game source, count, timer, cap or policy changed.';
writeFileSync(reviewPath,JSON.stringify(review,null,2)+'\n');
console.log('L5-08 FAIL reproduced; six missing/threshold controls pass.');
