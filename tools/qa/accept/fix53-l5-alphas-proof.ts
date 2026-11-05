import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { l5AlphasPass } from './fix53-l5-alphas';
import { provenance } from './probe';
const rows=[],controls=[];
for(const tier of ['low','high'] as const){
 const fixture=JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L5-${tier}-fixtures.json`,'utf8'));
 const row=fixture.checks.find((c:{id:string})=>c.id==='L5-04').value;
 const path=`docs/reports/fix51-verify/receipts/L5-${tier}-complete.json`,control=JSON.parse(readFileSync(path,'utf8'));
 assert(l5AlphasPass(row));assert.equal(row.finalHash,control.nativeStateHash);
 rows.push({...row,canonicalHash:control.nativeStateHash,controlPath:path,controlSha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
 for(const kind of ['one Alpha only','blocked second Alpha','dead second Alpha','incomplete route']){
  const bad=structuredClone(row);
  if(kind==='one Alpha only')bad.observed.alphas.pop();
  else if(kind==='blocked second Alpha')bad.observed.alphas[1].pathLength=null;
  else if(kind==='dead second Alpha')bad.observed.alphas[1].hp=0;
  else bad.run.completed=false;
  assert.equal(l5AlphasPass(bad),false);controls.push({tier,kind,result:'rejected'});
 }
}
writeFileSync('docs/reports/fix53-b/L5-04-proof.json',JSON.stringify({...provenance(),row:'L5-04',status:'PASS',method:'Both actual living Alpha identities at the first ordinary street search tick; independent body-clear path length to the actual courier. Full mortal native routes end with identical canonical state hashes. No spawn, pose, actor, input or game navigation changes.',rows,controls},null,2)+'\n');
console.log('L5-04 PASS: both Alphas reachable at both qualities; canonical states identical; eight bad/missing controls reject PASS.');
