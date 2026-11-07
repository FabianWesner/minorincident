import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {reviewFreshness} from '../../../tools/qa/accept/reviews.ts';
const frozen='4e570db8499bd1d76dcc17f9d13d1949d5cf2096';
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const hashes=new Map();const hash=f=>{if(!hashes.has(f))hashes.set(f,sha(f));return hashes.get(f)};
assert.equal(execFileSync('git',['diff',frozen,'--','src','public','layouts']).length,0);
const rows=[];
for(const level of ['L7','L8','L9','L10']){
 const report=JSON.parse(fs.readFileSync(`docs/reports/fix51-verify/${level}.json`));
 for(const row of report.rows){
  const file=`docs/qa/reviews/${row.id}.json`,r=JSON.parse(fs.readFileSync(file));
  assert.equal(r.reviewer,'Codex final-c',row.id);assert.equal(r.commit,frozen,row.id);
  const freshness=reviewFreshness(r,level);assert.equal(freshness,'FRESH',row.id);
  assert.equal(row.reviewDecision?.freshness,'FRESH',`tracker ${row.id}`);
  assert.equal(row.reviewDecision?.reviewer,r.reviewer,`tracker reviewer ${row.id}`);
  for(const e of r.evidence){assert(fs.existsSync(e.file),e.file);assert.equal(hash(e.file),e.sha256,`${row.id} ${e.file}`)}
  rows.push({row:row.id,review:file,sha256:sha(file),freshness,trackerFreshness:row.reviewDecision.freshness,reviewStatus:r.status,machineStatus:row.currentStatus,evidenceFiles:r.evidence.length});
 }
}
assert.equal(rows.length,47);
const nativeControls=[];for(const name of fs.readdirSync('docs/reports/final-c/native').filter(n=>/-(complete|stationary)[.]json[.]gz$/.test(n))){const archived=JSON.parse(gunzipSync(fs.readFileSync('docs/reports/final-c/native/'+name))),current=JSON.parse(fs.readFileSync('docs/reports/fix51-verify/receipts/'+name.slice(0,-3)));assert.equal(archived.sourceHash,current.sourceHash,name);assert.equal(archived.nativeStateHash,current.nativeStateHash,name);nativeControls.push({receipt:name,sourceIdentical:true,stateHashIdentical:true,stateHash:current.nativeStateHash})}assert.equal(nativeControls.length,12);
const result={frozenGameHead:frozen,at:new Date().toISOString(),rows:rows.length,allFresh:true,allTrackerFresh:true,allEvidencePresent:true,allEvidenceHashesMatch:true,uniqueEvidenceFiles:hashes.size,gameSourceDiffEmpty:true,nativeControls,decisions:rows};
fs.writeFileSync('docs/reports/final-c/final-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,decisions:undefined}));
