/** Scoped menu/rocket/HUD regression evidence. Headless through the shared pool; no timing measurements. */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { launchBrowser } from '../browser-pool/client.ts';
import { preset } from '../../src/sim/progression/Campaign.ts';
import { SAVE_KEY } from '../../src/sim/progression/Save.ts';
import { look } from '../playtest/eyes.ts';
import { markerWalkKeys } from '../playtest/input.ts';
const out = resolve(process.argv[2] ?? 'test-results/vqa-fix-2/browser');
const group = process.argv[3] ?? 'l7';
mkdirSync(out, { recursive: true });
const socket = createServer(); await new Promise(done => socket.listen(0, '127.0.0.1', done));
const port = socket.address().port; await new Promise(done => socket.close(done));
assert.notEqual(port, 3300);
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'], {stdio:'ignore'});
const rows = [], errors = [];
let browser;
const hash = data => createHash('sha256').update(data).digest('hex');
try {
  for (let i=0;i<100;i++) { try { if ((await fetch(origin)).ok) break; } catch { /* preview startup */ } await new Promise(done=>setTimeout(done,100)); }
  browser = await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
  for (const tier of ['low','high']) {
    const context = await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
    await context.addInitScript('window.__name=f=>f;');
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    const boot = async save => {
      await page.goto(`${origin}/?${group==='l9-drive'?'test=poses&':''}testApi=1&scenelab=1&renderer=webgl&dpr=1&audio=muted&quality=${tier}`);
      await page.waitForFunction(()=>!!window.__SS__,null,{timeout:120000}); await page.evaluate(()=>window.__SS__.ready);
      if(save) await page.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save});
    };
    const capture = async label => {
      const file = `${tier}-${label}.jpg`; await page.screenshot({path:`${out}/${file}`,type:'jpeg',quality:85});
      return {file,sha256:hash(readFileSync(`${out}/${file}`))};
    };
    const roster = () => page.evaluate(()=>{
      const g=window.__SCENE__.game,w=g.world;
      return {tick:w.tick,checkpoint:w.missions.state.checkpoint,sourceIds:g.campaign?.results?.L6?.escapedSurvivors?.map(e=>e.id)??null,
        roster:w.l7Encounters.state.roster.map(r=>({id:r.id,status:r.status,hp:w.entities.get(r.id)?.health.current,max:w.entities.get(r.id)?.health.max})),
        losses:w.events.events().filter(e=>e.type==='mission.signal'&&e.name.startsWith('l7.survivor-'))};
    });
    if(group==='l9-drive') {
      await boot();
      await page.evaluate(async tier=>{
        const a=window.__SS__;await a.loadLevel('L9',{progression:'L9-default',seed:1});a.pause();a.settings.set({quality:tier});a.cheats.god(true);a.camera.zoom(1.5);
        const g=window.__SCENE__.game,w=g.world;w.missions.begin();g.ui.show(null);
        const frames=window.__vqaDriveFrames=[],update=w.update.bind(w);
        w.update=()=>{const before=w.tick,car=[...w.entities.iterate()].find(e=>e.vehicle?.driver===1),at=car?{...car.transform}:null;update();if(w.tick===before||!car||!at)return;frames.push({tick:w.tick,x:car.transform.x,z:car.transform.z,speed:Math.hypot(car.transform.x-at.x,car.transform.z-at.z)*60});};
        await a.screenshotReady();a.resume();
      },tier);
      const observations=[],recoveries=[],held=new Set();let last=null,reverseUntil=0,avoid=null,firstPhoto=null,started=false,completed=false;
      const press=async keys=>{for(const key of held)if(!keys.includes(key)){await page.keyboard.up(key);held.delete(key);}for(const key of keys)if(!held.has(key)){await page.keyboard.down(key);held.add(key);}};
      const deadline=Date.now()+220000;
      while(Date.now()<deadline){
        const e=await page.evaluate(look);if(e.level==='L9')started=true;if(started&&e.level==='L10'){completed=true;break;}if(e.level!=='L9'){await new Promise(done=>setTimeout(done,100));continue;}
        const goal=await page.evaluate(()=>{const w=window.__SCENE__.game.world;const m=w.missions;return m?.def.anchors[m.state.marker]??null;});
        observations.push({tick:e.tick,step:e.step,player:e.player,driving:e.driving,enemies:e.enemies.filter(body=>body.drawn).map(body=>({id:body.id,drawn:body.drawn}))});
        if(!firstPhoto&&e.driving&&e.enemies.some(body=>body.drawn&&body.d<24&&body.aim.x>100&&body.aim.x<e.view.w-100&&body.aim.y>100&&body.aim.y<e.view.h-100)){await press([]);await page.evaluate(async()=>{window.__SS__.pause();await window.__SS__.screenshotReady();});firstPhoto=await capture('L9-local-first-threat');await page.evaluate(()=>window.__SS__.resume());}
        if(!goal||!e.player){await press([]);await new Promise(done=>setTimeout(done,100));continue;}
        let keys=[];
        if(e.driving){
          const car=e.driving,now=Date.now();
          if(!last||Math.hypot(car.x-last.x,car.z-last.z)>2)last={x:car.x,z:car.z,at:now};
          if(now>=reverseUntil&&now-last.at>3000){reverseUntil=now+2000;avoid={x:car.x+35,z:car.z+(car.z<=0?18:-18)};recoveries.push({tick:e.tick,car:{...car},avoid:{...avoid},input:'two seconds of straight reverse, then steer around the visible obstruction; no authored route/risk coordinates'});last={x:car.x,z:car.z,at:reverseUntil};}
          if(now<reverseUntil)keys=['KeyS'];else{
            if(avoid&&Math.hypot(car.x-avoid.x,car.z-avoid.z)<8)avoid=null;
            const target=avoid??goal,want=-Math.atan2(target.z-car.z,target.x-car.x),delta=Math.atan2(Math.sin(want-car.yaw),Math.cos(want-car.yaw));keys=['KeyW',...(Math.abs(delta)>.07?[delta>0?'KeyD':'KeyA']:[])];
          }
        }else{
          const points=await page.evaluate(goal=>{const a=window.__SS__,p=window.__SCENE__.game.world.entities.get(1).transform;return[a.input.project(p,'player'),a.input.project(goal,'player')];},goal);
          keys=markerWalkKeys(points[1].x-points[0].x,points[1].y-points[0].y,(e.tick%60)/60);
        }
        await press(keys);await new Promise(done=>setTimeout(done,120));
      }
      await press([]);
      const frames=await page.evaluate(()=>window.__vqaDriveFrames??[]),driving=observations.filter(e=>e.driving),positive=driving.filter(e=>e.enemies.length),ticks=[driving[0]?.tick??0,...positive.map(e=>e.tick),driving.at(-1)?.tick??0];
      const maxSample=driving.length>1?Math.max(...driving.slice(1).map((e,i)=>(e.tick-driving[i].tick)/60)):null;
      const rawGap=Math.max(...ticks.slice(1).map((tick,i)=>(tick-ticks[i])/60));
      const movingGap=threshold=>Math.max(...ticks.slice(1).map((tick,i)=>frames.filter(frame=>frame.tick>ticks[i]&&frame.tick<=tick&&frame.speed>=threshold).length/60));
      const logFile=`${tier}-L9-local-driving.json`;writeFileSync(`${out}/${logFile}`,JSON.stringify({observations,frames,recoveries},null,2)+'\n');
      const conservativeGap=maxSample===null?null:rawGap+maxSample;
      const runtimeQuality=await page.evaluate(()=>window.__SS__.getState().render.quality);assert.equal(runtimeQuality,tier);
      rows.push({tier,runtimeQuality,level:'L9',path:'objective-drive-local-avoidance',completed,qualifies:completed&&!!firstPhoto&&conservativeGap!==null&&conservativeGap<=60,visibility:{observations:driving.length,positive:positive.length,rawGap,maxSample,conservativeGap,movingHalfSpeedGap:movingGap(.5),movingQuarterSpeedGap:movingGap(.25)},recoveries,log:{file:logFile,sha256:hash(readFileSync(`${out}/${logFile}`))},firstPhoto,capture:await capture('L9-local-result'),method:'Physical WASD follows the displayed objective. Visible stationary obstructions trigger a short reverse and local sidestep; no authored route/risk map, actor writes, skips or vehicle protection. Strict full in-car gap remains the qualifying bound; per-tick movement clocks are diagnostic.'});
    } else if(group==='l7-idle') {
      await boot();
      await page.evaluate(async tier=>{const a=window.__SS__;await a.loadLevel('L7',{progression:'L7-default'});a.pause();a.settings.set({quality:tier});a.cheats.god(true);},tier);
      const initial=await roster();await page.evaluate(()=>window.__SS__.step(300));
      rows.push({tier,path:'five-second-idle',initial,...await roster(),capture:await capture('five-second-idle')});
    } else if(group==='l7') {
      const save=preset('L7-default');save.settings.quality=tier;
      await boot(save);
      await page.getByTestId('start-game').click();await page.getByTestId('level-L7').click();
      await page.waitForFunction(()=>window.__SCENE__?.game.world.scenario==='L7'&&!window.__SCENE__.game.loading,null,{timeout:120000});
      await page.evaluate(()=>window.__SS__.pause());
      rows.push({tier,path:'default-menu',...await roster(),capture:await capture('default-menu')});
      await page.reload();await page.waitForFunction(()=>!!window.__SS__);await page.evaluate(()=>window.__SS__.ready);
      await page.getByTestId('start-game').click();await page.getByTestId('level-L7').click();
      await page.waitForFunction(()=>window.__SCENE__?.game.world.scenario==='L7'&&!window.__SCENE__.game.loading,null,{timeout:120000});
      await page.evaluate(()=>window.__SS__.pause());
      rows.push({tier,path:'default-resume',...await roster()});
      await page.evaluate(async()=>{await window.__SS__.loadLevel('L7',{progression:'L7-default',seed:1});window.__SS__.pause();});
      rows.push({tier,path:'default-api',...await roster()});
      const blob=execFileSync('git',['show',`40f3d1de9:docs/reports/fix51-r10c/L7-${tier}-carried-save.json.gz`]);
      const carried=JSON.parse(gunzipSync(blob));carried.settings.quality=tier;
      await page.evaluate(save=>{window.__SS__.campaign.restore(save);window.__SS__.campaign.save();},carried);
      await page.reload();await page.waitForFunction(()=>!!window.__SS__);await page.evaluate(()=>window.__SS__.ready);
      await page.getByTestId('start-game').click();await page.getByTestId('level-L7').click();
      await page.waitForFunction(()=>window.__SCENE__?.game.world.scenario==='L7'&&!window.__SCENE__.game.loading,null,{timeout:120000});
      await page.evaluate(()=>window.__SS__.pause());rows.push({tier,path:'carried-menu',...await roster(),capture:await capture('carried-menu')});
      await page.evaluate(async()=>{await window.__SS__.loadLevel('L7',{progression:'L7-default',seed:1});window.__SS__.pause();});
      rows.push({tier,path:'carried-api-preset',...await roster()});
    } else if(group==='corgi') {
      await boot();
      for(const level of ['L7','L8']){
        const proof=await page.evaluate(async({level,tier})=>{const a=window.__SS__;await a.loadLevel(level,{progression:`${level}-default`});a.pause();a.settings.set({quality:tier});const g=window.__SCENE__.game,w=g.world;w.missions.begin();g.ui.show(null);const dog=[...w.entities.iterate()].find(e=>e.companion),kit=w.entities.get(w.pickups.spawn('medkit',dog.transform));const initial={dog:{...dog.transform},kit:{...kit.transform}};await a.step(360);return {initial,dog:{...dog.transform},kit:{...kit.transform},distance:Math.hypot(dog.transform.x-kit.transform.x,dog.transform.z-kit.transform.z),runtimeQuality:a.getState().render.quality};},{level,tier});
        await page.evaluate(()=>window.__SS__.resume());await new Promise(done=>setTimeout(done,1500));await page.evaluate(async()=>{window.__SS__.pause();window.__SS__.camera.zoom(1.5);await window.__SS__.screenshotReady();});
        rows.push({tier,level,path:'idle-medkit',...proof,capture:await capture(`${level}-corgi-medkit`)});assert(proof.distance>=1.2);
      }
    } else if(group==='l8-physical') {
      await boot();
      await page.evaluate(async tier=>{const a=window.__SS__;await a.loadLevel('L8',{progression:'L8-default'});a.settings.set({quality:tier});},tier);
      await page.getByTestId('mission-button').click();
      const setup=await page.evaluate(()=>{const a=window.__SS__;a.pause();const w=window.__SCENE__.game.world,m=w.missions,car=w.entities.get(m.l8.state.carId);const door=m.l8.door(),dx=door.x-car.transform.x,dz=door.z-car.transform.z,length=Math.hypot(dx,dz);a.teleport('player',{x:door.x+dx/length*1.5,z:door.z+dz/length*1.5});a.setLoadout(['weapon.rocket-launcher'],['weapon.kick']);window.__vqaApcHits=[];w.events.on('explosion',e=>{if(e.type==='explosion'&&e.defId==='explosion.rocket'&&e.sourceId===1)window.__vqaApcHits.push({tick:w.tick,distance:Math.hypot(e.position.x-car.transform.x,e.position.z-car.transform.z),radius:e.radius,hp:car.health.current});});return {start:car.health.current,aim:a.input.project(car.transform)};});
      await page.keyboard.down('Shift');
      for(let shot=0;shot<8;shot++){const aim=await page.evaluate(()=>{const a=window.__SS__,w=window.__SCENE__.game.world;return a.input.project(w.entities.get(w.missions.l8.state.carId).transform);});await page.mouse.move(aim.x,aim.y);await page.mouse.down();await page.evaluate(()=>window.__SS__.step(1));await page.mouse.up();await page.evaluate(()=>window.__SS__.step(180));}
      await page.keyboard.up('Shift');
      await page.evaluate(()=>window.__SS__.resume());await new Promise(done=>setTimeout(done,1500));await page.evaluate(()=>window.__SS__.pause());
      const proof=await page.evaluate(()=>{const a=window.__SS__,g=window.__SCENE__.game,w=g.world,m=w.missions,car=w.entities.get(m.l8.state.carId);const afterRockets=car.health.current,rockets=w.events.events().filter(e=>e.type==='explosion'&&e.defId==='explosion.rocket'&&e.sourceId===1).length;w.explosions.blast('explosion.propane',car.transform,{sourceId:0,fires:false});return {afterRockets,rockets,hits:window.__vqaApcHits,afterEnvironmentalBlast:car.health.current,runtimeQuality:a.getState().render.quality};});
      await page.evaluate(()=>window.__SS__.resume());await new Promise(done=>setTimeout(done,1500));await page.evaluate(()=>window.__SS__.pause());
      await page.evaluate(async()=>{const a=window.__SS__,g=window.__SCENE__.game,w=g.world,car=w.entities.get(w.missions.l8.state.carId);w.vehicles.damage(car.id,car.health.current-car.health.max*.2);w.missions.l8.advance();await a.step(2);g.ui.update();});
      await page.evaluate(()=>window.__SS__.screenshotReady());
      rows.push({tier,level:'L8',path:'physical-rockets',...setup,...proof,bar:await page.getByTestId('vehicle-durability').isVisible(),label:await page.getByTestId('durability-label').textContent(),capture:await capture('l8-physical-critical')});
      assert(proof.rockets>=3,'physical rocket explosions');assert(proof.hits.filter(hit=>hit.distance<hit.radius).length>=3,'at least three real blast envelopes reach the APC');assert.equal(proof.afterRockets,setup.start);assert(proof.afterEnvironmentalBlast<proof.afterRockets);assert.equal(proof.runtimeQuality,tier);
    } else if(group==='l8-l2') {
      await boot();
      await page.evaluate(async tier=>{const a=window.__SS__;await a.loadLevel('L2',{progression:'L2-default'});a.pause();a.settings.set({quality:tier});window.__SCENE__.game.world.missions.begin();await a.step(2);},tier);
      rows.push({tier,level:'L2',objective:await page.getByTestId('objective-text').textContent(),capture:await capture('l2-objective')});
      assert.equal(rows.at(-1).objective.match(/Take the fire axe/g)?.length,1,`${tier} single fire-axe objective label`);
      const proof=await page.evaluate(async tier=>{
        const a=window.__SS__;await a.loadLevel('L8',{progression:'L8-default'});a.pause();const w=window.__SCENE__.game.world,m=w.missions;
        m.begin();a.settings.set({quality:tier});window.__SCENE__.game.ui.show(null);m.l8.advance();const door=m.l8.door();a.teleport('player',door);await a.step(2);const car=w.entities.get(m.l8.state.carId),start=car.health.current;
        for(let i=0;i<8;i++)w.explosions.blast('explosion.rocket',car.transform,{sourceId:1,actionId:'weapon.rocket-launcher',fires:false});
        const afterRockets=car.health.current;
        w.vehicles.damage(car.id,car.health.current-car.health.max*.2);
        window.__SCENE__.game.ui.update();
        return {start,afterRockets,critical:car.health.current,vehicleId:car.id,driver:w.vehicles.active,runtimeQuality:a.getState().render.quality};
      },tier);
      await page.evaluate(()=>window.__SS__.screenshotReady());
      rows.push({tier,level:'L8',...proof,bar:await page.getByTestId('vehicle-durability').isVisible(),label:await page.getByTestId('durability-label').textContent(),capture:await capture('l8-critical')});
      assert.equal(proof.start,proof.afterRockets);
    }
    if(group==='l7')for(const row of rows.filter(row=>row.tier===tier)){
      assert.equal(row.roster.length,row.sourceIds?.length??24,`${tier}/${row.path} arrival count`);
      assert(row.roster.every(actor=>actor.status==='following'&&actor.hp===actor.max),`${tier}/${row.path} full-health arrival`);
      if(row.sourceIds)assert.deepEqual(row.roster.map(actor=>actor.id).sort((a,b)=>a-b),[...row.sourceIds].sort((a,b)=>a-b),`${tier}/${row.path} carried identities`);
    }
    await context.close();
  }
} finally { await browser?.close();server.kill('SIGTERM');writeFileSync(`${out}/receipt.json`,JSON.stringify({...JSON.parse(readFileSync('dist/.qa-accept-build.json','utf8')),revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),toolSha256:hash(readFileSync(new URL(import.meta.url))),group,rows,errors,method:'Shared headless ANGLE Metal WebGL2; menu inputs and explicit QA fixture operations as labelled; no frame timing.'},null,2)+'\n'); }
console.log(JSON.stringify({out,group,rows:rows.map(r=>({tier:r.tier,path:r.path,count:r.roster?.length,source:r.sourceIds?.length,level:r.level})),errors}));

if(group==='l9-drive'&&rows.some(row=>!row.qualifies))process.exitCode=1;
