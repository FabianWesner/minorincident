/** L8 animal A/B, motion/corpse, mixed crowd and authored scenes through the shared pool. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import { zooStaffLook } from '../../src/data/zooStaff';
import type { ActorSpec, SceneSpec } from '../../src/debug/scenelab/spec';
import type { AssetDef } from '../../src/assets/types';
import type { Game } from '../../src/Game';

const ids = ['amb.lion','inf.lion','amb.gorilla','inf.gorilla','amb.elephant','inf.elephant','amb.flamingo','inf.flamingo'];
const tier = process.env.REVIEW_TIER === 'high' ? 'high' : 'low';
const backend = process.env.REVIEW_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const variant = process.env.REVIEW_VARIANT ?? 'new', mode = process.env.L8_CAPTURE ?? 'portraits';
const out = resolve(`test-results/l8-all-new/${mode}-${variant}-${tier}-${backend}`);
const session = new SceneSession({ backend, tier, nativeFrameTiming: mode==='population', viewport: mode === 'portraits' ? { width:800,height:600 } : { width:1600,height:900 }, query:{ ...(mode==='population'?{}:{crowdProbe:'full'}), ...(mode==='freeze'?{loadProfile:'2'}:{}) } });
const actor = (model: string, id='subject', at: [number,number]=[0,0], yaw=-45): ActorSpec => model.startsWith('amb.')
  ? { id, kind:'animal', species:model.slice(4) as ActorSpec['species'], at,yaw,state:'idle' }
  : { id,kind:'infected',archetype:`infected.${model.slice(4)}`,look:{model},at,yaw,state:'idle' };
function resources() {
  const game=(window.__SCENE__ as unknown as {game:Game}).game,textures=new Set<import('three').Texture>();
  game.view.scene.traverse(node=>{
    const mesh=node as import('three').Mesh;
    if(mesh.isMesh)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])for(const value of Object.values(material))if(value&&typeof value==='object'&&'isTexture'in value)textures.add(value as import('three').Texture);
    for(const texture of node.userData.preRenderTextures??[])textures.add(texture);
  });
  let decodedBytes=0;
  for(const texture of textures){const image=texture.image as {width?:number;height?:number;data?:{byteLength:number}};if(image?.width&&image.height)decodedBytes+=(texture.mipmaps as {data?:{byteLength:number}}[]).reduce((n,m)=>n+(m.data?.byteLength??0),0)||Math.ceil((image.data?.byteLength??image.width*image.height*4)*(texture.generateMipmaps?4/3:1));}
  return {decodedBytes,textureCount:textures.size,perf:window.__SS__!.perf(),render:window.__SS__!.getState().render};
}
const base: SceneSpec = { name:'l8-review',ground:'asphalt',time:'L8-zoo',size:100,dof:false,actors:[],camera:{mode:'game',target:[0,0],zoom:1},frames:3,expect:{consoleErrors:0} };
try {
  await session.open();
  await session.page.addInitScript('window.__name = (fn) => fn;'); await session.page.evaluate('window.__name = (fn) => fn;');
  if (variant === 'old') {
    const manifest = JSON.parse(readFileSync('src/assets/manifest.json','utf8')) as AssetDef[];
    for (const def of manifest) if (ids.includes(def.id) && def.rigidBaseline) {
      def.glb=def.rigidBaseline.glb;def.lods=def.rigidBaseline.lods;def.sourceGlb=`assets/${def.id}/model.glb`;
      delete def.crowdSkin;delete def.textureMode;delete def.textureAtlasLow;delete def.lowGlb;delete def.corpseGlb;
    }
    await session.page.context().route('**/src/assets/manifest.json*',route=>route.fulfill({contentType:'application/javascript',body:`export default ${JSON.stringify(manifest)};`}));
    await session.page.context().route('**/src/assets/civilianBakes.json*',route=>route.fulfill({contentType:'application/javascript',body:'export default {};'}));
    await session.page.reload();await session.page.waitForFunction(()=>!!window.__SCENE__&&!!window.__SS__);await session.page.evaluate(async()=>{await window.__SS__!.ready;window.__SS__!.pause();});
  }
  const receipts: { [key: string]: unknown }[]=existsSync(`${out}/receipts.json`)&&(process.env.L8_RESUME==='1'||process.env.L8_IDS)?JSON.parse(readFileSync(`${out}/receipts.json`,'utf8')).filter((r:{id?:string;model?:string})=>process.env.L8_RESUME==='1'||!process.env.L8_IDS?.split(',').includes(r.id??r.model??'')):[];
  if (mode==='portraits') {
    for (const model of ids.filter(id=>!process.env.L8_IDS||process.env.L8_IDS.split(',').includes(id))) for (const yaw of [-45,135]) {
      if ([120,400].every(pixels=>receipts.some(r=>r.id===model&&r.yaw===yaw&&r.targetPixels===pixels))) continue;
      await session.load({...base,actors:[{id:'courier',kind:'courier',at:[30,30]},actor(model,'subject',[0,0],yaw)]});await session.step(3);await session.ready();
      const entity=(await session.metrics()).actors.subject.entity;
      for (const pixels of [120,400]) {
        const framing=await session.page.evaluate(async({entity,pixels})=>{
          const three='/node_modules/three/build/three.webgpu.js',pick='/src/render/characters/PickBodies.ts';
          const {Box3,Matrix4,Vector3}=await import(three),{pickBodies}=await import(pick);
          const game=(window.__SCENE__ as unknown as {game:Game}).game;
          const box=pickBodies.bounds(entity,new Box3());if(!box)throw Error('Body not drawn');
          const target=box.getCenter(new Vector3());let distance=10,bounds:number[]=[];
          for(let i=0;i<10;i++){
            const position=target.clone().add(new Vector3().setFromSphericalCoords(distance,Math.PI*.3,Math.PI/4));
            window.__SCENE__!.setCamera({mode:'pose',position:position.toArray(),target:target.toArray()});await window.__SCENE__!.ready();
            const camera=game.view.camera,projection=new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
            const b=pickBodies.bounds(entity,new Box3(),projection);if(!b)throw Error('Body projection absent');
            bounds=[(b.min.x+1)*400,(1-b.max.y)*300,(b.max.x+1)*400,(1-b.min.y)*300];distance*=(bounds[3]-bounds[1])/pixels;
          }
          const e=game.world.entities.get(entity)!;
          return {bounds,actualPixels:bounds[3]-bounds[1],groundMinY:box.min.y,state:{archetype:e.archetype,healthy:!!e.civilian?.zooAnimal,infected:!!e.infected}};
        },{entity,pixels});
        const file=`${out}/${model}-${pixels}-${yaw}.png`;await session.screenshot(file);receipts.push({id:model,variant,tier,backend,file,targetPixels:pixels,yaw,...framing});writeJson(`${out}/receipts.json`,receipts);console.log(`${model} ${yaw} ${pixels}px ${variant} ${tier} ${backend}`);
      }
    }
  } else if(mode==='crowd'||mode==='freeze') {
    const people=['npc.civilian-man-a','npc.civilian-man-b','npc.civilian-woman-a','npc.civilian-woman-b','npc.civilian-elderly'];
    const actors:ActorSpec[]=Array.from({length:30},(_,i)=>{
      const at:[number,number]=[-9+(i%10)*2.1,-5+Math.floor(i/10)*5];
      if(i===0)return{id:'courier',kind:'courier',at,yaw:-45};
      if(i===1)return{id:'corgi',kind:'corgi',at,yaw:-45};
      if(i>=20)return actor([...ids,'amb.zebra','inf.zebra'][i-20],`animal-${i}`,at);
      return{id:`person-${i}`,kind:'pedestrian',at,yaw:-45,state:'idle',look:i>=16?zooStaffLook(i-16):{model:i<6?'npc.national-guard':people[i%5],role:i<6?'soldier':undefined,accessories:[],handProp:i<6?'rifle':null}};
    });
    await session.load({...base,name:'l8-street-crowd30',ground:'district',layout:{district:'D-ZOO',bbox:[[-35,-20],[35,20]]},actors,camera:{mode:'game',target:[1,0,0],zoom:1.5}});await session.step(3);await session.ready();
    const metrics=await session.metrics();assert.equal(Object.keys(metrics.actors).length,30);assert.ok(Object.values(metrics.actors).every(a=>a.drawnFrames>0));
    for(const zoom of [1,1.5]){await session.page.evaluate(zoom=>window.__SS__!.camera.zoom(zoom),zoom);await session.ready();await session.screenshot(`${out}/zoom-${zoom}.png`);}
    writeJson(`${out}/metrics.json`,metrics);writeJson(`${out}/resources.json`,await session.page.evaluate(resources));
    if(mode==='freeze'){
      await session.page.evaluate(()=>{for(const id of ['animal-21','animal-23','animal-25','animal-27','animal-29'])window.__SCENE__!.command(id,{corpse:true});});await session.step(180);await session.ready();
      const probe=await session.page.evaluate(async()=>{
        const api=window.__SS__!;api.resume();await new Promise(r=>setTimeout(r,1500));
        const warm={...api.perf().nodeBuildMaterials},gaps:number[]=[];let previous=0,stop=false;
        const frame=(now:number)=>{if(previous)gaps.push(now-previous);previous=now;if(!stop)requestAnimationFrame(frame);};requestAnimationFrame(frame);
        for(const zoom of [1,1.5,1,1.5]){api.camera.zoom(zoom);await new Promise(r=>setTimeout(r,800));}
        stop=true;api.pause();const after=api.perf().nodeBuildMaterials;
        return {samples:gaps.length,maxFrameMs:Math.max(...gaps),over200:gaps.filter(g=>g>200),builds:Object.fromEntries(Object.entries(after).filter(([key,n])=>n!==warm[key])),render:api.getState().render};
      });
      writeJson(`${out}/freeze.json`,probe);assert.deepEqual(probe.builds,{});assert.deepEqual(probe.over200,[]);assert.ok(probe.samples>30);console.log(JSON.stringify({tier,backend,freeze:probe}));
    }
  } else if(mode==='population') {
    const cap=tier==='high'?200:100,people=['npc.civilian-man-a','npc.civilian-man-b','npc.civilian-woman-a','npc.civilian-woman-b','npc.civilian-elderly'];
    const actors:ActorSpec[]=[{id:'courier',kind:'courier',at:[60,10]},{id:'corgi',kind:'corgi',at:[62,10]}];
    for(let i=0;i<cap;i++){
      const species=['lion','gorilla','elephant','zebra','zebra','flamingo','flamingo','flamingo'][i-4];
      actors.push({id:`threat-${i}`,kind:'infected',archetype:i<4?'infected.alpha':species?`infected.${species}`:'infected.runner',look:i<4?{model:['inf.alpha-worker','inf.alpha-hoodie','inf.alpha-fire','inf.alpha-suit'][i]}:species?undefined:{model:people[i%5]},at:[38+i%20*1.1,-3-Math.floor(i/20)*.7],yaw:0,state:'idle'});
    }
    for(let i=0;i<42;i++)actors.push({id:`person-${i}`,kind:'pedestrian',at:[40+i%14*1.8,2+Math.floor(i/14)*1.2],yaw:90,state:'idle',look:i>=38?zooStaffLook(i-38):{model:i>=32?'npc.national-guard':people[i%5],role:i>=32?'soldier':undefined,handProp:i>=32?'rifle':null}});
    for(const [i,species]of ['lion','gorilla','elephant','zebra','zebra','flamingo','flamingo','flamingo'].entries())actors.push(actor(`amb.${species}`,`healthy-${i}`,[40+i*3,7]));
    await session.load({...base,name:`l8-full-population-${tier}`,ground:'district',infectedCap:200,layout:{district:'D-ZOO',bbox:[[-120,-90],[120,90]]},actors,camera:{mode:'game',target:[60,0,0],zoom:3}});await session.step(120);await session.ready();
    const sample=await session.page.evaluate(async()=>{
      const api=window.__SS__!,frames:number[]=[];api.resume();const start=performance.now();let previous=0;
      while(performance.now()-start<8000){const now=await new Promise<number>(requestAnimationFrame);if(previous&&now-start>2000)frames.push(now-previous);previous=now;}
      api.pause();frames.sort((a,b)=>a-b);return {samples:frames.length,p95:frames[Math.ceil(frames.length*.95)-1],max:Math.max(...frames),ai:api.getState().ai?.count};
    });
    assert.equal(sample.ai,cap);writeJson(`${out}/resources.json`,{sample,...await session.page.evaluate(resources)});await session.screenshot(`${out}/population.png`);console.log(JSON.stringify(sample));
  } else if(mode==='states') {
    for(const [i,model]of ids.entries()){
      if(process.env.L8_IDS&&!process.env.L8_IDS.split(',').includes(model))continue;
      // Exercise the actual healthy zoo routine, turn into the infected identity, then freeze the corpse.
      const subject=actor(model);
      await session.load({...base,name:`l8-states-${model}`,actors:[{id:'courier',kind:'courier',at:[12,0]},subject],camera:{mode:'game',target:[0,.5,0],zoom:.6},trace:true});
      await session.step(3);await session.screenshot(`${out}/${i}-idle.png`);
      const entity=(await session.metrics()).actors.subject.entity;
      await session.page.evaluate(({entity,healthy})=>{
        const game=(window.__SCENE__ as unknown as {game:Game}).game,e=game.world.entities.get(entity)!;
        if(healthy){const c=e.civilian!;c.waypoints=[{x:7,z:0}];c.waypoint=0;c.pauseUntil=0;c.path=[];c.goal=-1;}else window.__SCENE__!.command('subject',{chase:'courier'});
      },{entity,healthy:model.startsWith('amb.')});
      for(const frame of [12,24,36,48,60,72]){
        await session.step(12);await session.page.evaluate(entity=>{const game=(window.__SCENE__ as unknown as {game:Game}).game,e=game.world.entities.get(entity)!;window.__SCENE__!.setCamera({mode:'game',target:[e.transform.x,.5,e.transform.z],zoom:.6});},entity);
        await session.screenshot(`${out}/${i}-walk-${frame}.png`);
      }
      if(model.startsWith('amb.')){
        await session.page.evaluate(entity=>{const game=(window.__SCENE__ as unknown as {game:Game}).game;game.world.npcs!.civilians.outbreak!.turnNow(game.world.entities.get(entity)!);},entity);
        await session.step(3);await session.screenshot(`${out}/${i}-turned.png`);
      }
      await session.page.evaluate(()=>window.__SCENE__!.command('subject',{corpse:true}));await session.step(180);
      await session.screenshot(`${out}/${i}-corpse.png`);receipts.push({model,metrics:await session.metrics(),render:await session.page.evaluate(()=>window.__SS__!.getState().render)});writeJson(`${out}/receipts.json`,receipts);
    }
  } else if(mode==='level') {
    await session.page.evaluate(async()=>{const api=window.__SS__!;await api.loadLevel('L8',{seed:30,progression:'L8-default'});api.pause();await api.step(2);await api.screenshotReady();});
    await session.screenshot(`${out}/sanctuary.png`);writeJson(`${out}/resources.json`,await session.page.evaluate(resources));
  } else if(mode==='story') {
    for(const relative of ['l8-district/walk.json','l8-systems/lion.json','l8-systems/gorilla.json','l8-systems/elephant.json','l8-systems/zebra.json','l8-systems/flamingo.json','l8-apc/transport.json']){
      const file=resolve('tests/scenes',relative),spec=readSpec(file);spec.time='L8-zoo';
      const result=await runSpec(session,spec,{file,out:resolve(out,spec.name!),sheet:Math.max(60,Math.ceil((spec.frames??180)/8))});assert.ok(result.pass,JSON.stringify(result.failed));receipts.push({file,...result});writeJson(`${out}/receipts.json`,receipts);
    }
  }
  assert.equal(session.errors.length,0,JSON.stringify(session.errors));
} finally { await session.close();stopServer(); }
