/** Live decoded cellar audio at the authored line-break checkpoint, under voice-budget stress. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { Game } from '../../src/Game';
import { launchBrowser } from '../browser-pool/client';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
const out='test-results/fix71-b/cellar';mkdirSync(`${out}/captures`,{recursive:true});
const identity=provenance(),rows=[];
const tiers=(['low','high'].includes(process.argv[2])?[process.argv[2]]:['low','high']) as ('low'|'high')[];
const zooms=process.argv[3]?[Number(process.argv[3])]:[.5,1.5];
const browser=await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--mute-audio']});
try{
 for(const tier of tiers)for(const zoom of zooms){
  const resume=JSON.parse(gunzipSync(readFileSync(`test-results/fix71-b/cellar-brace-resume-${tier}.json.gz`)).toString());
  assert.equal(resume.sourceHash,identity.sourceHash,'cellar save must come from the current game source');
  const session=new SceneSession({tier,backend:'webgl2',query:{audio:'enabled',profile:'0',ui:'1'}});
  try{
   await session.open(browser);
   await session.page.evaluate('window.__name = f => f');
   await session.page.evaluate(async({tier,zoom,resume})=>{
    const a=window.__SS__!;a.settings.set({quality:tier,muted:false});
    await a.loadLevel('L4',{seed:1,progression:'L4-default'});a.pause();
    a.missions.begin();
    const g=(window.__SCENE__ as unknown as {game:Game}).game,w=g.world;
    w.missions!.loadResume(resume.save);
    a.settings.set({quality:tier,muted:false});a.cheats.god(false);a.camera.follow();a.camera.zoom(zoom);g.view.view.update(w.entities.get(1)!.transform,1);a.bot.start('complete');await a.audio.unlock();
    document.documentElement.setAttribute('data-scene-hud','');
    const mission=w.missions!,audio=g.audio;
    const analyser=audio.context.createAnalyser();analyser.fftSize=1024;const pcm=new Float32Array(1024),connected=new Set<number>();
    const data={tier,zoom,runtime:{tier:w.infected!.director.tier,quality:g.view.getState().quality,backend:g.view.getState().backend},cellarEntry:{...mission.def.anchors['l4-cellar-in']},stressAccepted:0,barredAt:0,voices:[] as unknown[],samples:[] as {tick:number;time:number;rms:number;state:string}[],barRoster:[] as unknown[]};
    (window as unknown as {__cellarProbe:typeof data}).__cellarProbe=data;
    const emit=w.events.emit.bind(w.events);
    w.events.emit=event=>{
     if(event.type==='l4.doorBarred'){
      data.barredAt=event.tick;
      for(let i=0;i<64;i++)if(a.audio.play('action.weapon.army-mg',{priority:100,gain:.1},90000+i)!==null)data.stressAccepted++;
      data.barRoster=[...w.entities.iterate()].filter(e=>!e.hidden&&(e.id===1||e.companion||e.civilian||e.infected)&&Math.hypot(e.transform.x-w.entities.get(1)!.transform.x,e.transform.z-w.entities.get(1)!.transform.z)<15).map(e=>({id:e.id,companion:!!e.companion,at:{...e.transform}}));
     }
     emit(event);
    };
    const sample=()=>{
     if(g.world!==w||w.missions!==mission){analyser.disconnect();return;}
     requestAnimationFrame(sample);if(!data.barredAt)return;
     for(const voice of audio.graph.active.values())if(!connected.has(voice.id)&&!voice.position&&voice.cutoff<=750&&/army-mg|explosion\.boom/.test(voice.cue)){
      connected.add(voice.id);voice.gain.connect(analyser);data.voices.push({id:voice.id,cue:voice.cue,priority:voice.priority,cutoff:voice.filter.frequency.value,gain:voice.gain.gain.value,tick:w.tick});
     }
     analyser.getFloatTimeDomainData(pcm);let energy=0;for(const v of pcm)energy+=v*v;
     data.samples.push({tick:w.tick,time:audio.context.currentTime,rms:Math.sqrt(energy/pcm.length),state:audio.context.state});
    };requestAnimationFrame(sample);
   },{tier,zoom,resume});
   let cellar=false;
   for(let i=0;i<1200;i++){
    const state=await session.page.evaluate(()=>{const s=window.__SS__!.missions.state()!;return{phase:s.l4!.phase,barred:s.l4!.barredAt};});
    if(state.barred)throw new Error('Fixture stepped past the first barring event');
    if(state.phase==='cellar'){cellar=true;break;}
    await session.page.evaluate(async()=>{await window.__SS__!.step(30);});
   }
   assert(cellar,'ordinary mortal bot inputs must reach cellar from the progressed level start');
   await session.page.evaluate(()=>{window.__SS__!.setTimeScale(1);window.__SS__!.resume();});
   try { await session.page.waitForFunction(()=>!!(window as unknown as {__cellarProbe:{barredAt:number}}).__cellarProbe.barredAt,null,{timeout:10000}); }
   catch(error){
    const state=await session.page.evaluate(()=>{const g=(window.__SCENE__ as unknown as {game:Game}).game;return{tick:g.world.tick,paused:g.clock.paused,mission:window.__SS__!.missions.state(),player:window.__SS__!.getEntity(1)?.transform,bot:window.__SS__!.bot.status()};});
    writeFileSync(`${out}/failure-${tier}-z${zoom}.json`,JSON.stringify(state,null,2)+'\n');
    await session.page.screenshot({path:`${out}/captures/${tier}-z${zoom}-failure.jpg`,type:'jpeg',quality:90});throw error;
   }
   const captures=[`${out}/captures/${tier}-z${zoom}-barred.jpg`,`${out}/captures/${tier}-z${zoom}-end.jpg`];
   await session.page.screenshot({path:captures[0],type:'jpeg',quality:90});
   // Follow the authored seven sim seconds through the actual handover, even on a loaded host.
   await session.page.waitForFunction(()=>window.__SS__!.missions.state()?.id==='L5',null,{timeout:30000});
   const handover=await session.page.evaluate(async zoom=>{const a=window.__SS__!,g=(window.__SCENE__ as unknown as {game:Game}).game;a.pause();a.camera.follow();a.camera.zoom(zoom);g.view.view.update(g.world.entities.get(1)!.transform,1);await a.screenshotReady();return{level:g.world.missions!.state.id,player:{...g.world.entities.get(1)!.transform}};},zoom);
   await session.page.screenshot({path:captures[1],type:'jpeg',quality:90});
   const data=await session.page.evaluate(()=>{window.__SS__!.pause();return(window as unknown as {__cellarProbe:{runtime:{tier:string;quality:string;backend:string};cellarEntry:{x:number;z:number};barredAt:number;samples:{tick:number;time:number;rms:number;state:string}[];voices:{cutoff:number;gain:number}[]}}).__cellarProbe;});
   const audible=data.samples.filter(s=>s.state==='running'&&s.rms>=.001);
   const span=audible.length?(audible.at(-1)!.tick-audible[0].tick)/60:0;
   assert.equal(data.runtime.tier,tier);assert.equal(data.runtime.quality,tier);assert.equal(data.runtime.backend,'webgl');
   const row={tier,zoom,span,handover,entryDistance:Math.hypot(handover.player.x-data.cellarEntry.x,handover.player.z-data.cellarEntry.z),first:audible[0],last:audible.at(-1),captures,data,errors:session.errors};rows.push(row);console.log(JSON.stringify({tier,zoom,span,voices:data.voices.length,errors:session.errors}));
   writeFileSync(`${out}/receipt-${tier}-z${zoom}.json`,JSON.stringify({...identity,method:'Actual reached-brace save before barring from the ordinary mortal native complete route, restored with the production loadResume path. Ordinary bot InputFrames perform the remaining normal bar; the saved interaction counter is retained. At the real door-barred event fill the ordinary-gun voice budget, then measure only positive-gain <=750Hz battle voices in the live decoded graph with an analyser for the real seven-second wait. Host speakers muted by Chrome flag; context still running. No objectives, actors or timers changed after restoring the reached save.',rows:[row]},null,2)+'\n');
  }finally{await session.close();}
 }
}finally{await browser.close();stopServer();}
assert(rows.length===tiers.length*zooms.length&&rows.every(r=>r.span>=6&&!r.errors.length),'every selected cell needs >=6 sim seconds of decoded filtered battle audio');
