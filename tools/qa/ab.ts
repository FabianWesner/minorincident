import { chromium, type Page } from '@playwright/test';
import { preview } from 'vite';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { debugCampaign, type Level } from '../../src/sim/progression/Campaign';
import { crossing } from '../../src/levels/L9/district';
import { cure } from '../../src/levels/L10/district';
import { prepareStop, readyFrame, tour, type Finding, type TourStop } from './ab-tour';
import { perceptualDiff } from './ab-metrics';

const {values}=parseArgs({options:{baseline:{type:'string',default:'https://minor-incident.com'},candidate:{type:'string'},'dist-dir':{type:'string',default:'dist'},inject:{type:'string'},levels:{type:'string',default:'L1-L10'},threshold:{type:'string',default:'.02'},out:{type:'string'},seed:{type:'string',default:'1'},stops:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('npm run qa:ab -- --candidate <url|dist> [--baseline <url>] [--levels L1-L4] [--threshold .02] [--out docs/reports/qa-ab/<date>-<label>] [--seed 1] [--stops substring[,substring]] [--dist-dir dist] [--inject hide-npc|hats|tank|bench|all]');process.exit(0);}
if(!values.candidate)throw new Error('--candidate <url|dist> is required');
if(values.inject&&(!['hide-npc','hats','tank','bench','all'].includes(values.inject)||values.candidate!=='dist'))throw new Error('--inject requires candidate dist and hide-npc|hats|tank|bench|all');
const threshold=Number(values.threshold),seed=Number(values.seed);
if(!Number.isFinite(threshold)||threshold<=0||threshold>1)throw new Error('--threshold must be a fraction between 0 and 1');
if(!Number.isSafeInteger(seed)||seed<0)throw new Error('--seed must be a nonnegative integer');
const levels=[...new Set(values.levels!.split(',').flatMap(part=>{
  const match=/^L(10|[1-9])(?:-L(10|[1-9]))?$/.exec(part.trim());
  if(!match||Number(match[2]??match[1])<Number(match[1]))throw new Error(`Invalid level selection: ${part}`);
  return Array.from({length:Number(match[2]??match[1])-Number(match[1])+1},(_,i)=>`L${Number(match[1])+i}`);
}))];
const stops=tour.filter(s=>levels.includes(s.level)&&(!values.stops||values.stops.split(',').some(part=>s.id.includes(part.trim()))));
if(!stops.length)throw new Error('No matching tour stops');
const sources={baseline:values.baseline!,candidate:values.candidate};
for(const source of Object.values(sources))if(source!=='dist'&&!/^https?:\/\//.test(source))throw new Error(`Expected an HTTP(S) URL or dist: ${source}`);
const startedAt=new Date().toISOString(),output=resolve(values.out??`docs/reports/qa-ab/${startedAt.slice(0,10)}-${startedAt.slice(11,19).replaceAll(':','')}`);
if(existsSync(resolve(output,'summary.json')))throw new Error(`Report already exists: ${output}. Choose a new --out.`);
mkdirSync(output,{recursive:true});const raw=resolve('test-results/qa-ab',basename(output),'captures');mkdirSync(raw,{recursive:true});
const variants=stops.flatMap(stop=>[1.5,1].map(zoom=>({stop,zoom,id:`${stop.id}-z${zoom}`})));
const captures=new Map<string,{proof:Awaited<ReturnType<typeof prepareStop>>;frames:Awaited<ReturnType<typeof readyFrame>>[];hashes:string[]}>();
const errors:{side:string;stop:string;message:string}[]=[],builds:Record<string,unknown>={};
type Row={id:string;stop:TourStop;zoom:number;score:number;globalChanged:number;frames:{frame:number;seconds:number;score:number;globalChanged:number;box:{x:number;y:number;width:number;height:number}}[];sheet:string;baseline:unknown;candidate:unknown};
const rows:Row[]=[];
let server:Awaited<ReturnType<typeof preview>>|undefined;
if(Object.values(sources).includes('dist')){
  if(!existsSync(resolve(values['dist-dir']!,'index.html')))throw new Error('Build the local candidate first: npm run build');
  server=await preview({configFile:false,build:{outDir:resolve(values['dist-dir']!)},preview:{host:'127.0.0.1',port:4201,strictPort:true}});
}
const browser=await chromium.launch({headless:true,args:process.platform==='darwin'?['--use-angle=metal','--enable-gpu','--enable-unsafe-webgpu','--ignore-gpu-blocklist']:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu','--ignore-gpu-blocklist']}).catch(async error=>{await server?.close();throw error;});
function sourceUrl(source:string){const u=new URL(source==='dist'?'http://127.0.0.1:4201':source);for(const [key,value]of Object.entries({test:'1',scenelab:'1',profile:'1',dpr:'1',quality:'low',audio:'muted',preload:'0',seed:String(seed)}))u.searchParams.set(key,value);return u.toString();}
function escape(value:unknown){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function report(status:'running'|'complete'|'failed'){
  rows.sort((a,b)=>b.score-a.score);
  const findingIds:Finding[]=['depot-clerk','lab-handover','hats-glasses','sitters-benches','l3-gaps','l4-tank'];
  const findings=findingIds.map(id=>{const relevant=rows.filter(r=>r.stop.findings?.includes(id));return{id,measured:relevant.length>0,score:Math.max(0,...relevant.map(r=>r.score)),aboveThreshold:relevant.some(r=>r.score>=threshold),stops:relevant.map(r=>r.id)};});
  const imageBytes=readdirSync(output).filter(p=>p.endsWith('.jpg')).reduce((n,p)=>n+statSync(resolve(output,p)).size,0);
  const summary={schemaVersion:1,status,startedAt,finishedAt:status==='running'?null:new Date().toISOString(),sources,builds,localDist:Object.values(sources).includes('dist')?resolve(values['dist-dir']!):null,injection:values.inject??null,settings:{backend:'webgpu',quality:'low',viewport:[1280,720],dpr:1,seed,zoom:[1.5,1],vfx:false,earlyLevelSave:'L10-default'},metric:{name:'maximum local perceptual changed coverage',tilePixels:48,colorThreshold:.15,frameOffsetsSeconds:[0,.6,1.2,1.8,2.4,3],threshold},expectedStops:variants.length,measuredStops:rows.length,imageBytes,aboveThreshold:rows.filter(r=>r.score>=threshold).map(r=>({id:r.id,score:r.score,sheet:r.sheet})),findings,categoryCoverage:{aboveThreshold:findings.filter(f=>f.aboveThreshold).length,measured:findings.filter(f=>f.measured).length,total:findings.length},errors,stops:rows};
  writeFileSync(resolve(output,'summary.json'),JSON.stringify(summary,null,2));
  const cards=rows.map(r=>`<article><h2>${escape(r.stop.title)} · zoom ${r.zoom} · ${(r.score*100).toFixed(2)}% ${r.score>=threshold?'— REVIEW':'— quiet'}</h2><p>${escape(r.id)} · global change ${(r.globalChanged*100).toFixed(3)}%</p><a href="${r.sheet}"><img loading="lazy" src="${r.sheet}" alt="Baseline, candidate and diff; still plus six-frame motion strip"></a></article>`).join('\n');
  writeFileSync(resolve(output,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>Visual A/B ${escape(basename(output))}</title><style>body{font:15px system-ui;background:#17191c;color:#eee;margin:24px}article{padding:16px;margin:20px 0;background:#25282d}img{max-width:100%;width:960px}a{color:#a8d9ff}h2{font-size:18px}p{overflow-wrap:anywhere}</style><h1>Visual A/B · ${escape(status)}</h1><p>Baseline: ${escape(sources.baseline)}<br>Candidate: ${escape(sources.candidate)}<br>WebGPU · low · 1280×720 · DPR 1 · seed ${seed} · threshold ${(threshold*100).toFixed(2)}%</p><p>${rows.length}/${variants.length} stops measured; ${summary.aboveThreshold.length} require visual review. Scores flag change; a reviewer decides whether it is a regression.</p><p><a href="summary.json">JSON summary and setup evidence</a></p>${errors.map(e=>`<p>UNMEASURED: ${escape(e.side)} ${escape(e.stop)} — ${escape(e.message)}</p>`).join('')}${cards}</html>`);
  if(imageBytes>30_000_000)throw new Error(`Report exceeds the 30 MB image budget: ${imageBytes}`);
  return summary;
}
async function sheet(page:Page,id:string,images:Buffer[][],still:number){
  const data=images.map(row=>row.map(b=>`data:image/png;base64,${b.toString('base64')}`));
  const encoded=await page.evaluate(async({data,cap,still})=>{
    const rows=await Promise.all(data.map(row=>Promise.all(row.map(src=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;})))));
    let width=640,result='';
    do{
      const height=Math.round(width*720/1280),smallWidth=width/2,smallHeight=Math.round(smallWidth*720/1280),label=23,c=document.createElement('canvas');c.width=width*3;c.height=label+height+3*(smallHeight+label);const g=c.getContext('2d')!;
      g.fillStyle='#181a1e';g.fillRect(0,0,c.width,c.height);g.font='14px system-ui';g.fillStyle='#fff';['BASELINE','CANDIDATE','PERCEPTUAL DIFF'].forEach((s,i)=>g.fillText(`${s} / still t+${(still*.6).toFixed(1)} s`,i*width+6,16));
      rows[still].forEach((img,j)=>g.drawImage(img,j*width,label,width,height));
      for(let lane=0;lane<3;lane++){
        const y=label+height+lane*(smallHeight+label);g.fillStyle='#fff';g.fillText(['BASELINE MOTION','CANDIDATE MOTION','DIFF MOTION'][lane],6,y+16);
        rows.forEach((row,i)=>{g.drawImage(row[lane],i*smallWidth,y+label,smallWidth,smallHeight);g.fillStyle='rgba(0,0,0,.8)';g.fillRect(i*smallWidth,y+label,68,20);g.fillStyle='#fff';g.fillText(`+${(i*.6).toFixed(1)} s`,i*smallWidth+4,y+label+15);});
      }
      result=c.toDataURL('image/jpeg',.7);width-=64;
    }while(result.length*.75>cap&&width>=320);
    if(result.length*.75>cap)throw new Error('Unable to meet per-sheet image budget');return result.split(',')[1];
  },{data,still,cap:Math.floor(29_000_000/variants.length)});
  writeFileSync(resolve(output,`${id}.jpg`),Buffer.from(encoded,'base64'));
}
try{
  report('running');
  for(const side of ['baseline','candidate'] as const){
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
    try{
      const page=await context.newPage();page.setDefaultTimeout(180000);await page.addInitScript('globalThis.__name = fn => fn');
      const pageErrors:string[]=[];page.on('pageerror',error=>pageErrors.push(error.message));
      page.on('console',message=>{if(message.text().startsWith('[qa-ab]'))console.log(message.text());});
      await page.goto(sourceUrl(sources[side]),{waitUntil:'domcontentloaded',timeout:120000});
      await page.waitForFunction(()=>!!window.__SS__&&!!window.__SCENE__,null,{timeout:120000});
      await page.evaluate(async()=>{await window.__SS__!.ready;window.__SS__!.pause();});
      await page.addStyleTag({content:'#hud,.hud,.story-bubble,.mission-subtitle,[data-testid=mission-button],.telemetry-consent{visibility:hidden!important}'});
      const build=await page.evaluate(()=>({api:window.__SS__!.version,scripts:Array.from(document.scripts).map(s=>s.src).filter(Boolean)}));
      const entry=build.scripts.find(s=>/\/build\/index-/.test(s)),entryText=entry?await(await page.request.get(entry)).text():'';
      builds[side]={...build,commit:/Build:\s*([0-9a-f]{7,40})/.exec(entryText)?.[1]??'unknown'};
      const scratch=await context.newPage();
      for(const variant of variants){
        const {stop,zoom,id}=variant;console.log(`[${side}] ${id}: reaching ${stop.setup??stop.checkpoint??'start'}`);
        try{
          const save=debugCampaign(Number(stop.level.slice(1))<=4?10:Number(stop.level.slice(1)) as Level,null);save.settings.quality='low';save.seed=seed;
          let walkRoute:number[][]|undefined;
          if(stop.level==='L10'&&stop.checkpoint){
            const region=cure.regions.findIndex(r=>r.checkpoint===stop.checkpoint),target=cure.anchors[stop.checkpoint];
            if(!target)throw new Error(`Missing authored L10 checkpoint anchor ${stop.checkpoint}`);
            walkRoute=[...cure.regions.slice(0,region<0?cure.regions.length:region).flatMap(r=>r.route),target].map(p=>[...p]);
          }
          const proof=await page.evaluate(prepareStop,{stop,seed,save,zoom,driveRoute:crossing.routes.find(r=>r.id==='road')!.points,walkRoute});
          const frames:Awaited<ReturnType<typeof readyFrame>>[]=[],hashes:string[]=[];
          for(let frame=0;frame<6;frame++){
            const state=await page.evaluate(readyFrame,{target:proof.target,zoom,ticks:frame?36:0,injection:side==='candidate'?values.inject:undefined,stopId:stop.id,scriptedNpc:proof.l1?.clerkId??undefined});
            if(state.backend!=='webgpu'||state.quality!=='low')throw new Error(`Expected WebGPU/low, got ${state.backend}/${state.quality}`);
            if(Math.abs(state.camera.targetZoom-zoom)>.001)throw new Error(`Requested zoom ${zoom}, got ${state.camera.targetZoom}`);
            if(pageErrors.length)throw new Error(`Browser error: ${pageErrors.join('; ')}`);
            frames.push(state);const png=await page.screenshot({type:'png',animations:'disabled'});hashes.push(createHash('sha256').update(png).digest('hex'));writeFileSync(resolve(raw,`${id}-${side}-${frame}.png`),png);
          }
          captures.set(`${side}-${id}`,{proof,frames,hashes});
          if(side==='candidate'){
            const base=captures.get(`baseline-${id}`);if(!base)throw new Error('Baseline capture is missing');
            const results:Row['frames']=[],images:Buffer[][]=[];
            for(let frame=0;frame<6;frame++){
              const aPath=resolve(raw,`${id}-baseline-${frame}.png`),bPath=resolve(raw,`${id}-candidate-${frame}.png`),a=readFileSync(aPath),b=readFileSync(bPath),diff=perceptualDiff(a,b);
              results.push({frame,seconds:frame*.6,score:diff.score,globalChanged:diff.globalChanged,box:diff.box});images.push([a,b,diff.heatmap]);
            }
            const still=results.reduce((best,r)=>r.score>results[best].score?r.frame:best,0);
            await sheet(scratch,id,images,still);
            rows.push({id,stop,zoom,score:Math.max(...results.map(r=>r.score)),globalChanged:Math.max(...results.map(r=>r.globalChanged)),frames:results,sheet:`${id}.jpg`,baseline:base,candidate:{proof,frames,hashes}});
            for(const lane of ['baseline','candidate'])for(let frame=0;frame<6;frame++)rmSync(resolve(raw,`${id}-${lane}-${frame}.png`));
            report('running');console.log(`[score] ${id}: ${(Math.max(...results.map(r=>r.score))*100).toFixed(2)}%`);
          }
        }catch(error){errors.push({side,stop:id,message:error instanceof Error?error.message:String(error)});console.error(`[unmeasured] ${side} ${id}: ${errors.at(-1)!.message}`);report('running');}
      }
    }finally{await context.close();}
  }
  const summary=report(errors.length?'failed':'complete');console.log(JSON.stringify({report:output,status:summary.status,measured:summary.measuredStops,changed:summary.aboveThreshold.length,categoryCoverage:summary.categoryCoverage,imageBytes:summary.imageBytes},null,2));
  if(errors.length)process.exitCode=2;
}catch(error){errors.push({side:'runner',stop:'boot',message:error instanceof Error?error.message:String(error)});report('failed');throw error;}
finally{await browser.close();await server?.close();if(existsSync(raw)&&readdirSync(raw).length===0)rmdirSync(raw);}
