/** Interleaved empty-context L8 delivery A/B. The child uses launchBrowser from the shared pool.
 * Run only through tools/perf/quiet-run.sh, after other checks finish. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const out=process.argv[2] ?? 'test-results/followups-25/quiet-load';
const origins={before:process.env.L8_BEFORE_ORIGIN ?? 'http://127.0.0.1:4278',after:process.env.L8_AFTER_ORIGIN ?? 'http://127.0.0.1:4279'};
assert.ok(process.env.MI_BROWSER_POOL_EXCLUSIVE,'L8 acceptance needs quiet-run exclusive admission');
const rows:{variant:string;quality:string;run:number;ms:number;bytes:number;files:number;sampledAt:string;settingsQuality:string;adapter:unknown;errors:unknown[]}[]=[];
mkdirSync(out,{recursive:true});
for(let run=0;run<5;run++)for(const quality of ['high','low'])for(const variant of (run%2?['after','before']:['before','after']) as ('before'|'after')[]){
 const dir=`${out}/${quality}/${variant}/${run}`;
 const child=spawn(process.execPath,['--import','tsx','tools/perf/cold-load-time.ts',origins[variant],'webgpu',quality,'1','L8','0'],{env:{...process.env,LOAD_OUT:dir},stdio:['ignore','ignore','inherit']});
 assert.equal(await new Promise(resolve=>child.once('exit',resolve)),0,`${variant}/${quality}/${run}`);
 const sample=JSON.parse(readFileSync(`${dir}/L8-webgpu-${quality}-0.json`,'utf8'));
 assert.deepEqual(sample.errors,[]);assert.equal(sample.settingsQuality,quality);assert.ok(sample.contexts.includes('webgpu')&&!sample.adapter?.fallback);
 rows.push({variant,quality,run,ms:sample.ms,bytes:sample.resources.reduce((n:number,r:{bytes:number})=>n+r.bytes,0),files:sample.resources.length,sampledAt:sample.sampledAt,settingsQuality:sample.settingsQuality,adapter:sample.adapter,errors:sample.errors});
 writeFileSync(`${out}/samples.json`,JSON.stringify(rows,null,2)+'\n');console.log(`${variant}/${quality}/${run}: ${sample.ms.toFixed(1)} ms`);
}
const groups=[];
for(const quality of ['high','low'])for(const variant of ['before','after']){
 const samples=rows.filter(r=>r.variant===variant&&r.quality===quality),sorted=samples.map(s=>s.ms).sort((a,b)=>a-b);
 groups.push({variant,quality,n:samples.length,median:sorted[2],max:sorted[4],bytes:samples[0].bytes,files:samples[0].files});
}
const result={method:'quiet-run, shared native Metal WebGPU, fixed UI quality, interleaved same-host before/after, five empty contexts per tier/build, menu level click to loading-card closure; strict worst-of-five acceptance',batch24Ms:4211,limitMs:4211*1.1,groups,pass:groups.filter(g=>g.variant==='after').every(g=>g.max<=4211*1.1)};
writeFileSync(`${out}/summary.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
assert.ok(result.pass,'L8 worst-of-five exceeds batch24 +10%');
