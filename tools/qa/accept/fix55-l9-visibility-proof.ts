import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { l9RouteReceipts } from './l9-route-receipts-r10';
import { provenance } from './probe';
import { browserHash } from './browser';
import { atomicJson } from './report';
const path='docs/reports/fix51-r10c/L9-low-webgl2-z1.5-road.json',raw=readFileSync(path),input=JSON.parse(raw.toString()),identity=provenance(),rows=[];
const read=()=>l9RouteReceipts(identity.sourceHash,browserHash()).find(result=>result.receipt.tier==='low'&&result.path.endsWith('-road-browser.json'))!.receipt.checks[0].status;
try{
 assert.equal(read(),'FAIL','completed measured127.98s gap is an actual failure');
 for(const gap of [59.99,60,60.01]){
  const candidate=structuredClone(input);candidate.visibility.conservativeGapSeconds=gap;candidate.visibility.pass=gap<=60;
  writeFileSync(path,JSON.stringify(candidate));const actual=read(),expected=gap<=60?'PASS':'FAIL';assert.equal(actual,expected);rows.push({gap,expected,actual});
 }
 const incomplete=structuredClone(input);incomplete.result.runs[0].finished=false;writeFileSync(path,JSON.stringify(incomplete));assert.equal(read(),'NOT CHECKED');rows.push({case:'unfinished drive',actual:read(),expected:'NOT CHECKED'});
}finally{writeFileSync(path,raw);l9RouteReceipts(identity.sourceHash,browserHash());}
assert(readFileSync(path).equals(raw));
atomicJson('docs/reports/fix55-c/L9-03-classification-proof.json',{...identity,toolSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),input:{file:path,sha256:createHash('sha256').update(raw).digest('hex')},method:'Source-bound physical completed drive127.98s proves previous unconditional NOT CHECKED fallback hid measured failures. Temporary receipt fault controls only; exact original bytes restored in finally. No gameplay or threshold change.',rows});
console.log(rows);
