import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const beforeRoot=process.argv[2], afterRoot=process.argv[3];
if(!beforeRoot||!afterRoot)throw new Error('Pass the reference and lane scene output directories');
const collect=root=>Object.fromEntries(readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()).flatMap(d=>{
 try { const metrics=JSON.parse(readFileSync(join(root,d.name,'metrics.json'),'utf8'));return [[d.name,{pass:metrics.checks.pass,frames:metrics.frames,backend:metrics.backend,tier:metrics.actualTier,checks:metrics.checks.checks.map(c=>({name:c.name,pass:c.pass})),capture:createHash('sha256').update(readFileSync(join(root,d.name,'sheet.jpg'))).digest('hex')}]]; }
 catch(error){if(error.code==='ENOENT')return [];throw error;}
}));
const before=collect(resolve(beforeRoot)),after=collect(resolve(afterRoot));
const names=[...new Set([...Object.keys(before),...Object.keys(after)])].sort();
const rows=names.map(name=>({name,before:before[name],after:after[name],identical:JSON.stringify(before[name])===JSON.stringify(after[name])}));
const scenes=[...new Set(names.map(n=>n.split('@')[0]))];
const result={scenes:scenes.length,beforeRows:Object.keys(before).length,afterRows:Object.keys(after).length,passedBefore:Object.values(before).filter(r=>r.pass).length,passedAfter:Object.values(after).filter(r=>r.pass).length,identical:rows.filter(r=>r.identical).length,rows};
writeFileSync('test-results/code-seams-2/scenes-comparison.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,rows:rows.filter(r=>!r.identical).map(r=>({name:r.name,before:!!r.before,after:!!r.after,hash:r.before?.capture===r.after?.capture,pass:r.before?.pass===r.after?.pass}))}));
if(result.scenes!==10||result.beforeRows!==56||result.afterRows!==56||result.identical!==56)process.exitCode=1;
