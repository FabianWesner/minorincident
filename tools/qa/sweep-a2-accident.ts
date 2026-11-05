/** L1 accident at normal production time scale; no performance measurement. */
import {SceneSession,stopServer} from '../scenelab/session';
import type {Game} from '../../src/Game';
import {provenance} from './accept/probe';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const out='test-results/sweep-a2/accident';mkdirSync(`${out}/captures`,{recursive:true});const runs=[];
try{for(const tier of ['low','high'] as const){const s=new SceneSession({tier,backend:'webgpu',query:{ui:'1'}});try{
 await s.open();await s.page.evaluate('window.__name=f=>f');
 await s.page.evaluate(async tier=>{const a=window.__SS__!;a.settings.set({quality:tier});await a.loadLevel('L1',{seed:1});a.missions.begin();a.pause();a.camera.follow();a.camera.zoom(1);a.bot.start('complete');
 document.documentElement.setAttribute('data-scene-hud','');document.querySelectorAll('#hud,.hud').forEach(n=>n.setAttribute('data-scene-hud',''));
 for(let i=0;i<6000&&!a.missions.state()!.l1!.deliveredAt;i++)await a.step(1);
 if(!a.missions.state()!.l1!.deliveredAt)throw Error('Actual delivery not reached');a.bot.stop();a.input.clear();
 const g=(window.__SCENE__ as unknown as{game:Game}).game,w=g.world;
 const log={deliveredAt:w.missions!.state.l1!.deliveredAt,events:[] as {type:string;tick:number}[],samples:[] as {tick:number;active:string[];living:number}[]};
 (window as unknown as{qaAccident:typeof log}).qaAccident=log;
 for(const name of ['l1.flicker','l1.blast','l1.ringing','l1.smoke','l1.screams']as const)w.events.on(name,e=>log.events.push({type:e.type,tick:e.tick}));
 w.events.on('sim.tick',()=>log.samples.push({tick:w.tick,active:Object.entries(w.missions!.state.steps).filter(([,step])=>step.status==='active').map(([id])=>id),living:w.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission).length}));
 a.setTimeScale(1);a.resume();},tier);
 await s.page.addStyleTag({content:'.story-bubble{visibility:visible!important}'});const captures=[];
 for(const beat of ['delivered','quiet-4s','l1.flicker','l1.blast','l1.ringing','l1.smoke','l1.screams']){
  await s.page.waitForFunction(beat=>{const q=(window as unknown as{qaAccident:{deliveredAt:number;events:{type:string}[]}}).qaAccident;return beat==='delivered'||(beat==='quiet-4s'?window.__SS__!.tick()>=q.deliveredAt+240:q.events.some(e=>e.type===beat));},beat,{timeout:60000});
  const tick=await s.page.evaluate(()=>window.__SS__!.tick());const file=`${out}/captures/${tier}-${beat}-${tick}.png`;await s.page.screenshot({path:file});captures.push({beat,tick,file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});
 }
 await s.page.evaluate(()=>window.__SS__!.pause());const ledger=await s.page.evaluate(()=>(window as unknown as{qaAccident:unknown}).qaAccident);runs.push({tier,ledger,captures,errors:s.errors});console.log(tier,captures.length);
 }finally{await s.close();}}}finally{stopServer();writeFileSync(`${out}/receipt.json`,JSON.stringify({...provenance(),method:'Ordinary native input to actual Delivered latch; idle normal timeScale1/resume through accident. Read-only sim event/calm ledger, production follow zoom1/fullHUD. No frame performance or audio output measurement, no protection/relocation/skips. Captures after event notification may miss transient peak; blast-frame50ms remains unmeasured.',runs},null,2));}
