import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { buildLevelReport } from './report';
import { provenance } from './probe';
const read=(path:string)=>({path,receipt:JSON.parse(readFileSync(path,'utf8'))});
const native=['low','high'].flatMap(t=>['complete','stationary'].map(p=>read(`docs/reports/fix51-verify/receipts/L5-${t}-${p}.json`)));
const fixtures=['low','high'].map(t=>read(`docs/reports/fix51-verify/receipts/L5-${t}-fixtures.json`));
const verdict=(f:typeof fixtures)=>buildLevelReport('L5',native,f).rows.find(row=>row.id==='L5-01')!;
const row=verdict(fixtures);assert.equal(row.currentStatus,'PASS');
const controls=[];
for(const tier of ['low','high'])for(const clause of fixtures[0].receipt.checks.filter((c:{id:string;clause:string})=>c.id==='L5-01'&&!c.clause.includes('versus native')).map((c:{clause:string})=>c.clause)){
 const copy=structuredClone(fixtures),cell=copy.find(f=>f.receipt.tier===tier)!;
 cell.receipt.checks=cell.receipt.checks.filter((c:{clause:string})=>c.clause!==clause);
 const result=verdict(copy).currentStatus;assert.equal(result,'NOT CHECKED');controls.push({tier,missing:clause,result});
}
const failed=structuredClone(fixtures);failed[0].receipt.checks.find((c:{clause:string})=>c.clause.includes('within0.6s')).status='FAIL';
assert.equal(verdict(failed).currentStatus,'FAIL');controls.push({tier:'low',missing:'forced failed Alpha trial',result:'FAIL'});
const archive='docs/reports/fix53-b/L5-01-native.json.gz';writeFileSync(archive,gzipSync(JSON.stringify({native,fixtures})));
const sha=createHash('sha256').update(readFileSync(archive)).digest('hex');
writeFileSync('docs/reports/fix53-b/L5-01-proof.json',JSON.stringify({...provenance(),row:'L5-01',status:row.currentStatus,expected:row.expected,checks:row.checks,controls,archive,sha256:sha,clock:'Production first attack starts at tick1, includes six-tick initial gun raise, Alpha incapacitated at37:36ticks=0.600s. Actual shell discharges at7/37. Shelf flag comes from actual spawned pickup.surfaceY;2.157m collection obeys unchanged2.2m shelf approach rule. No target, action or gameplay value changed.'},null,2)+'\n');
console.log('L5-01 PASS; six single-clause omissions and one failed Alpha control prevent PASS.');
