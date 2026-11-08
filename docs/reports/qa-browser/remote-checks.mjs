/** CPU/build work executes only inside the admitted remote job. */
import { spawnSync } from 'node:child_process';
import { mkdirSync,writeFileSync } from 'node:fs';
const out='docs/reports/qa-browser/remote';mkdirSync(out,{recursive:true});const rows=[];
// The runner's sync cache has an index but no HEAD; native provenance needs a real disposable snapshot.
spawnSync('git',['add','-A']);const snapshot=spawnSync('git',['-c','user.name=Browser QA','-c','user.email=qa@local.invalid','commit','--allow-empty','-m','Disposable remote QA source snapshot'],{encoding:'utf8'});
const remoteSnapshot=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
for(const [name,args] of [['typecheck',['run','typecheck']],['lint',['run','lint']],['build',['run','build:qa']],['L10-accept',['run','qa:accept','--','--level','L10','--skip-browser']]]){
 const start=Date.now();const run=spawnSync('npm',args,{encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,QA_ACCEPT_ROOT:'docs/reports/qa-browser/l10-native',MI_BUILD_CACHE:'off',VITEST_MAX_WORKERS:'1'}});
 writeFileSync(`${out}/${name}.log`,`${run.stdout??''}${run.stderr??''}`);rows.push({name,exit:run.status,error:run.error?.message,wallSeconds:(Date.now()-start)/1000});
 writeFileSync(`${out}/receipt.json`,JSON.stringify({sourceCommit:process.env.QA_SOURCE_COMMIT,remoteSnapshot,snapshotExit:snapshot.status,rows},null,2));console.log(name,run.status,(Date.now()-start)/1000);
}
