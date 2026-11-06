import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from '../../browser-pool/client.ts';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';

assert(['low', 'high'].includes(process.argv[2]), 'Supply one tier per pooled command');
assert(['lion','gorilla','elephant','zebra','flamingo'].includes(process.argv[3]),'Supply species');
const species=process.argv[3];
const identity = provenance(), hash = browserHash(), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const geometryPath = 'docs/reports/fix55-c/L8-enclosure-paths.json', geometryBytes = readFileSync(geometryPath), geometry = JSON.parse(geometryBytes);
assert.equal(geometry.sourceHash, identity.sourceHash);
const out = resolve(`test-results/sweep-c5-l8-animals-${Date.now()}`); mkdirSync(out, { recursive: true });
const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port; await new Promise(r => socket.close(r)); assert.notEqual(port, 3300);
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const rows=[],deadline=Date.now()+480000;
try {
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break;}catch{}await delay(100);}
 const tier=process.argv[2],seedPath=`docs/reports/sweep-c4/L8-07-actual-${tier}-campaign.json.gz`,seedBytes=readFileSync(seedPath),campaign=JSON.parse(gunzipSync(seedBytes));
 const originalRoster=campaign.results.L7.escapedSurvivors.map(e=>e.id);campaign.results.L7.escapedSurvivors=[];
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),timer=setTimeout(()=>{void context.close();},8*60_000),page=await context.newPage();
 const errors=[],samples=[],commands=[],captures=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try {
  await page.addInitScript('window.__name=f=>f');await page.goto(`http://127.0.0.1:${port}/?test=1&ui=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);await page.waitForFunction(()=>!!window.__SS__&&!!window.__SCENE__);
  const setup=await page.evaluate(async({campaign,tier,species})=>{
   const a=window.__SS__,g=window.__SCENE__.game;await a.ready;a.pause();a.campaign.restore(campaign);await a.loadLevel('L8',{seed:1});a.pause();a.settings.set({quality:tier,cameraShake:false,cheapDof:false});a.missions.begin();a.cheats.god(true);g.driver=null;g.ui.show(null);g.input.release();g.world.clearInput();
   const target=[...g.world.entities.iterate()].find(e=>e.civilian?.zooAnimal===species);if(!target)throw Error('Missing original healthy animal');
   window.__animalLook={id:target.id,path:[],goal:-1,pathIndex:0};
   return{target:{id:target.id,archetype:target.archetype,hp:target.health.current,position:{...target.transform}},goal:{x:target.transform.x+2.5,z:target.transform.z+2.5},roster:[...g.world.missions.l8.state.roster],backend:a.perf().backend,quality:a.getState().render.quality};
  },{campaign,tier,species});assert.equal(setup.roster.length,0);
  const snap=()=>page.evaluate(()=>{
   const g=window.__SCENE__.game,w=g.world,e=w.entities.get(window.__animalLook.id),f=g.view.crowdFigures().find(f=>f.id===e.id);
   return{tick:w.tick,player:{...w.entities.get(1).transform},target:{id:e.id,archetype:e.archetype,hp:e.health.current,position:{...e.transform},species:e.civilian?.zooAnimal,infection:e.infection,infected:e.infected?{state:e.infected.state,special:e.infected.specialAttack,variant:e.infected.variant}:null,rising:e.infectionRise},figure:f??null,camera:window.__SS__.getState().render.camera,breached:!!w.missions.l8.state.breachedAt};
  });
  const capture=async label=>{for(const zoom of [.5,1.5]){await page.evaluate(async z=>{window.__SS__.camera.zoom(z);await window.__SS__.screenshotReady();},zoom);const file=resolve(out,`${tier}-${species}-${label}-z${zoom}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:90});captures.push({file,sha256:sha(readFileSync(file)),label,zoom,state:await snap()});}};
  await page.locator('canvas').first().focus();
  let held=[];
  const keys=async(next,tick)=>{for(const k of held.filter(k=>!next.includes(k)))await page.keyboard.up(k);for(const k of next.filter(k=>!held.includes(k)))await page.keyboard.down(k);held=next;commands.push({tick,keys:[...next]});};
  for(let i=0;i<1200&&Date.now()<deadline;i++){
   const s=await page.evaluate(goal=>{const w=window.__SCENE__.game.world,p=w.entities.get(1),next={...goal};w.infected.nav.steer(p.transform,goal,window.__animalLook,.45,next,Infinity,true);return{tick:w.tick,position:{...p.transform},next};},setup.goal);samples.push({stage:'approach',...s});
   if(s.tick>=3594)break;
   const close=Math.hypot(s.position.x-setup.goal.x,s.position.z-setup.goal.z)<.65,dx=s.next.x-s.position.x,dz=s.next.z-s.position.z,x=dx-dz,y=dx+dz,next=[];
   if(!close&&Math.abs(x)>.15)next.push(x>0?'KeyD':'KeyA');if(!close&&Math.abs(y)>.15)next.push(y>0?'KeyS':'KeyW');await keys(next,s.tick);await page.evaluate(()=>window.__SS__.step(6));
  }
  await keys([],await page.evaluate(()=>window.__SS__.tick()));const pre=await snap();assert(pre.tick>=3594&&!pre.target.infected&&pre.target.hp>0,'Original animal healthy before breach');assert(Math.hypot(pre.player.x-pre.target.position.x,pre.player.z-pre.target.position.z)<=8,JSON.stringify({player:pre.player,animal:pre.target.position,goal:setup.goal}));await capture('healthy');await page.evaluate(()=>window.__SS__.step(6));
  const attackers=await page.evaluate(()=>{
   const w=window.__SCENE__.game.world,e=w.entities.get(window.__animalLook.id),list=[];
   for(let i=0;i<4;i++){
    let at=null;
    for(let ring=0;ring<12&&!at;ring++)for(let turn=0;turn<16&&!at;turn++){const angle=i*Math.PI/2+turn*Math.PI/8,r=1.1+ring*.2,p={x:e.transform.x+Math.cos(angle)*r,z:e.transform.z+Math.sin(angle)*r,y:.7};if(w.infected.nav.clear(p.x,p.z,.35)&&w.solids.clear(p,.35,0,false))at=p;}
    if(!at)throw Error('No clear ordinary infector spawn');const id=w.infected.spawn('infected.runner',at,{state:'chase',yaw:0}),a=w.entities.get(id);list.push({id,hp:a.health.current,position:{...a.transform}});
   }
   return list;
  });
  let settled=false;
  for(let i=0;i<250&&Date.now()<deadline;i++){const s=await snap();samples.push({stage:'bite-and-turn',...s});if(s.target.infected&&!s.target.rising&&s.target.hp>0){settled=true;break;}if(s.target.hp<=0)break;await page.evaluate(()=>window.__SS__.step(6));}
  if(settled){await capture('infected');for(const n of [30,60]){await keys(['KeyD'],await page.evaluate(()=>window.__SS__.tick()));await page.evaluate(()=>window.__SS__.step(30));await keys([],await page.evaluate(()=>window.__SS__.tick()));samples.push({stage:`move${n}`,...await snap()});await capture(`move${n}`);}}
  else await capture('inconclusive-turn');
  rows.push({tier,species,setup,seed:{file:seedPath,sha256:sha(seedBytes),originalRoster,fixtureRoster:[],change:'Explicit valid zero-survivor presentation fixture; no carried-roster claim. Only incoming L7 escapedSurvivors replaced before normal L8 constructor.'},pre,attackers,settled,samples,commands,captures,events:await page.evaluate(()=>window.__SS__.events(3600)),errors});console.log(tier,species,{settled,captures:captures.length,final:await snap(),errors});
 }finally{clearTimeout(timer);await context.close();}
}finally{
 await browser.close();server.kill('SIGTERM');writeFileSync(`docs/reports/sweep-c5/L8-08/animals-${process.argv[2]}-${species}.json`,JSON.stringify({...identity,browserHash:hash,toolSha256:sha(readFileSync(new URL(import.meta.url))),out,method:'Explicit zero-carried-survivor presentation capability fixture on actual L8 world/render path. Original healthy species, physical WASD approach before breach, four ordinary body-clear60HP runners after3600, ordinary combat/bite/same-ID conversion, then real physical movement. No target/AI/faction/HP/cap/timer writes; courier protected only. Normal L8 lighting; paired POzoom photos. Doesnotqualify roster continuity, natural infection rates or performance.',rows},null,2)+'\n');
}
