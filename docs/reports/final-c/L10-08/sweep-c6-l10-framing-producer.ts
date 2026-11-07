import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {launchBrowser as pooledLaunchBrowser} from '../../browser-pool/client.ts';
const launchBrowser=async options=>{try{return await pooledLaunchBrowser(options)}catch(e){if(!String(e).includes('Pool disappeared after admission'))throw e;const h=await fetch('http://127.0.0.1:4329/health');if(!h.ok)throw e;console.log('Retrying pre-context admission after successful live pool health recheck');return await pooledLaunchBrowser(options)}};
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
import {markerWalkKeys} from '../../playtest/input.ts';
const tier=process.argv[2];assert(['low','high'].includes(tier));const root='docs/reports/final-c/L10-08',identity=provenance(),bh=browserHash(),sha=b=>createHash('sha256').update(b).digest('hex'),prefix=JSON.parse(readFileSync(`${root}/prefix-proof.json`));assert.equal(prefix.sourceHash,identity.sourceHash);const source=prefix.rows.find(r=>r.tier===tier);assert(source.controlIdentical);const out=resolve(`test-results/final-c/L10-08/${tier}-${Date.now()}`);mkdirSync(out,{recursive:true});
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));assert.notEqual(port,3300);
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{stdio:'ignore'}),browser=await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const errors=[],rows=[];
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break;}catch{}await delay(100);}
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),timer=setTimeout(()=>void context.close(),8*60_000),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
 await page.addInitScript('window.__name=f=>f');await page.goto(`http://127.0.0.1:${port}/?test=1&ui=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=muted&dpr=1&preload=0`);await page.waitForFunction(()=>!!window.__SS__&&!!window.__SCENE__);
 for(const stage of ['road1','road2','road3','road4','road5','charge']){
 const seed=source.seeds.find(s=>s.stage===stage);assert(seed);const bytes=readFileSync(seed.file);assert.equal(sha(bytes),seed.sha256);const campaign=JSON.parse(gunzipSync(bytes));
 const setup=await page.evaluate(async({campaign,tier})=>{const a=window.__SS__,g=window.__SCENE__.game;await a.ready;a.pause();a.campaign.restore(campaign);await a.loadLevel('L10',{seed:1});a.pause();a.settings.set({quality:tier,cameraShake:false,cheapDof:false,aimAssist:'Off'});a.cheats.god(true);g.driver=null;g.ui.show(null);g.input.release();g.world.clearInput();a.camera.zoom(1.5);window.__proof={inputs:[],specials:[]};g.input.tap=f=>window.__proof.inputs.push({tick:g.world.tick,move:f.move,nativeDriver:!!g.driver});g.world.events.on('infected.special',e=>{const m=g.world.megaPursuit,p=g.world.entities.get(1),boss=m.entity();if(e.sourceId===boss?.id)window.__proof.specials.push({...e,distance:Math.hypot(boss.transform.x-p.transform.x,boss.transform.z-p.transform.z),mega:{...boss.transform}});});return{tick:g.world.tick,backend:a.perf().backend,quality:a.getState().render.quality,driverDetached:!g.driver};},{campaign,tier});
 const samples=[],captures=[],commands=[];
 const snap=()=>page.evaluate(()=>{const g=window.__SCENE__.game,w=g.world,p=w.entities.get(1),m=w.megaPursuit,e=m.entity();return{tick:w.tick,player:{...p.transform},camera:g.view.getState().camera,finale:!!w.missions.state.states['cure-installed'],mega:e?{id:e.id,hp:e.health.current,hidden:!!e.hidden,position:{...e.transform},distance:m.distance(),mode:m.state.mode,special:structuredClone(e.infected?.specialAttack??null)}:null,figures:g.view.crowdFigures().filter(f=>f.drawn).map(f=>({id:f.id,clip:f.clip,phase:f.phase})),actors:w.infected.active.filter(e=>!e.hidden&&e.health.current>0&&Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z)<25).map(e=>({id:e.id,archetype:e.archetype,appearance:e.appearance,position:{...e.transform}}))};});
 const photo=async label=>{for(const zoom of [.5,1.5]){await page.evaluate(async z=>{window.__SS__.camera.zoom(z);await window.__SS__.screenshotReady();},zoom);const file=resolve(out,`${stage}-${label}-z${zoom}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:90});captures.push({file,sha256:sha(readFileSync(file)),stage,label,zoom,state:await snap()});}await page.evaluate(()=>window.__SS__.camera.zoom(1.5));};
 await page.locator('canvas').first().focus();await photo('initial');await page.keyboard.down('KeyD');commands.push({tick:setup.tick,keys:['KeyD']});await page.evaluate(()=>window.__SS__.step(12));await page.keyboard.up('KeyD');samples.push(await snap());await photo('move-12');
 if(stage!=='charge'){
 await page.evaluate(async()=>{window.__SS__.camera.zoom(100);await window.__SS__.screenshotReady();});const max=await snap(),file=resolve(out,`${stage}-max.jpg`);await page.screenshot({path:file,type:'jpeg',quality:90});captures.push({file,sha256:sha(readFileSync(file)),stage,label:'max-user-zoom',state:max});
 }else{
 let held=[],slam=false;
 for(let i=0;i<2000;i++){
 const s=await snap();samples.push(s);if(i%100===0)console.log(tier,{stage,i,tick:s.tick,distance:s.mega?.distance,special:s.mega?.special?.move});
 if(s.mega?.special?.move==='alpha.ground-slam'&&s.mega.special.stage==='telegraph'){await photo('slam-0');for(const n of [6,12]){await page.evaluate(()=>window.__SS__.step(6));await photo(`slam-${n}`);}slam=true;break;}
 const d=s.mega?.distance??Infinity;let next=[];
 if(d<6&&s.mega){const dx=s.player.x-s.mega.position.x,dz=s.player.z-s.mega.position.z,sign=d<3.1?1:d>3.7?-1:0;next=markerWalkKeys((dx-dz)*100*sign,(dx+dz)*100*sign,(i%10)/10);}
 for(const k of held.filter(k=>!next.includes(k)))await page.keyboard.up(k);for(const k of next.filter(k=>!held.includes(k)))await page.keyboard.down(k);held=next;commands.push({tick:s.tick,keys:[...held],distance:d,reason:'Physical spacing to observe ordinary close attack, no actor writes'});await page.evaluate(n=>window.__SS__.step(n),d>30?120:6);
 if(s.tick-setup.tick>240*60){await photo('no-slam-within240s');break;}
 }
 for(const k of held)await page.keyboard.up(k);if(!slam)errors.push('No naturally scheduled slam telegraph witnessed');
 }
 const result=await page.evaluate(()=>window.__proof);rows.push({stage,seed,setup,samples,captures,commands,result});console.log(tier,stage,{captures:captures.length,errors});
 }
 }finally{clearTimeout(timer);await context.close();}
}catch(e){errors.push(String(e));}
finally{await browser.close();server.kill('SIGTERM');writeFileSync(`${root}/${tier}-physical.json.gz`,gzipSync(JSON.stringify({...identity,browserHash:bh,toolSha256:sha(readFileSync(new URL(import.meta.url))),prefixSha256:sha(readFileSync(`${root}/prefix-proof.json`)),tier,out,rows,errors,method:'Current native progressed production Resume snapshots, canonical native final state identical; every post-load command physical WASD. Five normal road regions and actual finale; actual POzooms, maximal userzoom request uses normal production clamp. Finale original persistent Mega approaches and naturally schedules specials; physical spacing aims for3.1–3.7m to observe groundslam without calling scheduler. Courier god only; normal actors/HP/AI/caps/time. No relocation, actor writes, mission skip or perf timing.'})));}process.exitCode=errors.length?1:0;
