/** Bounded physical routes, one pooled context at a time per quality process. */
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
import {atomicJson} from './report.ts';
import {mergeBrowserBatches} from './browser-chain.ts';
const [tier,start='1',end='10',label='']=process.argv.slice(2);
if(!['low','high'].includes(tier))throw Error('Expected low|high [start level] [end level]');
for(let n=Number(start);n<=Number(end);n++){
 const level=`L${n}`,suffix=label?`-${label}`:'',path=`docs/reports/final-g/G-25-${level}-${tier}${suffix}.json`,out=resolve(`test-results/final-g/${level}-${tier}${suffix}`),identity=provenance();
 mkdirSync(out,{recursive:true});
 const base={level,tier,origin:'http://127.0.0.1:4993',out,path,sourceHash:identity.sourceHash,browserHash:browserHash(),backend:'webgl2',zoom:1.5},batches=[];
 let resumeFrom;
 for(let batchIndex=1;batchIndex<=(n===10?8:1);batchIndex++){
  const options=n===10?{...base,batchIndex,resumeFrom,out:resolve(out,`batch${batchIndex}`),path:path.replace('.json',`-batch${batchIndex}.json`)}:base;mkdirSync(options.out,{recursive:true});
  const r=spawnSync(process.execPath,['--import','tsx/esm','tools/qa/accept/browser-worker.ts',JSON.stringify(options)],{stdio:'inherit',env:{...process.env,BROWSER_POOL_JOB_ID:'final-g',PLAYTEST_GOD:'1',PLAYTEST_BACKEND:'webgl2',PLAYTEST_NO_FRAME_TIMING:'1',PLAYTEST_FRAME_GATE:'0',PLAYTEST_CPU_PROFILE:'0',PLAYTEST_ACCEPTANCE_LEDGER:'1',PLAYTEST_ACCEPTANCE_CAPTURES:'1',PLAYTEST_ACCEPTANCE_CAPTURE_TIERS:'single',PLAYTEST_REVEAL_AUDIT:'1',QA_ACCEPT_KEEP_CAPTURES:'1',...(n===7?{PLAYTEST_L7_ESCORT_ROUTE:'1'}:{}),...(n===5?{PLAYTEST_L5_TOUR:'1'}:{})}});
  if(!existsSync(options.path))throw Error(`Worker has no receipt: ${level}/${tier}/${batchIndex}`);
  const receipt=JSON.parse(readFileSync(options.path));batches.push({path:options.path,receipt});
  if(r.status!==0||receipt.errors.length||!receipt.batch?.yielded||!receipt.batch.savePath||receipt.issues.some(i=>['console-error','page-error','cannot-finish'].includes(i.kind)))break;
  resumeFrom=receipt.batch.savePath;
 }
 const receipt=n===10?mergeBrowserBatches(batches,path):batches[0].receipt;
 if(n===10)atomicJson(path,receipt);
 atomicJson(`docs/reports/fix51-verify/receipts/${level}-${tier}-webgl2-z1.5-browser.json`,receipt);
 console.log(JSON.stringify({completedCell:`${level}/${tier}`,checks:receipt.checks,errors:receipt.errors}));
}
