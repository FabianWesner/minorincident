// Execute the existing native probes on the CPU runner. The runner has a Git
// manifest but no commits: transport the local identity, then verify both file
// digests independently before supplying the probe's explicit identity argument.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {probeLevel} from '../../../tools/qa/accept/probe.ts';
import {runFixtures,fixtureHash} from '../../../tools/qa/accept/fixtures.ts';
import {checkpointProbe} from '../../../tools/qa/accept/checkpoints.ts';
const identity=JSON.parse(readFileSync('docs/reports/pre-uat-l10/identity.json','utf8'));
const hash=paths=>{const h=createHash('sha256');for(const p of [...new Set(paths)].sort())h.update(p).update('\0').update(readFileSync(p));return h.digest('hex');};
const files=execFileSync('git',['ls-files','-z','--','src','layouts','public/assets/layouts'],{encoding:'utf8'}).split('\0').filter(Boolean);
assert.equal(hash(files),identity.sourceHash);
const observerFiles=['tools/qa/accept/observer.ts','tools/qa/accept/probe.ts','tools/qa/accept/l5-formation.ts',...['tools/qa/threat','tools/sim-runner'].flatMap(dir=>readdirSync(dir).filter(f=>f.endsWith('.ts')).map(f=>join(dir,f)))];
assert.equal(hash(observerFiles),identity.observerHash);
const out='test-results/pre-uat-l10/native-verified';mkdirSync(out,{recursive:true});
writeFileSync(`${out}/identity.json`,JSON.stringify({...identity,independentlyVerified:true},null,2));
for(const tier of ['low','high']){
 let complete;
 for(const policy of ['complete','stationary']){
  const receipt=await probeLevel('L10',tier,policy,identity);
  writeFileSync(`${out}/L10-${tier}-${policy}.json`,JSON.stringify(receipt,null,2));
  assert.equal(receipt.error,null);if(policy==='complete')complete=receipt;
  console.log(JSON.stringify({tier,policy,outcome:receipt.run?.outcome}));
 }
 const fixturePath=`docs/reports/fix51-verify/receipts/L10-${tier}-fixtures.json`;
 const fixture=await runFixtures('L10',tier,identity.sourceHash,fixturePath);
 writeFileSync(`${out}/L10-${tier}-fixtures.json`,JSON.stringify(fixture,null,2));assert.equal(fixture.errors.length,0);
 const checkpoint=await checkpointProbe(complete,`docs/reports/fix51-verify/receipts/L10-${tier}-checkpoints.json`,fixtureHash());
 writeFileSync(`${out}/L10-${tier}-checkpoints.json`,JSON.stringify(checkpoint,null,2));assert.equal(checkpoint.errors.length,0);assert(checkpoint.control.identical);
 for(const kind of ['complete','stationary','fixtures','checkpoints'])copyFileSync(`${out}/L10-${tier}-${kind}.json`,`docs/reports/fix51-verify/receipts/L10-${tier}-${kind}.json`);
 console.log(JSON.stringify({tier,fixtures:fixture.checks.length,checkpoints:checkpoint.checks.length,controlIdentical:true}));
}

for(const tool of ['tools/qa/accept/l10-hold-r10.ts','tools/qa/accept/fix72-c-l10-composition.ts']){const started=performance.now(),r=spawnSync(process.execPath,['--import','tsx/esm',tool],{env:{...process.env,QA_ACCEPT_REVISION:identity.revision},stdio:'inherit'});assert.equal(r.status,0);console.log(JSON.stringify({tool,seconds:(performance.now()-started)/1000,exit:r.status}));}
for(const [file,name]of [['docs/reports/fix51-r10c/l10-hold-proof.json','l10-hold-proof.json'],['docs/reports/fix72-c/L10-03/simultaneous-census.json','simultaneous-census.json'],['docs/reports/fix51-verify/receipts/L10-fringe-dogs.json','L10-fringe-dogs.json']])copyFileSync(file,`${out}/${name}`);
writeFileSync(`${out}/complete.json`,JSON.stringify({...identity,completed:new Date().toISOString()},null,2));
