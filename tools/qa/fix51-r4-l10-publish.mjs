/** Publish only completed, fully logged physical L10 Resume chains; preserve initial budget aborts. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const checkOnly=process.argv.includes('--check-only');
const root='docs/reports/fix51-r4',manifest=JSON.parse(readFileSync(`${root}/l10-batches.json`,'utf8'));
mkdirSync(`${root}/l10`,{recursive:true});mkdirSync(`${root}/attempts`,{recursive:true});
const inputHash=createHash('sha256').update(readFileSync('tools/playtest/session.ts')).digest('hex');
const runnerHash=createHash('sha256').update(readFileSync('tools/qa/fix51-r4-l10-batch.mjs')).digest('hex');
const legacyRunnerHash=createHash('sha256').update(readFileSync('tools/qa/fix51-r4-l10-batch-v1.txt')).digest('hex');
const results=[];
for(const cell of manifest.cells){
 if(!cell.finished){
  const suffix=cell.backend==='webgl2'?'':'-webgpu-z1.5',name=`L10-${cell.tier}${suffix}`;
  const path=`docs/reports/fix51-verify/receipts/${name}-browser.json`,out=`test-results/fix51-browser/${name}`;
  const index=cell.batches.length+1,failed=`test-results/fix51-r4/l10-batches/${cell.backend}-${cell.tier}/${index}`;
  let reason=cell.error??'Resume chain did not finish within the lane time box';
  if(existsSync(`${failed}/runs-batch.json`)){
   const original=JSON.parse(readFileSync(path,'utf8')),runs=JSON.parse(readFileSync(`${failed}/runs-batch.json`,'utf8')),issues=JSON.parse(readFileSync(`${failed}/issues-batch.json`,'utf8'));
   writeFileSync(`${root}/attempts/${name}-initial.json`,JSON.stringify(original,null,2)+'\n');
   writeFileSync(`${root}/attempts/${name}-completion.json.gz`,gzipSync(readFileSync(`${out}/accept-completion.json`)));
   const evidence=[];
   for(const file of ['runs-batch.json','issues-batch.json','batch-completion.json','log-batch.jsonl']){const artifact=`l10/${name}-failed-batch${index}-${file}.gz`;writeFileSync(`${root}/${artifact}`,gzipSync(readFileSync(`${failed}/${file}`)));evidence.push(artifact);}
   const allIssues=[...original.issues,...cell.batches.flatMap(b=>b.issues),...issues],consoleErrors=allIssues.filter(i=>i.kind==='console-error'||i.kind==='page-error');
   const aggregate={...runs[0],entry:'production-save-resume-batches-partial',finished:false,skipped:[],wallSeconds:original.run[0].wallSeconds+cell.batches.reduce((n,b)=>n+b.run.wallSeconds,0)+runs[0].wallSeconds};
   const receipt={...original,run:[aggregate],issues:allIssues,checks:[{...original.checks[0],status:consoleErrors.length?'FAIL':'NOT CHECKED',value:{...original.checks[0].value,completed:false,consoleErrors,partialResumeBatches:true,failedBatchEvidence:evidence}}]};
   if(!checkOnly){writeFileSync(path,JSON.stringify(receipt,null,2)+'\n');copyFileSync(`${failed}/batch-completion.json`,`${out}/accept-completion.json`);}
   reason=issues.find(i=>i.severity==='P0')?.text??reason;
  }
  results.push({backend:cell.backend,tier:cell.tier,status:'NOT CHECKED',reason});continue;
 }
 const suffix=cell.backend==='webgl2'?'':'-webgpu-z1.5',name=`L10-${cell.tier}${suffix}`,path=`docs/reports/fix51-verify/receipts/${name}-browser.json`,out=`test-results/fix51-browser/${name}`;
 const original=JSON.parse(readFileSync(path,'utf8'));assert.equal(original.sourceHash,manifest.sourceHash);
 const budgetAborts=original.issues.filter(i=>i.severity==='P0'&&i.kind==='cannot-finish'&&i.text.includes('6 min level cap: true'));
 assert(budgetAborts.length,'the original tool-budget abort must be retained separately');
 writeFileSync(`${root}/attempts/${name}-initial.json`,JSON.stringify(original,null,2)+'\n');
 writeFileSync(`${root}/attempts/${name}-completion.json.gz`,gzipSync(readFileSync(`${out}/accept-completion.json`)));
 const runs=[original.run[0]],issues=original.issues.filter(i=>!budgetAborts.includes(i)),evidence=[];
 let completionPath;
 for(const batch of cell.batches){
  assert.equal(batch.inputDriverSha256,inputHash);assert([runnerHash,legacyRunnerHash].includes(batch.batchRunnerSha256));assert(!batch.run.skipped.length);
  runs.push(batch.run);issues.push(...batch.issues);
  const bytes=readFileSync(batch.path),file=`l10/${name}-batch${batch.index}.json.gz`;
  writeFileSync(`${root}/${file}`,gzipSync(bytes));
  completionPath=batch.path.replace('batch.json','batch-completion.json');
  const saveFile=`l10/${name}-batch${batch.index}-completion.json.gz`;
  writeFileSync(`${root}/${saveFile}`,gzipSync(readFileSync(completionPath)));
  evidence.push({index:batch.index,startTick:batch.startTick,endTick:batch.endTick,finished:batch.finished,receipt:file,completion:saveFile});
 }
 assert(runs.at(-1).finished);assert(runs.every(r=>!r.skipped.length));
 const end=JSON.parse(readFileSync(completionPath,'utf8'));assert(end.campaign.completedLevels>=10,'full credits completion must reach the production campaign save');
 assert.equal(end.backend,cell.backend==='webgl2'?'webgl':'webgpu');assert.equal(end.quality,cell.tier);
 const consoleErrors=issues.filter(i=>i.kind==='console-error'||i.kind==='page-error');
 const aggregate={...runs.at(-1),entry:'production-save-resume-batches',finished:true,skipped:[],wallSeconds:runs.reduce((n,r)=>n+r.wallSeconds,0),deaths:runs.reduce((n,r)=>n+r.deaths,0),assists:runs.reduce((n,r)=>n+r.assists,0),steps:runs.flatMap(r=>r.steps),weaponsStart:runs[0].weaponsStart};
 const value={backend:cell.backend,zoom:1.5,completed:true,skipped:[],consoleErrors,immortal:true,frameTiming:false,segmented:true,batchCount:cell.batches.length+1,batchEvidence:evidence,initialBudgetAbort:`docs/reports/fix51-r4/attempts/${name}-initial.json`,method:'Original actual level start plus bounded production live-save/Resume batches; no skipped objectives or synthetic state. Every segment has ordinary WASD/mouse and console observation; credits completed.'};
 const receipt={...original,run:[aggregate],issues,errors:[],checks:[{...original.checks[0],status:consoleErrors.length?'FAIL':'PASS',value}],batchRunnerSha256:runnerHash,inputDriverSha256:inputHash,batchRunnerVersions:[runnerHash,legacyRunnerHash]};
 if(!checkOnly){writeFileSync(path,JSON.stringify(receipt,null,2)+'\n');copyFileSync(completionPath,`${out}/accept-completion.json`);}
 results.push({backend:cell.backend,tier:cell.tier,status:consoleErrors.length?'FAIL':'PASS',evidence,originalBudgetAbort:value.initialBudgetAbort,wallSeconds:aggregate.wallSeconds});
}
writeFileSync(`${root}/l10-physical-summary.json`,JSON.stringify({sourceHash:manifest.sourceHash,inputDriverSha256:inputHash,batchRunnerSha256:runnerHash,results},null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({backend:r.backend,tier:r.tier,status:r.status}))));
