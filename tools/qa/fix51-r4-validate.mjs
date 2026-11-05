/** Record repository gates against the exact final QA tool files. */
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {provenance} from './accept/probe.ts';
import {fixtureHash} from './accept/fixtures.ts';
import {checkpointHash} from './accept/checkpoints.ts';
const root='docs/reports/fix51-verify/validation';mkdirSync(root,{recursive:true});
const runs=[];
for(const [command,args,file]of [['npx',['tsc','--noEmit'],'typecheck.log'],['npm',['run','lint'],'lint.log'],['npm',['test'],'test.log']]){
 const started=Date.now(),r=spawnSync(command,args,{encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024});
 const log=`${root}/${file}`;const output=((r.stdout??'')+(r.stderr??'')+(r.error?String(r.error):'')).trimEnd();writeFileSync(log,output+(output?'\n':''));
 runs.push({command:[command,...args].join(' '),exitCode:r.status,signal:r.signal,seconds:(Date.now()-started)/1000,log});
 console.log(JSON.stringify(runs.at(-1)));if(r.status!==0)break;
}
const hash=createHash('sha256');for(const path of ['tools/qa/accept.ts','tools/playtest/session.ts',...readdirSync('tools/qa/accept').filter(p=>p.endsWith('.ts')).map(p=>`tools/qa/accept/${p}`)].sort())hash.update(path).update(readFileSync(path));
const result={...provenance(),fixtureHash:fixtureHash(),checkpointHash:checkpointHash(),qaToolHash:hash.digest('hex'),generatedAt:new Date().toISOString(),runs,pass:runs.length===3&&runs.every(r=>r.exitCode===0)};
writeFileSync('docs/reports/fix51-verify/validation.json',JSON.stringify(result,null,2)+'\n');
writeFileSync('docs/reports/fix51-r4/gates/static-results.json',JSON.stringify(result,null,2)+'\n');
process.exitCode=result.pass?0:1;
