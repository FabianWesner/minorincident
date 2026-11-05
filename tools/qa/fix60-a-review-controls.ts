/** Evidence-backed registration controls; temporary mutations are restored in finally. */
import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{readFileSync,writeFileSync,renameSync}from'node:fs';import{rowResult,sourceRows}from'./accept/report';
const controls: {row:string;test:string;pass:boolean}[]=[];
for(const id of ['L3-05','L3-14','L3-15']){
 const source=sourceRows().find(r=>r.id===id)!,path=`docs/qa/reviews/${id}.json`,bytes=readFileSync(path),original=JSON.parse(bytes.toString());
 const checks=JSON.parse(readFileSync('docs/reports/fix51-verify/L3.json','utf8')).rows.find((r:{id:string})=>r.id===id).checks;
 const status=()=>rowResult(source,checks).currentStatus;
 try{
  controls.push({row:id,test:'current exact review consumed',pass:status()===(id==='L3-15'?'FAIL':'PASS')});
  renameSync(path,path+'.control');try{controls.push({row:id,test:'missing review never passes',pass:status()!=='PASS'});}finally{renameSync(path+'.control',path);}
  writeFileSync(path,JSON.stringify({...original,commit:execFileSync('git',['rev-parse','db451f154'],{encoding:'utf8'}).trim()}));controls.push({row:id,test:'stale game-source review cannot pass',pass:status()!=='PASS'});
  writeFileSync(path,JSON.stringify({...original,status:'FAIL',clauses:original.clauses.map((c:object)=>({...c,verdict:'FAIL'}))}));controls.push({row:id,test:'failing decision fails',pass:status()==='FAIL'});
  writeFileSync(path,JSON.stringify({...original,evidence:original.evidence.map((e:object)=>({...e,sha256:'0'.repeat(64)}))}));let rejected=false;try{status();}catch{rejected=true;}controls.push({row:id,test:'corrupt evidence rejected',pass:rejected});
 }finally{writeFileSync(path,bytes);}
}
const source=sourceRows().find(r=>r.id==='L2-09')!,checks=JSON.parse(readFileSync('docs/reports/fix51-verify/L2.json','utf8')).rows.find((r:{id:string})=>r.id==='L2-09').checks;
controls.push({row:'L2-09',test:'both qualified independent trials compose',pass:rowResult(source,checks).currentStatus==='PASS'});
for(const clause of ['mortal aggressive axe lesson death','uninterrupted protected aggressive live census at10/90s'])for(const tier of ['low','high']){
 const reduced=checks.filter((c:{clause:string;tier:string})=>c.clause!==clause||c.tier!==tier);controls.push({row:'L2-09',test:`missing${tier}/${clause} cannot pass`,pass:rowResult(source,reduced).currentStatus!=='PASS'});
 const failed=checks.map((c:{clause:string;tier:string})=>c.clause===clause&&c.tier===tier?{...c,status:'FAIL'}:c);controls.push({row:'L2-09',test:`failing${tier}/${clause} fails`,pass:rowResult(source,failed).currentStatus==='FAIL'});
}
writeFileSync('docs/reports/fix60-a/review-registration-controls.json',JSON.stringify({controls},null,2)+'\n');assert(controls.every(c=>c.pass));console.log(controls.length,'controls pass');
