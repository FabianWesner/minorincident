import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fistsOnlyRoute, fistsCompletionPass } from './fix53-fists';
import { buildLevelReport } from './report';
import { provenance } from './probe';
const read=(path:string)=>({path,receipt:JSON.parse(readFileSync(path,'utf8'))});
const native=['low','high'].flatMap(t=>['complete','stationary'].map(p=>read(`docs/reports/fix51-verify/receipts/L6-${t}-${p}.json`)));
const fixtures=['low','high'].map(t=>read(`docs/reports/fix51-verify/receipts/L6-${t}-fixtures.json`));
const verdict=(f:typeof fixtures)=>buildLevelReport('L6',native,f).rows.find(row=>row.id==='L6-13')!.currentStatus;
assert.equal(verdict(fixtures),'PASS');
const rows=[],controls=[];
for(const tier of ['low','high'] as const){
 const cell=fixtures.find(f=>f.receipt.tier===tier)!;
 const check=cell.receipt.checks.find((c:{id:string})=>c.id==='L6-13');
 const result=check.value.maneuver;assert(result&&fistsCompletionPass(result));
 const repeat=await fistsOnlyRoute(tier);assert(fistsCompletionPass(repeat));assert.equal(repeat.nativeStateHash,result.nativeStateHash);
 rows.push({tier,stats:result.stats,result:{rescued:result.result.rescued,survivorsIn:result.result.survivorsIn},offered:result.offered,attacks:result.attacks,events:result.events,nativeStateHash:result.nativeStateHash,independentRepeatHash:repeat.nativeStateHash});
 const copy=structuredClone(fixtures);copy.find(f=>f.receipt.tier===tier)!.receipt.checks=cell.receipt.checks.filter((c:{id:string})=>c.id!=='L6-13');assert.equal(verdict(copy),'NOT CHECKED');controls.push({tier,missing:'complete unarmed evidence',result:'NOT CHECKED'});
 for(const kind of ['not complete','gun offered','gun used','missing inventory coverage']){
  const bad=structuredClone(result);
  if(kind==='not complete')bad.completed=false;
  else if(kind==='gun offered')bad.offered.push('weapon.army-mg');
  else if(kind==='gun used')bad.attacks.push('weapon.army-mg');
  else bad.offered=[];
  assert.equal(fistsCompletionPass(bad),false);controls.push({tier,missing:kind,result:'rejected'});
 }
}
const archive='docs/reports/fix53-b/L6-13-native.json.gz';writeFileSync(archive,gzipSync(JSON.stringify({native,fixtures})));
writeFileSync('docs/reports/fix53-b/L6-13-proof.json',JSON.stringify({...provenance(),row:'L6-13',status:'PASS',method:'Ordinary mortal native input. Shelter orbit/local evasion, then existing evade route. Only fists are used; fists/kick inventory. Production checkpoint retries. No health, actor, clock, count, cap or objective changes. This proves finishability, not the competent mortality/rescue targets.',rows,controls,archive,sha256:createHash('sha256').update(readFileSync(archive)).digest('hex')},null,2)+'\n');
console.log('L6-13 PASS at both qualities, independently repeated; ten missing/invalid evidence controls reject PASS.');
