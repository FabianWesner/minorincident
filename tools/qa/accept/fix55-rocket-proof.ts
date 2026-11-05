import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fix55RocketReceipts} from './fix55-rocket-receipts';
import {provenance} from './probe';
import {browserHash} from './browser';
import {atomicJson} from './report';
const inputPath='docs/reports/fix55-c/L7-03-physical.json',reviewPath='docs/reports/fix55-c/L7-03-review.json',raw=readFileSync(inputPath),reviewRaw=readFileSync(reviewPath),input=JSON.parse(raw.toString()),review=JSON.parse(reviewRaw.toString()),identity=provenance(),rows=[];
const receipts=()=>fix55RocketReceipts(identity.sourceHash,browserHash());
try{
 const baseline=receipts();assert.equal(baseline.length,2);assert(baseline.every(row=>row.receipt.checks.every(check=>check.status==='PASS')));
 for(const fault of ['cadence','late-flight','missed-ground','nineteen-kills','blocked-gap','unreviewed-flash']){
  const candidate=structuredClone(input),checked=structuredClone(review),low=candidate.rows.filter((row:{tier:string})=>row.tier==='low');
  const cadence=low.find((row:{kind:string})=>row.kind==='cadence'),cohort=low.find((row:{kind:string})=>row.kind==='cohort');
  const shots=cadence.result.events.filter((event:{type:string;sourceId:number})=>event.type==='combat.attack'&&event.sourceId===1);
  if(fault==='cadence')shots[1].tick++;
  if(fault==='late-flight')cadence.result.events.find((event:{type:string})=>event.type==='explosion').tick=shots[1].tick-1;
  if(fault==='missed-ground')cadence.result.events.find((event:{type:string})=>event.type==='explosion').position.x+=1;
  if(fault==='nineteen-kills')for(const actor of cohort.result.final.slice(19))actor.hp=60;
  if(fault==='blocked-gap'){const actor=cohort.result.final[0];actor.hp=60;actor.position.x=cohort.result.point.x;actor.position.z=cohort.result.point.z;}
  if(fault==='unreviewed-flash')checked.rocketReview.noWhiteout=false;
  writeFileSync(inputPath,JSON.stringify(candidate));checked.inputSha256=createHash('sha256').update(readFileSync(inputPath)).digest('hex');writeFileSync(reviewPath,JSON.stringify(checked));
  const result=receipts().find(row=>row.receipt.tier==='low')!;assert(result.receipt.checks.some(check=>check.status==='FAIL'),fault);rows.push({fault,status:'rejected',failures:result.receipt.checks.filter(check=>check.status==='FAIL').map(check=>check.clause)});
 }
}finally{writeFileSync(inputPath,raw);writeFileSync(reviewPath,reviewRaw);receipts();}
assert(readFileSync(inputPath).equals(raw)&&readFileSync(reviewPath).equals(reviewRaw));
atomicJson('docs/reports/fix55-c/L7-03-fault-proof.json',{...identity,toolSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),method:'Six source-bound receipt fault controls; update paired input hash so each clause, rather than provenance alone, must reject the fault. Exact original input/review bytes restored in finally.',rows});
console.log(rows);
