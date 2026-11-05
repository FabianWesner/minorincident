/** Two physical clients maximum; each child owns a bounded Resume batch. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
const hash='c2adff10dcd7013513129da3e9e04994d347bf0a61f6bfcf934e7a2274862f9e';
const deadline=process.env.FIX51_R4_BATCH_DEADLINE?Date.parse(process.env.FIX51_R4_BATCH_DEADLINE):Infinity;
if(Number.isNaN(deadline))throw new Error('FIX51_R4_BATCH_DEADLINE must be an ISO timestamp');
if(JSON.parse(readFileSync('dist/.qa-accept-build.json','utf8')).sourceHash!==hash)throw new Error('The lane replay requires the recorded merged-head build');
const ready=()=>['','-webgpu-z1.5'].every(suffix=>{const path=`docs/reports/fix51-verify/receipts/L10-high${suffix}-browser.json`;if(!existsSync(path))return false;const r=JSON.parse(readFileSync(path,'utf8'));return r.sourceHash===hash&&r.browserHash==='7a2150785003f1cb7ff212b5c9412e3124cc4023a4ae113e6ca6c00c62672a02'&&r.run?.length;});
while(!ready())await new Promise(r=>setTimeout(r,5000));
const cells=[];
const save=()=>writeFileSync('docs/reports/fix51-r4/l10-batches.json',JSON.stringify({sourceHash:hash,method:'Original full-level starts plus production save/Resume batches; at most two headless clients; <=480 seconds active per child and <=10minute reservation. Initial6minute budget aborts retained; completion requires credits and all objectives with no skips.',cells},null,2)+'\n');
for(const tier of ['low','high']){
 const current=['webgl2','webgpu'].map(backend=>({backend,tier,batches:[],finished:false,blocked:false}));cells.push(...current);save();
 for(let index=1;index<=4&&current.some(c=>!c.finished&&!c.blocked);index++){
  if(Date.now()>deadline){for(const c of current.filter(c=>!c.finished))c.blocked=true;save();break;}
  await Promise.all(current.filter(c=>!c.finished&&!c.blocked).map(c=>new Promise(resolve=>{
   const child=spawn(process.execPath,['--import','tsx','tools/qa/fix51-r4-l10-batch.mjs',c.backend,tier,String(index)],{stdio:'inherit'});
   child.once('exit',code=>{const path=`test-results/fix51-r4/l10-batches/${c.backend}-${tier}/${index}/batch.json`;if(code!==0||!existsSync(path)){c.blocked=true;c.error=`batch${index} exit${code}`;}else{const r=JSON.parse(readFileSync(path,'utf8'));c.batches.push({...r,path});c.finished=r.finished;c.blocked=r.issues.some(i=>i.severity==='P0');}save();resolve();});
  })));
 }
}
console.log(JSON.stringify(cells.map(c=>({backend:c.backend,tier:c.tier,finished:c.finished,blocked:c.blocked,batches:c.batches.length}))));
