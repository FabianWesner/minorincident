/** Physical final bay entry after an ordinary protected native-input prefix. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import { provenance } from './accept/probe';
const out=process.env.BAY_OUT??'test-results/sweep-a2/bay';mkdirSync(`${out}/captures`,{recursive:true});const runs=[];
try {for(const tier of ['low','high'] as const){const s=new SceneSession({tier,backend:'webgpu',query:{ui:'1'}});try{
 await s.open();await s.page.evaluate('window.__name=f=>f');
 await s.page.evaluate(async tier=>{const a=window.__SS__!;a.settings.set({quality:tier});await a.loadLevel('L1',{seed:1});a.missions.begin();a.pause();a.camera.follow();a.camera.zoom(1);a.cheats.god(true);a.bot.start('complete');document.documentElement.setAttribute('data-scene-hud','');document.querySelectorAll('#hud,.hud').forEach(n=>n.setAttribute('data-scene-hud',''));
 const w=(window.__SCENE__ as unknown as{game:Game}).game.world;
 for(let i=0;i<1200;i++){const p=w.entities.get(1)!.transform,t=w.missions!.def.anchors['fire-bay-trigger'];if(w.missions!.state.steps.weapon.status==='completed'&&Math.hypot(p.x-t.x,p.z-t.z)<13)break;await a.step(10);}
 a.bot.stop();a.input.clear();},tier);
 await s.page.addStyleTag({content:'.story-bubble{visibility:visible!important}'});
 const read=()=>s.page.evaluate(()=>{const g=(window.__SCENE__ as unknown as{game:Game}).game,w=g.world,l=w.missions!.state.l1!,p=w.entities.get(1)!;return{tick:w.tick,player:{...p.transform},hp:p.health.current,azimuth:g.view.view.azimuth,phase:w.missions!.state.phase,fire:w.missions!.state.steps.firestation.status,gate:w.missions!.state.gates['fire-shutter'],say:l.say,storyLock:!!w.storyLock,door:w.missions!.def.anchors['fire-bay-door'],trigger:w.missions!.def.anchors['fire-bay-trigger'],living:w.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission).map(e=>({id:e.id,at:{...e.transform},state:e.infected!.state,mode:e.infected!.l1?.mode,target:e.infected!.l1?.targetId})),corgi:[...w.entities.iterate()].filter(e=>e.companion).map(e=>({id:e.id,at:{...e.transform},hidden:!!e.hidden})),backend:window.__SS__!.getState().render.backend,quality:window.__SS__!.getState().render.quality};});
 const samples:Awaited<ReturnType<typeof read>>[]=[],frames:{file:string;label:string;sha256:string;state:Awaited<ReturnType<typeof read>>}[]=[],commands=[];
 const step=async(keys:string[],ticks:number)=>{for(const k of keys)await s.page.keyboard.down(k);try{for(let i=0;i<ticks;i++){await s.page.evaluate(async()=>window.__SS__!.step(1));samples.push(await read());}}finally{for(const k of keys)await s.page.keyboard.up(k);}};
 const shot=async(label:string)=>{await s.page.evaluate(async()=>window.__SS__!.screenshotReady());const file=`${out}/captures/${tier}-${label}.png`;await s.page.screenshot({path:file});frames.push({file,label,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),state:await read()});};
 const initial=await read();samples.push(initial);await shot('bay-open');
 for(const seconds of [4,8]){await step([],240);await shot(`hold-${seconds}s`);}
 const physicalStart=(await read()).tick;
 for(let i=0;i<600;i++){
  const q=await read();if(q.fire==='completed')break;
  const dx=q.trigger.x-q.player.x,dz=q.trigger.z-q.player.z,d=Math.hypot(dx,dz),right=Math.cos(q.azimuth)*dx-Math.sin(q.azimuth)*dz,down=Math.sin(q.azimuth)*dx+Math.cos(q.azimuth)*dz;
  const keys=[];if(Math.abs(right)/d>.34)keys.push(right>0?'KeyD':'KeyA');if(Math.abs(down)/d>.34)keys.push(down>0?'KeyS':'KeyW');
  commands.push({tick:q.tick,keys,target:q.trigger,note:'Read-only production trigger/camera guides physical WASD final bay entry; no injected navigation or movement.'});await step(keys,1);
  const after=await read();if(after.tick===physicalStart+60)await shot('physical-1s');if(after.tick===physicalStart+120)await shot('physical-2s');if(after.fire==='completed'){await shot('physical-inside');break;}
 }
 await shot('entry-end');await step([],60);await shot('shutter-settled');
 runs.push({tier,initial,physicalStart,final:await read(),commands,samples,frames,errors:s.errors});console.log(tier,commands.length,(await read()).fire,(await read()).gate);
}finally{await s.close();}}}finally{stopServer();writeFileSync(`${out}/receipt.json`,JSON.stringify({...provenance(),method:'Ordinary complete InputFrames to bay approach, then empty input8s and physical page.keyboard WASD only for final entry. Read-only trigger/camera guidance declared. Incoming courier damage suppressed throughout solely for mechanical/visual proof; infected AI, targeting and combat stay active. No harness teleport/spawn/objective skip, no performance timing. Production companion.door relocation is observed rather than injected.',runs},null,2)+'\n');}
