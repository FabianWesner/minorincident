import{spawnSync}from'node:child_process';import{readFileSync,mkdirSync}from'node:fs';import{resolve}from'node:path';
import{mergeBrowserBatches}from'/Users/wesner/Workspace/minorincident/.claude/worktrees/final-g/tools/qa/accept/browser-chain.ts';import{atomicJson}from'/Users/wesner/Workspace/minorincident/.claude/worktrees/final-g/tools/qa/accept/report.ts';
const read=p=>JSON.parse(readFileSync(p));const batches=[1,2].map(n=>({path:`docs/reports/final-g/G-25-L10-high-batch${n}.json`,receipt:read(`docs/reports/final-g/G-25-L10-high-batch${n}.json`)}));
let resumeFrom=batches.at(-1).receipt.batch.savePath;
for(let batchIndex=3;batchIndex<=8;batchIndex++){
 const out=resolve(`test-results/final-g/L10-high/batch${batchIndex}-retry`),path=`docs/reports/final-g/G-25-L10-high-batch${batchIndex}-retry.json`;mkdirSync(out,{recursive:true});
 const options={level:'L10',tier:'high',origin:'http://127.0.0.1:4993',out,path,sourceHash:batches[0].receipt.sourceHash,browserHash:batches[0].receipt.browserHash,backend:'webgl2',zoom:1.5,batchIndex,resumeFrom};
 const run=spawnSync(process.execPath,['--import','tsx/esm','tools/qa/accept/browser-worker.ts',JSON.stringify(options)],{stdio:'inherit',env:{...process.env,BROWSER_POOL_JOB_ID:'final-g',PLAYTEST_GOD:'1',PLAYTEST_BACKEND:'webgl2',PLAYTEST_NO_FRAME_TIMING:'1',PLAYTEST_FRAME_GATE:'0',PLAYTEST_CPU_PROFILE:'0',PLAYTEST_ACCEPTANCE_LEDGER:'0',PLAYTEST_ACCEPTANCE_CAPTURES:'0',PLAYTEST_REVEAL_AUDIT:'1',QA_ACCEPT_KEEP_CAPTURES:'1'}});
 const receipt=read(path);batches.push({path,receipt});if(run.status!==0||receipt.errors.length||!receipt.batch?.yielded||!receipt.batch.savePath||receipt.issues.some(i=>['console-error','page-error','cannot-finish'].includes(i.kind)))break;resumeFrom=receipt.batch.savePath;
}
const dest='docs/reports/final-g/G-25-L10-high.json',merged=mergeBrowserBatches(batches,dest);atomicJson(dest,merged);atomicJson('docs/reports/fix51-verify/receipts/L10-high-webgl2-z1.5-browser.json',merged);console.log('high finale merged',merged.checks,merged.errors);

const out=resolve('test-results/final-g/L9-high-countryside'),path='docs/reports/final-g/G-25-L9-high-countryside.json';mkdirSync(out,{recursive:true});
const options={level:'L9',tier:'high',origin:'http://127.0.0.1:4993',out,path,sourceHash:batches[0].receipt.sourceHash,browserHash:batches[0].receipt.browserHash,backend:'webgl2',zoom:1.5};
spawnSync(process.execPath,['--import','tsx/esm','tools/qa/accept/final-g-l9-worker.ts',JSON.stringify(options)],{stdio:'inherit',env:{...process.env,BROWSER_POOL_JOB_ID:'final-g',PLAYTEST_GOD:'1',PLAYTEST_BACKEND:'webgl2',PLAYTEST_NO_FRAME_TIMING:'1',PLAYTEST_FRAME_GATE:'0',PLAYTEST_CPU_PROFILE:'0',PLAYTEST_ACCEPTANCE_LEDGER:'1',PLAYTEST_ACCEPTANCE_CAPTURES:'1',PLAYTEST_ACCEPTANCE_CAPTURE_TIERS:'single',PLAYTEST_REVEAL_AUDIT:'1',QA_ACCEPT_KEEP_CAPTURES:'1'}});
const alternate=read(path);if(alternate.checks.some(c=>c.value?.completed||c.status==='FAIL'))atomicJson('docs/reports/fix51-verify/receipts/L9-high-webgl2-z1.5-browser.json',alternate);console.log('high remaining cells terminal',alternate.checks,alternate.errors);
