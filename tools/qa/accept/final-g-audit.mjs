/** Final review/receipt integrity audit; no gameplay writes. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {loadReviews,reviewFreshness,reviewSourceDigest,validateReviewDirectory} from './reviews.ts';
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
import {mergeBrowserBatches} from './browser-chain.ts';
const frozen='4e570db8499bd1d76dcc17f9d13d1949d5cf2096',source='2d4498cb2e99f3ae6ddb76c87e48972ad9c3e343eac5c7691daf06a024896a17';
const read=p=>JSON.parse(readFileSync(p)),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
validateReviewDirectory();
assert.equal(execFileSync('git',['diff',frozen,'--name-only','--','src','public','layouts'],{encoding:'utf8'}).trim(),'');
assert.equal(provenance().sourceHash,source);assert.equal(reviewSourceDigest('global'),reviewSourceDigest('global',frozen));
const reviews=[];
for(let n=6;n<=27;n++){const id=`G-${String(n).padStart(2,'0')}`,r=loadReviews(id);assert(r,id);assert.equal(r.reviewer,'final-g/Codex');assert.equal(r.commit,frozen);assert.equal(reviewFreshness(r,'global'),'FRESH');reviews.push({row:id,status:r.status,sourceDigest:r.sourceDigest,reviewSha256:sha(`docs/qa/reviews/${id}.json`)});}
const matrix=[],chains=[];
for(let n=1;n<=10;n++)for(const tier of['low','high']){
 const path=`docs/reports/fix51-verify/receipts/L${n}-${tier}-webgl2-z1.5-browser.json`,r=read(path),c=r.checks.find(c=>c.id==='G-25');
 assert.equal(r.sourceHash,source);assert.equal(r.browserHash,browserHash());assert.equal(r.level,`L${n}`);assert.equal(r.tier,tier);assert.equal(r.backend,'webgl2');assert.equal(r.errors.length,0);if(r.observations?.alternateRoute){const producer=r.observations.producer;assert.equal(producer.sha256,sha(producer.file));assert.equal(r.observations.alternateRoute,'countryside');}
 assert(c&&c.value.completed&&c.status==='PASS',`${path}: full-route console qualification`);assert.equal(c.value.consoleErrors.length,0);assert.equal(c.value.skipped.length,0);assert(r.run[0].finished);assert(!r.issues.some(i=>['console-error','page-error'].includes(i.kind)));
 if(n===10){const items=r.batches.map(b=>({path:b.path,receipt:read(b.path)})),merged=mergeBrowserBatches(items,path);assert(merged.checks[0].value.completed);assert.equal(merged.errors.length,0);for(const{receipt:b}of items)if(b.batch.yielded){assert(existsSync(b.batch.savePath));assert.equal(createHash('sha256').update(JSON.stringify(JSON.parse(gunzipSync(readFileSync(b.batch.savePath))))).digest('hex'),b.batch.endSaveHash);}chains.push({tier,batches:items.length,productionSaveChain:true});}
 matrix.push({level:r.level,tier,path,sha256:sha(path),completed:true,consoleErrors:0,skipped:0});
}
for(let n=1;n<=10;n++){const p=`docs/reports/final-g/G-27-L${n}.json`,r=read(p);assert.equal(r.level,`L${n}`);assert(r.glitches.length);assert(r.stunning.verdict&&r.stunning.missing);assert(r.boringHarmlessBabysitting.length);if(n===10)assert(!/pending|still running|remaining.*running/i.test(r.scope));}
const captureManifests=[];for(const name of readdirSync('docs/reports/final-g').filter(n=>n.endsWith('-captures.json'))){const p=`docs/reports/final-g/${name}`,m=read(p);assert.equal(m.reviewer,'final-g/Codex');assert.equal(sha(m.source.file),m.source.sha256);for(const c of m.captures){assert(c.seen?.trim(),c.file);if(c.retained){assert(existsSync(c.file),c.file);assert.equal(sha(c.file),c.sha256);}else assert(!existsSync(c.file),`Unneeded raw capture remains: ${c.file}`);}captureManifests.push({path:p,captures:m.captures.length,retained:m.captures.filter(c=>c.retained).length,sha256:sha(p)});}
const table=readFileSync('docs/reports/final-g/README.md','utf8');assert.equal(table.split('\n').filter(l=>/^\| G-\d\d \|/.test(l)).length,22);assert(!table.includes('| pending |'));
for(let n=1;n<=10;n++){const r=read(`docs/reports/fix51-verify/L${n}.json`);assert.equal(r.sourceHash,source);for(const v of r.globals.filter(v=>/^G-(0[6-9]|1\d|2[0-7])$/.test(v.id)))assert.equal(v.reviewDecision?.freshness,'FRESH',`L${n}/${v.id}`);}
const counts=reviews.reduce((o,r)=>(o[r.status]=(o[r.status]??0)+1,o),{}),out={generatedAt:new Date().toISOString(),frozenGameplayHead:frozen,sourceHash:source,browserHash:browserHash(),reviews,counts,matrix,chains,captureManifests,gameplayDiff:[],result:'PASS: all22 current review digests, all20 complete physical console cells, both production Resume chains, all10 final native reports and README table verified.'};writeFileSync('docs/reports/final-g/final-audit.json',JSON.stringify(out,null,2)+'\n');console.log(out.result,counts);
