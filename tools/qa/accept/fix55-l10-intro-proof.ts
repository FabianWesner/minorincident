import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildLevelReport, atomicJson } from './report';
import type { NativeReceipt } from './probe';

const proofPath='docs/reports/fix51-r10c/L10-introduction-proof.json';
const original=readFileSync(proofPath);
const native=['low','high'].flatMap(tier=>['complete','stationary'].map(policy=>{
  const path=`docs/reports/fix51-verify/receipts/L10-${tier}-${policy}.json`;
  return {path,receipt:JSON.parse(readFileSync(path,'utf8')) as NativeReceipt};
}));
const verdict=(receipts:typeof native)=>buildLevelReport('L10',receipts).rows.find(row=>row.id==='L10-02')!.currentStatus;
const cases=[];
try {
  assert.equal(verdict(native),'PASS');
  for (const fault of ['late introduction','too close','missing introduction','missing impact','missing path','missing high tier']) {
    const receipts=structuredClone(native), proof=JSON.parse(original.toString());
    const observation=receipts[0].receipt.observation!;
    if (fault==='late introduction') observation.megaIntroduction!.tick=7201;
    if (fault==='too close') observation.megaIntroduction!.distance=79.99;
    if (fault==='missing introduction') observation.megaIntroduction=null;
    if (fault==='missing impact') proof.rows[0].cues=proof.rows[0].cues.filter((cue:{kind:string})=>cue.kind!=='impact');
    if (fault==='missing path') proof.rows[0].introduction.pathMetres=null;
    if (fault==='missing high tier') receipts.splice(2,2);
    writeFileSync(proofPath,JSON.stringify(proof));
    const observed=verdict(receipts); assert.notEqual(observed,'PASS',fault);
    cases.push({fault,observed});
  }
} finally { writeFileSync(proofPath,original); }
atomicJson('docs/reports/fix55-c/L10-02-coverage-proof.json',{
  cases,control:'PASS',restoredSha256:createHash('sha256').update(readFileSync(proofPath)).digest('hex'),
});
console.log('L10-02 control passes; all six missing/broken-clause controls reject PASS; original evidence restored');
