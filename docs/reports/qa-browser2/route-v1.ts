/** Bounded current-source campaign visual QA. One pooled browser per command. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { SceneSession, stopServer } from '../../../tools/scenelab/session';

const [level='L10', tier='low', backend='webgl2', profile='complete'] = process.argv.slice(2);
const tag=`${level}-${tier}-${backend}-${profile}`;
const root='docs/reports/qa-browser2';
const raw=`/private/tmp/qa-browser2/${tag}`;
mkdirSync(raw,{recursive:true});
const session=new SceneSession({backend:backend as 'webgl2'|'webgpu',tier:tier as 'low'|'high',seed:42,viewport:{width:1280,height:720},query:{ui:'1'}});
const receipt:any={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceTree:execFileSync('git',['rev-parse','HEAD:src'],{encoding:'utf8'}).trim(),level,tier,backend,profile,method:'Production bot, normal mortal simulation/mission flow, accelerated paused stepping. No actor/HP/mission edits. Paired game zoom captures. Presentation clock advances with each batch; no live performance or audio acceptance claim.',captures:[],timeline:[],events:[],errors:[]};
receipt.producerSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
receipt.workingSourceDiff=execFileSync('git',['diff','--','src'],{encoding:'utf8'});
const seen=new Set<string>();
const snapshot=()=>session.page.evaluate(()=>{
 const a=window.__SS__!,g=window.__SCENE__.game,w=g.world,m=w.missions?.state,p=w.entities.get(1),mega=w.megaPursuit?.entity();
 const title=document.querySelector('[data-testid="epilogue-title"]'),credits=document.querySelector('.credits-roll');
 return {tick:w.tick,level:w.scenario,phase:m?.phase,active:m&&Object.entries(m.steps).filter(([,s])=>s.status==='active').map(([id])=>id),checkpoint:m?.checkpoint,position:p&&{...p.transform},hp:p?.health.current,stats:m?.stats,caption:m?.subtitle?.text,objective:document.querySelector('[data-testid=objective-text]')?.textContent,camera:a.getState().render.camera,backend:a.perf().backend,quality:a.getState().render.quality,charge:m?.counters['charge-ticks'],mounted:w.mountedGun?.mounted,mega:mega&&{id:mega.id,hp:mega.health.current,at:{...mega.transform},hidden:mega.hidden,state:mega.infected?.state},epilogue:m?.epilogue&&{phase:m.epilogue.phase,phaseTicks:m.epilogue.phaseTicks},cure:m?.cureFront&&{elapsed:m.cureFront.elapsed,radius:m.cureFront.radius,affected:m.cureFront.affectedIds.length},l8:m?.l8&&{...m.l8,arenas:m.l8.arenas},l9:m?.l9,title:title?.getClientRects().length?title.textContent:null,credits:credits?.getClientRects().length?credits.textContent?.slice(0,1000):null,events:(window as any).__qaEvents.splice(0),nearby:w.infected?.active.filter(e=>e.health.current>0&&!e.hidden&&p&&Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z)<25).map(e=>({id:e.id,type:e.archetype,hp:e.health.current,at:{...e.transform},state:e.infected?.state})),perf:{draws:a.perf().drawCalls,triangles:a.perf().triangles,heap:a.perf().heapBytes},god:w.combat?.damage.god,driver:!!g.driver};
});
async function photo(label:string,state:any){
 label=label.replace(/[^a-zA-Z0-9_.-]/g,'-');if(seen.has(label))return;seen.add(label);
 for(const zoom of [1,1.5]){
  await session.page.evaluate(async z=>{window.__SS__!.camera.zoom(z);await window.__SS__!.screenshotReady();},zoom);
  const file=`${raw}/${String(receipt.captures.length).padStart(3,'0')}-${label}-z${zoom}.jpg`;
  await session.page.screenshot({path:file,type:'jpeg',quality:80});
  receipt.captures.push({file,label,requestedZoom:zoom,state:{...state,events:undefined,l8:undefined,l9:undefined},camera:await session.page.evaluate(()=>window.__SS__!.getState().render.camera),sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});
 }
 await session.page.evaluate(()=>window.__SS__!.camera.zoom(1.5));
 writeFileSync(`${root}/${tag}.json`,JSON.stringify(receipt));
}
const start=Date.now();
try{
 await session.open();await session.page.evaluate('window.__name=f=>f');
 await session.page.evaluate(async({level,tier,profile})=>{
  const a=window.__SS__!,g=window.__SCENE__.game;await a.loadLevel(level,{seed:42,progression:`${level}-default` as any});a.pause();a.settings.set({quality:tier as 'low'|'high'});a.camera.follow();a.camera.zoom(1.5);a.bot.start(profile as any);(window as any).__qaEvents=[];
  for(const name of ['dialogue.line','objective.completed','pickup.collected','checkpoint.set','player.died','mission.signal','infected.special','combat.kill','music.stinger'])g.world.events.on(name as any,e=>(window as any).__qaEvents.push({...e}));
 },{level,tier,profile});
 await session.page.addStyleTag({content:'#hud,.hud,.story-bubble,.mission-subtitle,[data-testid=mission-button]{visibility:visible!important}'});
 await session.page.evaluate(()=>{document.documentElement.dataset.sceneHud='1';document.querySelectorAll('#hud,.hud').forEach(n=>n.setAttribute('data-scene-hud',''));});
 if(await session.page.evaluate(()=>window.__SS__!.missions.state()?.phase==='briefing'))await session.page.getByTestId('mission-button').click({force:true});
 await session.page.evaluate(()=>window.__SS__!.pause());
 let lastActive='',lastRegion=-1,lastLog=-1000,lastEpi='',lastX=-1000,deaths=0,wasDead=false;
 const pendingSignals=new Set<string>();
 for(let i=0;i<14000&&Date.now()-start<510000;i++){
  const s=await snapshot();receipt.end=s;receipt.events.push(...s.events);
  if(s.quality!==tier)throw Error(`Requested ${tier}, actual ${s.quality}`);
  if(s.god)throw Error('Unexpected god mode');
  if(s.backend!==(backend==='webgl2'?'webgl':'webgpu'))throw Error(`Backend fallback ${s.backend}`);
  const key=s.active?.join('-')||s.phase;
  if(s.tick-lastLog>=300||key!==lastActive){receipt.timeline.push({...s,events:undefined,l8:undefined,l9:undefined});lastLog=s.tick;console.log(tag,s.tick,key,s.position?.x.toFixed(1),s.position?.z.toFixed(1),s.hp);}
  if(key!==lastActive){await photo(`step-${key}`,s);lastActive=key;}
  if(s.level!==level||s.phase==='result'||s.phase==='progression'){await photo('route-end',s);receipt.finished=true;break;}
  if(s.phase==='retry'||s.hp!<=0){if(!wasDead){await photo(`death-${++deaths}`,s);wasDead=true;}if(deaths>10){receipt.failure='Over ten deaths';break;}if(s.phase==='retry'){await session.page.getByTestId('mission-button').click({force:true});await session.page.evaluate(p=>{window.__SS__!.pause();window.__SS__!.bot.start(p as any);},profile);wasDead=false;}else await session.page.evaluate(()=>window.__SS__!.step(30));continue;}wasDead=false;
  for(const e of s.events){
   if(e.type==='pickup.collected')await photo(`find-${e.pickupId??e.actionId??e.item}`,s);
   if(e.type==='dialogue.line'&&(/L10\.(voss|ruiz|sam|courier)|L8\./.test(e.id)))await photo(`line-${e.id}`,s);
   if(e.type==='mission.signal'&&(/mega-phase|epilogue|l9-crash|l10-scare|l8-/.test(e.name)))pendingSignals.add(e.name);
   if(e.type==='infected.special'&&e.sourceId===s.mega?.id)await photo(`mega-${e.move??e.kind??'special'}`,s);
   if(e.type==='music.stinger'&&e.kind==='scare')await photo(`scare-warning-${Math.floor(s.position!.x/300)}`,s);
  }
  for(const name of pendingSignals){await photo(`signal-${name}`,s);pendingSignals.delete(name);}
  if(level==='L10'){
   const band=Math.floor((s.position!.x-500)/150);
   if(band>lastRegion&&s.position!.x<3900){await photo(`route-x${Math.round(s.position!.x)}`,s);lastRegion=band;}
   if(s.mounted)await photo(`mounted-charge-${Math.floor((s.charge??0)/1200)}`,s);
   if(s.mega&&!s.mega.hidden&&Math.hypot(s.position!.x-s.mega.at.x,s.position!.z-s.mega.at.z)<18)await photo(`mega-close-${Math.floor(s.position!.x/500)}`,s);
   if(s.epilogue){const e=s.epilogue.phase==='playable'?`playable-${Math.floor((s.cure?.elapsed??0)/300)}`:`${s.epilogue.phase}-${Math.floor(s.epilogue.phaseTicks/1800)}`;if(e!==lastEpi){await photo(`ending-${e}`,s);lastEpi=e;}}
  }
  if(level==='L8'){
   for(const a of s.l8?.arenas??[])await photo(`arena-${a.id}-phase-${a.phase}`,s);
  }
  if(Math.abs(s.position!.x-lastX)>=500){lastX=s.position!.x;await photo(`travel-${Math.round(lastX)}`,s);}
  const combat=s.nearby?.length||s.mounted||s.active?.includes('mega');
  const n=s.phase==='cinematic'||s.epilogue?30:combat?12:60;
  await session.page.evaluate(async n=>{const a=window.__SS__!,g=window.__SCENE__.game;await a.step(n);g.view.frame(n/60);},n);
 }
 if(!receipt.finished&&!receipt.failure)receipt.failure='510 second browser command bound reached';
 receipt.finalCampaign=await session.page.evaluate(()=>window.__SS__!.campaign.state());
}catch(e){receipt.errors.push(String(e));console.error(e);process.exitCode=1;try{receipt.errorState=await snapshot();receipt.failedCampaign=await session.page.evaluate(()=>window.__SS__!.campaign.state());await photo('runtime-error',receipt.errorState);}catch(captureError){receipt.errors.push(String(captureError));}}
finally{receipt.errors.push(...session.errors);receipt.wallSeconds=(Date.now()-start)/1000;writeFileSync(`${root}/${tag}.json`,JSON.stringify(receipt));await session.close();stopServer();console.log(JSON.stringify({tag,finished:receipt.finished,failure:receipt.failure,errors:receipt.errors,captures:receipt.captures.length,wallSeconds:receipt.wallSeconds}));}
