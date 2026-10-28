/** L10 Mega A/B, motion/corpse, mixed crowd and authored scenes through the shared pool. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import { cure } from '../../src/levels/L10/district';
import { regularInfectedModels } from '../../src/data/crowdAppearance';
import { alphaLooks } from '../../src/data/alphaLooks';
import type { ActorSpec, SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

const ids = ['inf.mega-alpha','inf.mega-alpha-ashen','inf.mega-alpha-ember'];
const tier = process.env.REVIEW_TIER === 'high' ? 'high' : 'low';
const backend = process.env.REVIEW_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const variant = 'v2', mode = process.env.L10_CAPTURE ?? 'portraits';
const out = resolve(`test-results/l10-all-new/${mode}-${variant}-${tier}-${backend}`);
const session = new SceneSession({ backend, tier, nativeFrameTiming: false, viewport: mode === 'portraits' ? { width:800,height:600 } : { width:1600,height:900 }, query:{ ...(mode==='population'?{crowdProbe:'drawn'}:{crowdProbe:'full'}), ...(mode==='freeze'?{loadProfile:'2'}:{}) } });
const actor = (model: string, id='subject', at: [number,number]=[0,0], yaw=-45): ActorSpec => ({id,kind:'infected',archetype:model.startsWith('inf.dog')?'infected.dog':model.includes('alpha')?'infected.alpha':model==='inf.firefighter'?'infected.firefighter':'infected.runner',look:{model},at,yaw,state:'idle'});
function resources() {
  const game=(window.__SCENE__ as unknown as {game:Game}).game,textures=new Set<import('three').Texture>();
  game.view.scene.traverse(node=>{
    const mesh=node as import('three').Mesh;
    if(mesh.isMesh)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])for(const value of Object.values(material))if(value&&typeof value==='object'&&'isTexture'in value)textures.add(value as import('three').Texture);
    for(const texture of node.userData.preRenderTextures??[])textures.add(texture);
  });
  let decodedBytes=0,uncompressedUpperBytes=0;
  for(const texture of textures){
    const image=texture.image as {width?:number;height?:number;data?:{byteLength:number}};
    if(!image?.width||!image.height)continue;
    decodedBytes+=(texture.mipmaps as {data?:{byteLength:number}}[]).reduce((n,m)=>n+(m.data?.byteLength??0),0)||Math.ceil((image.data?.byteLength??image.width*image.height*4)*(texture.generateMipmaps?4/3:1));
    uncompressedUpperBytes+=Math.ceil(Math.max(image.data?.byteLength??0,image.width*image.height*4)*(texture.generateMipmaps||texture.mipmaps.length>1?4/3:1));
  }
  return {decodedBytes,uncompressedUpperBytes,textureCount:textures.size,perf:window.__SS__!.perf(),render:window.__SS__!.getState().render};
}
const base: SceneSpec = { name:'l10-review',ground:'asphalt',time:'L10-night',size:100,dof:false,actors:[],camera:{mode:'game',target:[0,0],zoom:1},frames:3,expect:{consoleErrors:0} };
const load = session.load.bind(session);
session.load = async spec => {
  const result = await load(spec);
  if(mode==='crowd'||mode==='story') await session.page.evaluate(() => {
    const world=(window.__SCENE__ as unknown as {game:Game}).game.world;
    // Match production L10: Scene Lab's default L1 dressing must not replace
    // native runner identities or their authored headwear (same as L9 review).
    world.scenario='L10';
    const outbreak=world.npcs?.civilians.outbreak;
    if(outbreak) outbreak.dressInfected=()=>{};
    for(const entity of world.entities.values()) if(entity.infected&&entity.archetype==='infected.runner') delete entity.appearance;
  });
  return result;
};
try {
  await session.open();
  await session.page.addInitScript('window.__name = (fn) => fn;'); await session.page.evaluate('window.__name = (fn) => fn;');
  const receipts: { [key: string]: unknown }[]=existsSync(`${out}/receipts.json`)&&(process.env.L10_RESUME==='1'||process.env.L10_IDS)?JSON.parse(readFileSync(`${out}/receipts.json`,'utf8')).filter((r:{id?:string;model?:string})=>process.env.L10_RESUME==='1'||!process.env.L10_IDS?.split(',').includes(r.id??r.model??'')):[];
  if (mode==='portraits') {
    for (const model of ids.filter(id=>!process.env.L10_IDS||process.env.L10_IDS.split(',').includes(id))) for (const yaw of [-45,135]) {
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

  } else if(mode==='crowd') {
    const people=['npc.civilian-man-a','npc.civilian-man-b','npc.civilian-woman-a','npc.civilian-woman-b','npc.civilian-elderly'];
    const models=[...ids,...alphaLooks['inf.alpha'],...regularInfectedModels,'inf.firefighter','inf.dog','inf.dog.black','inf.dog.cream',...people,...regularInfectedModels.slice(0,4)];
    const origin=cure.anchors['cure-industrial'];
    const actors:ActorSpec[]=[{id:'courier',kind:'courier',at:[origin[0]+4,origin[1]-5],yaw:-45,loadout:['weapon.fire-axe','weapon.army-mg'],state:{select:'RIGHT'}},{id:'corgi',kind:'corgi',at:[origin[0]+5,origin[1]-5],yaw:-45}];
    for(const [i,model]of models.entries()){
      const u=i<3?(i-1)*3.3:-4.8+(i-3)%7*1.6,v=i<3?0:4+Math.floor((i-3)/7)*2.4;
      const at:[number,number]=[origin[0]+(u-v)/Math.SQRT2,origin[1]+(-u-v)/Math.SQRT2];
      actors.push(model.startsWith('npc.')?{id:`figure-${i}`,kind:'pedestrian',at,yaw:-45,state:'idle',look:{model}}:actor(model,`figure-${i}`,at));
    }
    assert.equal(actors.length,30);
    await session.load({...base,name:'l10-street-crowd30',ground:'district',layout:{district:'D-CURE',bbox:[[origin[0]-30,origin[1]-30],[origin[0]+30,origin[1]+30]]},actors,camera:{mode:'game',target:[origin[0]-3,.6,origin[1]-3],zoom:1.5}});await session.step(3);await session.ready();
    const metrics=await session.metrics();assert.equal(Object.keys(metrics.actors).length,30);
    assert.ok(Object.values(metrics.actors).every(actor=>actor.drawnFrames>0),'All 30 figures must be drawn');
    const identities=await session.page.evaluate(()=>{
      const game=(window.__SCENE__ as unknown as {game:Game}).game,figures=game.view.crowdFigures();
      return [...game.world.entities.values()].filter(e=>e.infected||e.civilian&&!e.companion).map(e=>({entity:e.id,model:e.appearance?.asset??e.civilian?.model??e.infected?.model??e.infected?.variant,drawn:figures.find(f=>f.id===e.id&&f.drawn)?.appearance??null,drawnRig:figures.some(f=>f.id===e.id&&f.drawn)}));
    });
    for(const [i,model]of models.entries()) {
      const receipt=identities.find(row=>row.entity===metrics.actors[`figure-${i}`].entity);
      assert.equal(receipt?.model,model,`figure-${i} requested identity`);
      assert.equal(receipt?.drawnRig,true,`figure-${i} drawn rig`);
      if(!model.startsWith('inf.dog')) assert.equal(receipt?.drawn?.model,model,`figure-${i} drawn identity`);
      if(regularInfectedModels.includes(model as typeof regularInfectedModels[number])) assert.equal(receipt?.drawn?.accessory,null,`${model} keeps authored headwear`);
    }
    writeJson(`${out}/identities.json`,identities);
    for(const zoom of [1.5]){await session.page.evaluate(zoom=>window.__SS__!.camera.zoom(zoom),zoom);await session.screenshot(`${out}/zoom-${zoom}.png`);}
    writeJson(`${out}/metrics.json`,metrics);writeJson(`${out}/resources.json`,await session.page.evaluate(resources));
  } else if(mode==='states') {
    for(const model of ids.filter(id=>!process.env.L10_IDS||process.env.L10_IDS.split(',').includes(id))){
      await session.load({...base,name:`l10-states-${model}`,actors:[{id:'courier',kind:'courier',at:[7,0],god:true},actor(model)],camera:{mode:'game',target:'subject',zoom:.7},trace:true});
      await session.step(3);await session.screenshot(`${out}/${model}-idle.png`);
      await session.page.evaluate(()=>window.__SCENE__!.command('subject',{special:'alpha.roar',target:'courier'}));
      for(const frame of [30,60,120]){await session.step(frame===120?60:30);await session.screenshot(`${out}/${model}-roar-${frame}.png`);}
      const entity=(await session.metrics()).actors.subject.entity;
      await session.page.evaluate(entity=>{const game=(window.__SCENE__ as unknown as {game:Game}).game;game.world.combat!.damage.cure(game.world.entities.get(entity)!);},entity);
      await session.step(180);await session.screenshot(`${out}/${model}-corpse.png`);
      const metrics=await session.metrics();assert.equal(metrics.actors.subject.state,'dead');assert.equal(metrics.actors.subject.health,0);
      receipts.push({model,death:'canonical cure death, intact side-fall; boss rally probe separately verifies rocket kill',metrics});writeJson(`${out}/receipts.json`,receipts);
    }
  } else if(mode==='story') {
    for(const name of ['l10-crash-axe','l10-d2-military-breach','l10-e2-terminal','l10-e2-backpack','l10-mega-close-contact','l10-cure-install-defend','l10-cure-mist','qa-l10-epilogue']){
      const file=resolve('tests/scenes/catalog',`${name}.json`),spec=readSpec(file);spec.time='L10-night';
      const result=await runSpec(session,spec,{file,out:resolve(out,name),sheet:Math.max(1,Math.ceil((spec.frames??180)/6))});
      receipts.push({file,...result});writeJson(`${out}/receipts.json`,receipts);console.log(JSON.stringify({name,pass:result.pass,failed:result.failed}));
    }
  } else if(mode==='level'||mode==='population'||mode==='freeze') {
    await session.page.evaluate(async()=>{const api=window.__SS__!;await api.loadLevel('L10',{seed:327,checkpoint:'cure-complex',progression:'L10-default'});api.pause();api.cheats.god(true);api.camera.follow();(window.__SCENE__ as unknown as {game:Game}).game.world.megaPursuit!.introduce();});
    for(const [anchor,ticks]of [['cure-install',36],['cure-console',1]]as const){
      const [x,z]=cure.anchors[anchor];await session.page.evaluate(({x,z})=>window.__SS__!.teleport('player',{x,z}),{x,z});
      await session.page.keyboard.down('e');await session.page.evaluate(ticks=>window.__SS__!.step(ticks),ticks);await session.page.keyboard.up('e');await session.page.evaluate(()=>window.__SS__!.step(1));
    }
    await session.page.evaluate(async()=>{await window.__SS__!.step(3800);await window.__SS__!.screenshotReady();});
    await session.screenshot(`${out}/assault.png`);
    const sample=await session.page.evaluate(async()=>{
      const api=window.__SS__!,frames:number[]=[];api.resume();await new Promise(r=>setTimeout(r,1500));
      const warm={...api.perf().nodeBuildMaterials},start=performance.now();let previous=0;
      while(performance.now()-start<6000){const now=await new Promise<number>(requestAnimationFrame);if(previous)frames.push(now-previous);previous=now;}
      api.pause();frames.sort((a,b)=>a-b);const after=api.perf().nodeBuildMaterials;
      return {timing:'shared pool refresh-capped diagnostic; uncapped p95 acceptance pending PO quiet window',samples:frames.length,p95:frames[Math.ceil(frames.length*.95)-1],maxFrameMs:Math.max(...frames),over200:frames.filter(t=>t>200),shaderBuilds:Object.fromEntries(Object.entries(after).filter(([k,n])=>n!==warm[k])),ai:api.getState().ai?.count,mission:api.missions.state()?.states};
    });
    writeJson(`${out}/resources.json`,{sample,...await session.page.evaluate(resources)});console.log(JSON.stringify(sample));
    assert.deepEqual(sample.shaderBuilds,{});assert.deepEqual(sample.over200,[]);
  }
  assert.equal(session.errors.length,0,JSON.stringify(session.errors));
} finally { await session.close();stopServer(); }
