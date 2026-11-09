/** Bounded current-source campaign visual QA. One pooled browser per command. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { SceneSession, stopServer } from '../../../tools/scenelab/session';

const [level='L10', tier='low', backend='webgl2', profile='complete'] = process.argv.slice(2);
const carried=process.env.QA_CAMPAIGN_INPUT?JSON.parse(readFileSync(process.env.QA_CAMPAIGN_INPUT,'utf8')):undefined;
const tag=`${level}-${tier}-${backend}-${profile}${process.env.QA_SUFFIX?`-${process.env.QA_SUFFIX}`:''}`;
const root='docs/reports/qa-browser2';
const raw=`/private/tmp/qa-browser2/${tag}`;
mkdirSync(raw,{recursive:true});
const session=new SceneSession({backend:backend as 'webgl2'|'webgpu',tier:tier as 'low'|'high',seed:Number(process.env.QA_SEED??42),viewport:{width:1280,height:720},query:{ui:'1'}});
const receipt:any={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceTree:execFileSync('git',['rev-parse','HEAD:src'],{encoding:'utf8'}).trim(),level,tier,backend,profile,method:'Production bot, normal mortal simulation/mission flow, accelerated paused stepping. No actor/HP/mission edits. Paired game zoom captures. Presentation clock advances with each batch; no live performance or audio acceptance claim.',captures:[],timeline:[],events:[],errors:[]};
receipt.producerSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
receipt.workingSourceDiff=execFileSync('git',['diff','--','src'],{encoding:'utf8'});
receipt.warnings=[];
if(process.env.QA_CAMPAIGN_INPUT)receipt.carriedInput={file:process.env.QA_CAMPAIGN_INPUT,sha256:createHash('sha256').update(readFileSync(process.env.QA_CAMPAIGN_INPUT)).digest('hex')};
const seen=new Set<string>();
const snapshot=()=>session.page.evaluate(()=>{
 const a=window.__SS__!,g=window.__SCENE__.game,w=g.world,m=w.missions?.state,p=w.entities.get(1),mega=w.megaPursuit?.entity();
 const title=document.querySelector('[data-testid="epilogue-title"]'),credits=document.querySelector('.credits-roll');
 const zoo=w.missions?.l8,l9=w.missions?.l9;
 return {tick:w.tick,level:w.scenario,phase:m?.phase,active:m&&Object.entries(m.steps).filter(([,s])=>s.status==='active').map(([id])=>id),checkpoint:m?.checkpoint,position:p&&{...p.transform},hp:p?.health.current,stats:m?.stats,caption:m?.subtitle?.text,objective:document.querySelector('[data-testid=objective-text]')?.textContent,camera:a.getState().render.camera,backend:a.perf().backend,quality:a.getState().render.quality,charge:m?.counters['charge-ticks'],mounted:w.mountedGun?.mounted,mega:mega&&{id:mega.id,hp:mega.health.current,at:{...mega.transform},hidden:mega.hidden,state:mega.infected?.state},epilogue:m?.epilogue&&{phase:m.epilogue.phase,phaseTicks:m.epilogue.phaseTicks},cure:m?.cureFront&&{elapsed:m.cureFront.elapsed,radius:m.cureFront.radius,affected:m.cureFront.affectedIds.length},l4:m?.l4,l5:m?.l5,l6:m?.l6,l7:w.l7Departure?.state,followers:[...w.entities.iterate()].filter(e=>e.civilian?.survivor?.mode==='follow').map(e=>({id:e.id,at:{...e.transform},hp:e.health.current,handProp:e.appearance?.handProp,ally:e.civilian?.ally,passengerOf:e.passengerOf})),l8:zoo&&{...zoo.state,rosterActors:zoo.roster().map(id=>{const e=w.entities.get(id);return{id,hp:e?.health.current,at:e?.transform,aboard:e?.passengerOf};})},l9:l9&&{...l9.state,driving:l9.driving.state},title:title?.getClientRects().length?title.textContent:null,credits:credits?.getClientRects().length?credits.textContent?.slice(0,1000):null,events:(window as any).__qaEvents.splice(0),nearby:w.infected?.active.filter(e=>e.health.current>0&&!e.hidden&&p&&Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z)<25).map(e=>({id:e.id,type:e.archetype,hp:e.health.current,at:{...e.transform},state:e.infected?.state})),perf:{draws:a.perf().drawCalls,triangles:a.perf().triangles,heap:a.perf().heapBytes},god:w.combat?.damage.god,driver:!!g.driver,botRunning:!!g.driver,activeVehicleId:w.vehicles?.active,vehicle:l9&&(()=>{const c=w.vehicles?.cars.get(l9.state.carId);return c&&{id:c.entity.id,at:{...c.entity.transform},hp:c.entity.health.current,speed:c.physics.speed,attached:c.entity.vehicle?.attached};})()};
});
async function photo(label:string,state:any){
 label=label.replace(/[^a-zA-Z0-9_.-]/g,'-');if(seen.has(label))return;seen.add(label);
 if(level==='L9'&&label==='crash-approach'&&!receipt.crashSave){const seed=await session.page.evaluate(()=>{window.__SS__!.campaign.save();return window.__SS__!.campaign.state();});const file=`${root}/${tag}-crash-save.json.gz`;writeFileSync(file,gzipSync(JSON.stringify(seed)));receipt.crashSave={file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')};}
 if(label==='step-release'){
  const seed=await session.page.evaluate(()=>{window.__SS__!.campaign.save();return window.__SS__!.campaign.state();});
  const file=`${root}/${tag}-release-save.json.gz`;writeFileSync(file,gzipSync(JSON.stringify(seed)));receipt.releaseSave={file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')};
 }
 for(const zoom of (level==='L4'?[.5,1,1.5]:[1,1.5])){
  await session.page.evaluate(async z=>{window.__SS__!.camera.zoom(z);await window.__SS__!.screenshotReady();},zoom);
  const file=`${raw}/${String(receipt.captures.length).padStart(3,'0')}-${label}-z${zoom}.jpg`;
  await session.page.screenshot({path:file,type:'jpeg',quality:80});
  const renderedWorld=await session.page.evaluate(()=>{const w=window.__SCENE__.game.world;return{level:w.scenario,tick:w.tick,phase:w.missions?.state.phase};});
  receipt.captures.push({file,label,requestedZoom:zoom,renderedWorld,state:{...state,events:undefined},camera:await session.page.evaluate(()=>window.__SS__!.getState().render.camera),sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});
  receipt.captures.at(-1).placeholders=await session.page.evaluate(()=>window.__SCENE__.game.view.labProbes().districts?.placeholderDraws()??[]);
 }
 await session.page.evaluate(()=>window.__SS__!.camera.zoom(1.5));
 writeFileSync(`${root}/${tag}.json`,JSON.stringify(receipt));
}
const start=Date.now();
try{
 await session.open();session.page.on('console',message=>{if(message.type()==='warning'&&/PLACEHOLDER|assets|asset.lod-fallback/.test(message.text()))receipt.warnings.push(message.text());});await session.page.evaluate('window.__name=f=>f');
 await session.page.evaluate(async({level,tier,profile,carried,seed})=>{
  const a=window.__SS__!,g=window.__SCENE__.game;if(carried)a.campaign.restore(carried);await a.loadLevel(level,{seed:carried?.seed??seed,...(carried?{}:{progression:`${level}-default` as any})});a.pause();a.settings.set({quality:tier as 'low'|'high'});a.camera.follow();a.camera.zoom(1.5);a.bot.start(profile as any);(window as any).__qaEvents=[];
  for(const name of ['dialogue.line','objective.completed','pickup.collected','checkpoint.set','player.died','mission.signal','infected.special','combat.kill','music.stinger'])g.world.events.on(name as any,e=>(window as any).__qaEvents.push({...e}));
 },{level,tier,profile,carried,seed:Number(process.env.QA_SEED??42)});
 // Remove Scene Lab's isolated-fixture hiding rule, preserving the real game's
 // own HUD and cinematic visibility rules.
 await session.page.evaluate(()=>{for(const style of document.querySelectorAll('style'))if(style.textContent?.includes('#hud:not([data-scene-hud])'))style.remove();});
 if(await session.page.evaluate(()=>window.__SS__!.missions.state()?.phase==='briefing'))await session.page.getByTestId('mission-button').click({force:true});
 await session.page.evaluate(()=>window.__SS__!.pause());
 let lastPhase='',lastActive='',lastRegion=-1,lastLog=-1000,lastEpi='',lastX=-1000,deaths=0,wasDead=false;
 const pendingSignals=new Set<string>();
 for(let i=0;i<14000&&Date.now()-start<Number(process.env.QA_BOUND_SECONDS??510)*1000;i++){
  const s=await snapshot();receipt.end=s;receipt.events.push(...s.events);
  if(s.quality!==tier)throw Error(`Requested ${tier}, actual ${s.quality}`);
  if(s.god)throw Error('Unexpected god mode');
  if(s.backend!==(backend==='webgl2'?'webgl':'webgpu'))throw Error(`Backend fallback ${s.backend}`);
  const key=s.active?.join('-')||s.phase;
  if(s.phase!==lastPhase){await photo(`phase-${s.phase}`,s);lastPhase=s.phase;}
  if(level==='L5'&&s.l5?.metroAt)await photo(`metro-sequence-${Math.floor((s.tick-s.l5.metroAt)/60)}`,s);
  if(level==='L7'&&s.l7&&s.l7.phase!=='waiting')await photo(`boarding-${s.l7.phase}-${Math.floor((s.tick-s.l7.startedAt)/60)}`,s);
  if(s.tick-lastLog>=300||key!==lastActive){receipt.timeline.push({...s,events:undefined,l8:undefined,l9:undefined});lastLog=s.tick;console.log(tag,s.tick,key,s.position?.x.toFixed(1),s.position?.z.toFixed(1),s.hp);}
  if(key!==lastActive){await photo(`step-${key}`,s);lastActive=key;}
  if(s.level!==level||s.phase==='result'||s.phase==='progression'){await photo('route-end',s);receipt.finished=true;break;}
  if(s.phase==='retry'||s.hp!<=0){if(!wasDead){await photo(`death-${++deaths}`,s);wasDead=true;}if(deaths>Number(process.env.QA_MAX_DEATHS??10)){receipt.failure=`Exceeded ${process.env.QA_MAX_DEATHS??10} observed-death bound`;break;}if(s.phase==='retry'){await session.page.getByTestId('mission-button').click({force:true});await session.page.evaluate(p=>{window.__SS__!.pause();window.__SS__!.bot.start(p as any);},profile);wasDead=false;}else await session.page.evaluate(()=>window.__SS__!.step(30));continue;}wasDead=false;
  for(const e of s.events){
   if(e.type==='pickup.collected')await photo(`find-${e.pickupId??e.actionId??e.item}`,s);
   if(e.type==='dialogue.line'&&(/L10\.(voss|ruiz|sam|courier)|L8\./.test(e.id)))await photo(`line-${e.id}`,s);
   if(e.type==='mission.signal'&&(/mega-phase|epilogue|l9-crash|l10-scare|l8-/.test(e.name)))pendingSignals.add(e.name);
   if(e.type==='infected.special'&&e.sourceId===s.mega?.id)await photo(`mega-${e.move??e.kind??'special'}`,s);
   if(e.type==='music.stinger'&&e.kind==='scare')await photo(`scare-warning-${Math.floor(s.position!.x/300)}`,s);
  }
  for(const name of pendingSignals){await photo(`signal-${name}`,s);pendingSignals.delete(name);}
  if(['L3','L4','L5','L6','L7'].includes(level))await photo(`progress-${Math.floor(s.tick/600)}`,s);
  if(level==='L4'&&s.tick===1949)await photo('truck-arrival-t1949',s);
  if(level==='L10'){
   const band=Math.floor((s.position!.x-500)/150);
   if(band>lastRegion&&s.position!.x<3900){await photo(`route-x${Math.round(s.position!.x)}`,s);lastRegion=band;}
   if(s.mounted)await photo(`mounted-charge-${Math.floor((s.charge??0)/1200)}`,s);
   if(s.mega&&!s.mega.hidden&&Math.hypot(s.position!.x-s.mega.at.x,s.position!.z-s.mega.at.z)<18)await photo(`mega-close-${Math.floor(s.position!.x/500)}`,s);
   if(s.epilogue){const e=s.epilogue.phase==='playable'?`playable-${Math.floor((s.cure?.elapsed??0)/300)}`:`${s.epilogue.phase}-${Math.floor(s.epilogue.phaseTicks/1800)}`;if(e!==lastEpi){await photo(`ending-${e}`,s);lastEpi=e;}}
  }
  if(level==='L8'){
   if(s.tick<3600)await photo(`tour-${Math.floor(s.tick/300)}`,s);
   for(const a of s.l8?.arenas??[])if(a.phase>0)await photo(`arena-${a.id}-phase-${a.phase}`,s);
   for(const a of s.l8?.arenas??[])if(a.phase===1)await photo(`arena-${a.id}-fight-${Math.floor((s.tick-a.startedAt)/600)}`,s);
   for(const t of [3600,3630,3660,3720])if(s.tick>=t)await photo(`breach-t${t}`,s);
   if(s.l8?.departureAt)await photo(`departure-${Math.floor((s.tick-s.l8.departureAt)/60)}`,s);
  }
  if(level==='L9'&&s.l9){
   const d=s.l9.driving;await photo(`crash-${s.l9.phase}`,s);
   for(const field of ['tankerFuseAt','tankerExploded','busReleased','busHitAt','busStoppedAt','gateAt','gateClosed','fenceBroken','hugAt','hugDone','evacuationDone'])if(d?.[field]&&d[field]!==-1000)await photo(`l9-${field}`,s);
   if(d?.jump)await photo(`jump-${d.jump.id}-${d.jump.airborne}`,s);
   if(s.l9.phase!=='driving')await photo(`crash-${s.l9.phase}-${Math.floor((s.tick-s.l9.startedAt)/30)}`,s);
  }
  if(Math.abs(s.position!.x-lastX)>=500){lastX=s.position!.x;await photo(`travel-${Math.round(lastX)}`,s);}
  const combat=s.nearby?.length||s.mounted||s.active?.includes('mega');
  let n=s.phase==='cinematic'||s.epilogue?30:combat?12:60;if(level==='L4'&&s.tick<1949)n=Math.min(n,1949-s.tick);
  await session.page.evaluate(async n=>{const a=window.__SS__!,g=window.__SCENE__.game;await a.step(n);g.view.frame(n/60);},n);
 }
 if(!receipt.finished&&!receipt.failure){receipt.failure=`${process.env.QA_BOUND_SECONDS??510} second browser command bound reached`;await photo('bounded-end',await snapshot());}
 receipt.finalCampaign=await session.page.evaluate(()=>window.__SS__!.campaign.state());
}catch(e){receipt.errors.push(String(e));console.error(e);process.exitCode=1;try{receipt.errorState=await snapshot();receipt.failedCampaign=await session.page.evaluate(()=>window.__SS__!.campaign.state());await photo('runtime-error',receipt.errorState);}catch(captureError){receipt.errors.push(String(captureError));const file=`${raw}/load-error.jpg`;await session.page.screenshot({path:file,type:'jpeg',quality:85}).catch(()=>{});receipt.captures.push({file,label:'load-error',requestedZoom:1.5,state:{tick:0,position:{x:0,z:0},quality:tier,backend},sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});}}
finally{receipt.errors.push(...session.errors);receipt.wallSeconds=(Date.now()-start)/1000;writeFileSync(`${root}/${tag}.json`,JSON.stringify(receipt));await session.close();stopServer();console.log(JSON.stringify({tag,finished:receipt.finished,failure:receipt.failure,errors:receipt.errors,captures:receipt.captures.length,wallSeconds:receipt.wallSeconds}));}
