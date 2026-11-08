// Lane reproduction probe; setup/inspection APIs only, physical input during gameplay.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {launchBrowser} from '../../../tools/browser-pool/client.ts';
import {look} from '../../../tools/playtest/eyes.ts';
import {VehicleRecovery} from '../../../tools/playtest/driving.ts';
import {preset,newCampaign,gearTier} from '../../../src/sim/progression/Campaign.ts';
const origin=process.env.L9_ORIGIN??'http://127.0.0.1:3839';
const routes=JSON.parse(readFileSync('layouts/D-CROSSING/routes.json')).routes;
const base=preset('L9-default');
function saveFor(tier,quality,character){
 const s=tier===4&&process.env.L9_TRANSPORT?JSON.parse(readFileSync(`test-results/pre-uat-l9/transport-${quality}.json`)).save:tier===0?newCampaign(character):preset(['','','L4-default','L5-default','L9-default'][tier]||'L3-default');
 if(!(tier===4&&process.env.L9_TRANSPORT))s.character=character;s.settings={...s.settings,quality,vfx:true,cameraShake:false,cheapDof:false,captions:true};
 if(gearTier(s)!==tier)throw Error('wrong fixture tier');return s;
}
const mode=process.argv[2]??'matrix', backend=process.argv[3]??'webgl';
const all=routes.flatMap((route,r)=>['low','high'].flatMap((quality,q)=>[1,1.5].map((zoom,z)=>({route,quality,zoom,tier:(r*4+q*2+z)%5,character:(r+q+z)%2?'male':'female'}))));
const cells=all.filter(c=>c.route.id==='dry-shortcut'&&c.zoom===1.5&&mode===`zero-${c.quality}`).map(c=>({...c,tier:4}));
const out=resolve(`test-results/pre-uat-l9/realtime-${backend}-${mode}-corrected${process.env.L9_RUN?`-${process.env.L9_RUN}`:''}`);mkdirSync(out,{recursive:true});
const browser=await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--mute-audio']});
try{for(const cell of cells){
 if(process.env.L9_TRANSPORT&&cell.tier===4)cell.character=JSON.parse(readFileSync(`test-results/pre-uat-l9/transport-${cell.quality}.json`)).save.character;
 const key=`${cell.route.id}-${cell.quality}-z${cell.zoom}-gear${cell.tier}-${cell.character}`;const dir=resolve(out,key);mkdirSync(dir,{recursive:true});
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const page=await context.newPage();
 const receipt={...cell,backend,save:saveFor(cell.tier,cell.quality,cell.character),errors:[],samples:[],inputs:[],captures:[]};
 page.on('pageerror',e=>receipt.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')receipt.errors.push(m.text())});
 let held=[];const keys=async next=>{for(const k of held.filter(k=>!next.includes(k)))await page.keyboard.up(k);for(const k of next.filter(k=>!held.includes(k)))await page.keyboard.down(k);held=next;};
 const capture=async name=>{const file=resolve(dir,`${name}.jpg`);const diagnostic=await page.evaluate(()=>{const g=window.__SCENE__.game,id=g.world.vehicles?.active;return{tick:g.world.tick,terrain:g.view.getState().districts?.terrain,tyres:(g.view.vehicles?.wheelNodes().get(id)??[]).map(w=>{let min=Infinity,point;w.traverse(m=>{const a=m.geometry?.attributes.position;if(!a)return;const v=w.position.clone();for(let i=0;i<a.count;i++){v.set(a.getX(i),a.getY(i),a.getZ(i)).applyMatrix4(m.matrixWorld);if(v.y<min){min=v.y;point=v.clone();}}});return point?{minY:min,ground:g.view.drawnGround(point.x,point.z),gap:min-(g.view.drawnGround(point.x,point.z)??0)}:null;})}});writeFileSync(file.replace('.jpg','.json'),JSON.stringify(diagnostic));await page.screenshot({path:file,type:'jpeg',quality:88});receipt.captures.push({file,name,sample:receipt.samples.at(-1)});};
 try{
  await page.addInitScript('window.__name=f=>f');
  const url=`${origin}/?test=poses&testApi=1&scenelab=1&renderer=${backend}&dpr=1&audio=enabled&quality=${cell.quality}`;
  await page.goto(url);await page.waitForFunction(()=>!!window.__SS__,null,{timeout:120000});await page.evaluate(()=>window.__SS__.ready);
  await page.evaluate(save=>{window.__SS__.campaign.restore(save);window.__SS__.campaign.save();},receipt.save);
  await page.reload();await page.waitForFunction(()=>!!window.__SS__,null,{timeout:120000});await page.evaluate(()=>window.__SS__.ready);
  await page.getByTestId('start-game').click();
  if(await page.getByTestId(`character-${cell.character}`).isVisible().catch(()=>false))await page.getByTestId(`character-${cell.character}`).click();
  await page.getByTestId('level-L1').click();
  await page.evaluate(async save=>{const a=window.__SS__;await a.ready;a.campaign.restore(save);await a.loadLevel('L9',{seed:1});},receipt.save);
  for(let i=0;i<900;i++){
   const s=await page.evaluate(()=>({phase:window.__SS__.missions.state()?.phase,loading:!document.querySelector('[data-testid="level-transition"]').hidden}));
   if(s.phase==='playing'&&!s.loading)break;
   if(!s.loading&&await page.getByTestId('mission-button').isVisible().catch(()=>false))await page.getByTestId('mission-button').click();
   await page.waitForTimeout(100);if(i===899)throw Error('level did not begin');
  }
  await page.evaluate(z=>{window.__SS__.camera.zoom(z);window.__SS__.resume();},cell.zoom);
  receipt.setup=await page.evaluate(()=>{const a=window.__SS__,g=window.__SCENE__.game,w=g.world;
   window.__l9Audit={events:[],inputs:[]};const before=g.input.tap;g.input.tap=(frame,scheme)=>{before?.(frame,scheme);window.__l9Audit.inputs.push({tick:w.tick,drive:frame.drive,move:frame.move,brake:frame.brake});};
   for(const type of ['vehicle.durability-hit','vehicle.damage-stage','combat.attack','vehicle.crash','vehicle.attack-windup','vehicle.sound','dialogue.line','mission.signal','objective.started','level.completed','audio.cue'])w.events.on(type,e=>window.__l9Audit.events.push(structuredClone(e)));
   return{backend:a.getState().render.backend,quality:a.getState().render.quality,player:w.entities.get(1).survivor,save:a.campaign.state(),start:w.tick};});
  if(backend==='webgpu'&&receipt.setup.backend!=='webgpu')throw Error(`requested WebGPU, got ${receipt.setup.backend}`);
  let path=[[-550,0],[-450,0],[-312,-22.5]];let zeroStage='approach',zeroHoldTick=0;let waypoint=1;const recovery=new VehicleRecovery();let nextPhoto=0,previousPhase='',phaseTicks=0;
  for(let iteration=0;iteration<2800;iteration++){
   const s=await page.evaluate(()=>{const a=window.__SS__,g=window.__SCENE__.game,w=g.world,m=w.missions;
    const car=w.vehicles?.cars.get(m?.l9?.state.carId);const p=w.entities.get(1);
    return{tick:w.tick,level:w.scenario,phase:m?.l9?.state.phase,mission:m?.state.phase,car:car?{id:car.entity.id,...car.entity.transform,hp:car.entity.health.current,max:car.entity.health.max,speed:car.physics.speed,forwardSpeed:car.physics.forwardSpeed,speedCap:car.physics.speedCap,stage:car.entity.vehicle.stage??0,damage:car.entity.vehicle.damage,occupants:(car.entity.vehicle.passengers??[]).map(p=>({id:p.id,hp:w.entities.get(p.id)?.health.current,hidden:w.entities.get(p.id)?.hidden}))}:null,
     player:{...p.transform,hp:p.health.current,hidden:p.hidden,weapons:p.combat?.loadout},camera:a.getState().render.camera,chunks:w.chunks?.stats(),terrain:g.view.getState().districts?.terrain,
     presentation:{character:g.view.character?.getState().clip,attachments:g.view.actions?.getState().attachments.map(a=>({id:a.actionId,visible:a.visible})),gunMeshes:g.view.actions?.gunMeshes().length},objective:document.querySelector('[data-testid="objective-text"]')?.textContent,armor:(()=>{const n=document.querySelector<HTMLElement>('[data-testid="vehicle-durability"]');return n?{text:n.textContent,hidden:n.hidden,display:getComputedStyle(n).display}:null})(),
     dog:[...w.entities.iterate()].filter(e=>e.companion).map(e=>({id:e.id,hidden:e.hidden,hp:e.health.current,position:e.transform})),storyLock:w.storyLock,active:w.vehicles?.active};});
   const eye=await page.evaluate(look);s.visible=eye.enemies.filter(e=>e.drawn&&e.hp>0).map(e=>({id:e.id,x:e.x,z:e.z,hp:e.hp,archetype:e.archetype}));receipt.samples.push(s);
   if(s.level!=='L9'){await page.waitForFunction(()=>window.__SCENE__.game.world.scenario==='L10'&&!window.__SCENE__.game.loading&&document.querySelector('[data-testid=level-transition]').hidden,null,{timeout:120000});await page.waitForTimeout(800);await page.evaluate(()=>window.__SS__.pause());receipt.handover=await page.evaluate(()=>({campaign:window.__SS__.campaign.state(),state:window.__SS__.getState()}));await capture('handover');receipt.finished=true;break;}
   if(s.phase==='crawl'&&cell.tier<4&&receipt.captures.some(c=>c.name.startsWith('phase-crawl'))){await keys([]);await page.evaluate(()=>window.__SS__.resume());await page.waitForTimeout(1000);await page.evaluate(()=>window.__SS__.pause());await capture('crawl-gear');await page.evaluate(()=>window.__SS__.camera.zoom(.5));await page.evaluate(()=>window.__SS__.screenshotReady());await capture('crawl-close');receipt.finished=true;receipt.scope='physical detour through crash/crawl; low-progression gear fixture stops before campaign commit';break;}
   if(s.car&&s.car.stage!==receipt.lastStage){receipt.lastStage=s.car.stage;await capture(`damage-stage-${s.car.stage}`);receipt.stageAudio??=[];receipt.stageAudio.push({tick:s.tick,stage:s.car.stage,audio:await page.evaluate(()=>window.__SS__.audio.snapshot())});}
   if(s.phase!==previousPhase){previousPhase=s.phase;phaseTicks=s.tick;await capture(`phase-${s.phase}-t${s.tick}`);}
   else if(s.phase==='crawl'&&s.tick-phaseTicks>=36&&!receipt.captures.some(c=>c.name==='crawl-settled')){await keys([]);await page.evaluate(()=>window.__SS__.resume());await page.waitForTimeout(1000);await page.evaluate(()=>window.__SS__.pause());await capture('crawl-settled');await page.evaluate(()=>window.__SS__.resume());}
   else if(s.phase==='fall'&&s.tick-phaseTicks>=60&&!receipt.captures.some(c=>c.name==='fall-middle'))await capture('fall-middle');
   if(s.tick>=nextPhoto&&s.phase==='driving'){await capture(`drive-t${s.tick}`);nextPhoto=s.tick+1800;}
   let next=[];
   if(s.phase==='driving'){
    const p=s.car;
    if(zeroStage==='approach'&&waypoint===path.length-1&&Math.hypot(p.x+312,p.z+22.5)<5){zeroStage='wait';zeroHoldTick=s.tick;await capture('stopped-surrounded');}
    if(zeroStage==='wait'){
      if(p.hp<=0){
       await keys(['KeyK']);await page.keyboard.press('KeyE');await page.mouse.move(640,360);await page.mouse.down();await page.keyboard.down('Space');
       const start=await page.evaluate(()=>window.__SS__.tick());
       while(await page.evaluate(()=>window.__SS__.tick())-start<300)await page.waitForTimeout(100);
       await page.keyboard.up('Space');await page.mouse.up();
       receipt.zeroFire=await page.evaluate(start=>({start,end:window.__SS__.tick(),active:window.__SCENE__.game.world.vehicles.active,events:window.__l9Audit.events.filter(e=>e.type==='combat.attack'&&e.sourceId===1&&e.tick>=start)}),start);
       await keys(['KeyW']);await page.evaluate(()=>window.__SS__.resume());await page.waitForTimeout(4000);await keys([]);await page.evaluate(()=>window.__SS__.pause());
       receipt.zeroReached={tick:s.tick,beforeSmoke:s};
       for(const z of [1,1.5]){await page.evaluate(z=>window.__SS__.camera.zoom(z),z);await page.evaluate(()=>window.__SS__.screenshotReady());await capture(`zero-smoke-z${z}`);}
       await page.evaluate(z=>{window.__SS__.camera.zoom(z);window.__SS__.resume();},cell.zoom);zeroStage='escaped';path=cell.route.detour;waypoint=1;
      }else{if(s.tick-zeroHoldTick>18000)throw Error('infected did not wear parked vehicle down in 300s');await keys(['KeyK']);receipt.inputs.push({tick:s.tick,keys:held,zeroStage});await page.waitForTimeout(120);continue;}
    }

    while(waypoint<path.length-1){const a=path[waypoint-1],b=path[waypoint],along=(p.x-b[0])*(b[0]-a[0])+(p.z-b[1])*(b[1]-a[1]);if(along<=0&&Math.hypot(p.x-b[0],p.z-b[1])>=6)break;waypoint++;}
    const a=path[waypoint-1],b=path[waypoint],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),along=Math.max(0,Math.min(len,((p.x-a[0])*dx+(p.z-a[1])*dz)/len)),d=Math.min(len,along+12),goal=[a[0]+dx*d/len,a[1]+dz*d/len];
    const want=-Math.atan2(goal[1]-p.z,goal[0]-p.x),delta=Math.atan2(Math.sin(want-p.yaw),Math.cos(want-p.yaw));
    next=recovery.keys(p,s.tick/60*1000)??[((zeroStage==='approach'&&waypoint===path.length-1&&Math.hypot(p.x+312,p.z+22.5)<30&&p.speed>3)||Math.abs(delta)>.35&&p.speed>6)?'KeyS':'KeyW',...(Math.abs(delta)>.02?[delta>0?'KeyD':'KeyA']:[])];
   }else if(s.phase==='crawl'){
    const p=s.player,a=s.camera.azimuth,dx=550-p.x,dz=-p.z,right=Math.cos(a)*dx-Math.sin(a)*dz,down=Math.sin(a)*dx+Math.cos(a)*dz,len=Math.hypot(right,down);
    if(Math.abs(right)/len>.34)next.push(right>0?'KeyD':'KeyA');if(Math.abs(down)/len>.34)next.push(down>0?'KeyS':'KeyW');
   }
   await keys(next);receipt.inputs.push({tick:s.tick,keys:next,waypoint});await page.waitForTimeout(120);
  }
  await keys([]);receipt.audit=await page.evaluate(()=>window.__l9Audit);
  receipt.audio=await page.evaluate(()=>window.__SS__.audio.snapshot());receipt.end=receipt.samples.at(-1);console.log(key,receipt.finished?'FINISHED':'INCOMPLETE',receipt.end.level,receipt.end.phase,receipt.end.tick,receipt.errors.length);
 }catch(e){receipt.error=String(e);console.log(key,'ERROR',String(e));try{await capture('error')}catch{}}
 finally{writeFileSync(resolve(dir,'receipt.json'),JSON.stringify(receipt));if(receipt.error||!receipt.finished||receipt.errors.length)process.exitCode=1;await context.close();}
}}
finally{await browser.close();}
