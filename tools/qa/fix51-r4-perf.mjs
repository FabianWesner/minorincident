/** Compact the lane's four quiet L4 A/B cells without retaining captures. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root='docs/reports/fix51-r4', rows=[], samples=[], raw=[];
mkdirSync(`${root}/perf`,{recursive:true});
const round=n=>Math.round(n*10)/10;
for(const backend of ['webgpu','webgl2'])for(const tier of ['low','high']){
 const base=`test-results/fix51-r4/perf/${backend}-${tier}`, loadsPath=`${base}/loads/L4.json`, framesPath=`${base}/strips/${backend}/L4.json`;
 if(!existsSync(loadsPath)||!existsSync(framesPath)){rows.push({backend,tier,status:'NOT CHECKED',reason:'Missing quiet sample'});continue;}
 const loads=JSON.parse(readFileSync(loadsPath,'utf8')), frames=JSON.parse(readFileSync(framesPath,'utf8'));
 const cell={backend,tier};let valid=true;
 for(const [side,prefix]of [['prod','prod'],['candidate','candidate']]){
  const timed=frames.find(r=>r.side===side&&r.tier===tier&&!r.diagnostic&&!r.failure&&!r.errors.length);
  assert(timed,`${backend}/${tier}/${side}: missing unprofiled complete hold`);
  assert.equal(timed.performance.nonGameplayFrames,0);assert(timed.performance.durationMs>=60000);
  assert(timed.samples.length&&timed.samples.every(s=>s.scenario==='L4'&&s.backend===(backend==='webgl2'?'webgl':'webgpu')&&s.quality===tier));
  assert(timed.nativeBeat?.state.l4.turnAt>0);assert(timed.samples.every(s=>!s.loading));
  const menu=['cold','warm'].map(temperature=>loads.find(r=>r.side===side&&r.temperature===temperature));
  assert(menu.every(r=>r&&r.backend===backend&&r.tier===tier&&!r.errors.length&&r.quality===tier&&r.contexts.includes(backend==='webgl2'?'webgl2':'webgpu')));
  cell[`${prefix}LoadSeconds`]=menu.map(r=>r.ms/1000);
  cell[`${prefix}P95`]=timed.performance.p95Ms;cell[`${prefix}Max`]=timed.performance.maxMs;
  const hist={};for(const ms of timed.performance.frames){const bin=round(ms).toFixed(1);hist[bin]=(hist[bin]??0)+1;}
  const spikes=timed.performance.frames.map((ms,i)=>({frame:i,ms})).filter(s=>s.ms>=66);
  samples.push({side,backend,tier,measuredAt:timed.measuredAt,hardware:timed.hardware,nativeBeatTick:timed.nativeBeat.tick,nativePhase:timed.nativeBeat.state.l4.phase,durationMs:timed.performance.durationMs,frameCount:timed.performance.frames.length,nonGameplayFrames:timed.performance.nonGameplayFrames,p95Ms:timed.performance.p95Ms,maxMs:timed.performance.maxMs,histogram:hist,spikes,lateBuilds:timed.performance.builds,aliveRange:[Math.min(...timed.samples.map(s=>s.alive)),Math.max(...timed.samples.map(s=>s.alive))],drawnRange:[Math.min(...timed.samples.map(s=>s.drawn)),Math.max(...timed.samples.map(s=>s.drawn))],consoleErrors:timed.errors,images:timed.images});
 }
 cell.checks={cold:cell.candidateLoadSeconds[0]<=6&&cell.candidateLoadSeconds[0]<=cell.prodLoadSeconds[0]+.5,warm:cell.candidateLoadSeconds[1]<=6&&cell.candidateLoadSeconds[1]<=cell.prodLoadSeconds[1]+.5,p95:round(cell.candidateP95)<=round(cell.prodP95)+1,max:round(cell.candidateMax)<=round(cell.prodMax)+16.8,noNew66msSpike:cell.candidateMax<66};
 cell.status=valid&&Object.values(cell.checks).every(Boolean)?'PASS':'FAIL';rows.push(cell);
 for(const path of [loadsPath,framesPath]){const bytes=readFileSync(path), name=`${backend}-${tier}-${path===loadsPath?'loads':'frames'}.json.gz`;writeFileSync(`${root}/perf/${name}`,gzipSync(bytes));raw.push({source:path,receipt:`perf/${name}`,sha256:createHash('sha256').update(bytes).digest('hex')});}
}
writeFileSync(`${root}/perf-summary.json`,JSON.stringify({generatedAt:new Date().toISOString(),rules:{coldAndWarmSeconds:6,maxLoadRegressionSeconds:.5,maxP95RegressionMs:1,maxRelative60HzFrames:1,newSpikeFailureMs:66,accepted50msQuantization:true},method:'Exclusive quiet-run, 1280x720 DPR1, headless native Metal, seed1, ordinary native hold InputFrames, survival protection; one cold/warm load and one unprofiled 60s sample per side/cell. No counts changed. Single samples, not device certification.',rows,samples,raw},null,2)+'\n');
console.log(JSON.stringify(rows));
process.exitCode=rows.some(r=>r.status==='FAIL')?1:rows.some(r=>r.status==='NOT CHECKED')?2:0;
