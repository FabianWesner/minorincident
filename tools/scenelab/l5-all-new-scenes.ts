/** L5 production-renderer crowd, state and scripted-scene evidence; one pooled browser job. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadavg } from 'node:os';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import type { ActorSpec, SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';
const tier = process.env.REVIEW_TIER === 'high' ? 'high' : 'low';
const backend = process.env.REVIEW_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const mode = process.env.L5_CAPTURE ?? 'crowd', variant = process.env.REVIEW_VARIANT ?? 'new';
const base = 'c0dc2ff43';
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = resolve(`test-results/l5-all-new/${mode}-${variant}-${tier}-${backend}`);
const converted = (JSON.parse(readFileSync('docs/reports/l5-all-new/census.json','utf8')) as {scope:string[]}).scope;
const crowd30: SceneSpec = {
 name: 'l5-street-crowd30', ground: 'district', time: 'L5', tier: 5, size: 100,
 layout: { district: 'D-FAIR', level: 'L5', bbox: [[-34,-13],[-6,12]] },
 actors: Array.from({length:30},(_,i):ActorSpec=>{
  const at:[number,number]=[-33.1+i%10*1.8,-3.5+Math.floor(i/10)*3.5];
  if(i===0)return {id:'courier',kind:'courier',at,yaw:-45,loadout:['weapon.fire-axe','weapon.shotgun'],state:{aim:'alpha'}};
  if(i===1)return {id:'corgi',kind:'corgi',at,yaw:-45};
  if(i===2)return {id:'alpha',kind:'infected',archetype:'infected.alpha',look:{model:'inf.alpha'},at,yaw:-45,state:'idle'};
  const model=i<27?converted[(i-3)%converted.length]:['npc.national-guard','npc.civilian-man-a','npc.civilian-woman-b'][i-27];
  return {id:`ped-${i}`,kind:'pedestrian',at,yaw:-45,look:{model,accessories:[]},state:'idle'};
 }),
 script:[{frame:1,actor:'courier',do:{select:'RIGHT'}},{frame:2,actor:'courier',do:{aim:'alpha',seconds:30}}],
 camera:{mode:'game',target:[-24,.6,1],zoom:1.5},frames:3,shots:[3],expect:{consoleErrors:0},
};
const states:SceneSpec={name:'l5-body-states',ground:'asphalt',time:'L5',size:100,
 actors:[{id:'courier',kind:'courier',at:[30,30]},...converted.flatMap((model,i):ActorSpec[]=>['live','turned','dead'].map((state,k)=>({id:`${state}-${i}`,kind:'pedestrian',at:[i%4*3,Math.floor(i/4)*12+k*3],yaw:-45,look:{model,accessories:[]},state:'idle'})))],
 script:converted.flatMap((_,i)=>[{frame:3,actor:`turned-${i}`,do:{infect:{instant:true}}},{frame:3,actor:`dead-${i}`,do:{corpse:true as const}}]),
 camera:{mode:'game',target:[4.5,.5,8.5],zoom:.8},frames:120,shots:[120],expect:{consoleErrors:0},
};
function resourceSnapshot() {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const textures = new Set<import('three').Texture>();
      game.view.scene.traverse(node => {
        const mesh = node as import('three').Mesh;
        if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) for (const value of Object.values(material)) if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as import('three').Texture);
        for (const texture of node.userData.preRenderTextures ?? []) textures.add(texture);
      });
      let decodedBytes = 0, rgbaUpperBoundBytes = 0;
      for (const texture of textures) {
        const image = texture.image as { width?: number; height?: number; data?: { byteLength: number } };
        if (!image?.width || !image.height) continue;
        const mips = texture.mipmaps as { data?: { byteLength: number } }[];
        decodedBytes += mips.reduce((n, mip) => n + (mip.data?.byteLength ?? 0), 0) || image.data?.byteLength || Math.ceil(image.width * image.height * 4 * (texture.generateMipmaps ? 4 / 3 : 1));
        rgbaUpperBoundBytes += image.data?.byteLength ?? Math.ceil(image.width * image.height * 4 * (texture.generateMipmaps || mips.length > 1 ? 4 / 3 : 1));
      }
      const heldProps = game.view.labProbes().heldProps.map(contact => {
        const p=contact.geometry.getAttribute('position'),m=contact.matrix.elements;let minY=Infinity;
        for(let i=0;i<p.count;i++)minY=Math.min(minY,m[1]*p.getX(i)+m[5]*p.getY(i)+m[9]*p.getZ(i)+m[13]);
        return {entity:contact.entity,prop:contact.prop,minY,floorY:game.world.entities.get(contact.entity)!.transform.y-.7};
      });
      const render = window.__SS__!.getState().render;
      return { textureCount: textures.size, decodedBytes, rgbaUpperBoundBytes, heldProps, render: { crowd: render.crowd ? { batches: render.crowd.batches.map(({ id, instances, lod, source }) => ({ id, instances, lod, source })) } : null } };
}
const session=new SceneSession({backend,tier,viewport:{width:1600,height:900},query:{crowdProbe:'full'}});
const receipts:unknown[]=[];
try{
 await session.open();
 await session.page.addInitScript("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
 await session.page.evaluate("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
 if(variant==='old'){
  for(const file of ['src/assets/manifest.json','src/assets/civilianBakes.json']){
   const data=execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8'});
   await session.page.context().route(`**/${file}*`,route=>route.fulfill({contentType:'application/javascript',body:`export default ${data};`}));
  }
  const bakes=JSON.parse(execFileSync('git',['show',`${base}:src/assets/civilianBakes.json`],{encoding:'utf8'})) as Record<string,string>;
  for(const path of new Set(Object.values(bakes)))await session.page.context().route(`**${path}`,route=>route.fulfill({contentType:'application/octet-stream',body:execFileSync('git',['show',`${base}:public${path}`],{maxBuffer:8*1024*1024})}));
  await session.page.reload();await session.page.waitForFunction(()=>!!window.__SCENE__&&!!window.__SS__);
  await session.page.evaluate(async()=>{await window.__SS__!.ready;window.__SS__!.pause();});
 }
 const actual=await session.page.evaluate(()=>window.__SS__!.getState().render);
 assert.equal(actual.backend,backend==='webgl2'?'webgl':'webgpu');assert.equal(actual.quality,tier);
 if(mode==='story'){
  const files=readdirSync('specs/scenes').filter(n=>n.startsWith('qa-l5-')&&n.endsWith('.json')&&!n.endsWith('-l4.json'));
  for(const name of files){
   const file=resolve('specs/scenes',name),spec=readSpec(file);
   const result=await runSpec(session,spec,{file,out:resolve(out,spec.name!),sheet:Math.max(60,Math.ceil((spec.frames??180)/12))});
   receipts.push({revision,base,requestedBackend:backend,tier,file,...result});writeJson(`${out}/receipts.json`,receipts);
   assert.ok(result.pass,JSON.stringify({scene:spec.name,failed:result.failed}));
  }
 }else{
  const spec=mode==='states'?states:crowd30;
  const result=await runSpec(session,spec,{out,sheet:0});assert.ok(result.pass,JSON.stringify(result.failed));
  const metrics=await session.metrics(),resources=await session.page.evaluate(resourceSnapshot);
  if (mode === 'crowd' && variant === 'new') for (const held of resources.heldProps.filter(p => p.prop === 'cane')) assert.ok(Math.abs(held.minY - held.floorY) < .001, `cane floor contact: ${JSON.stringify(held)}`);
  if(mode!=='states'){
   assert.equal(Object.keys(metrics.actors).length,30);assert.ok(Object.values(metrics.actors).every(a=>a.drawnFrames>0),'Every crowd figure submitted');
   for(const zoom of [1,1.5]){await session.page.evaluate(zoom=>window.__SS__!.camera.zoom(zoom),zoom);await session.ready();await session.screenshot(`${out}/zoom-${zoom}.png`);}
   for(const [label,target] of [['okafor-cane',[-24.1,.7,-3.5]],['courier-shotgun',[-33.1,.7,-3.5]]] as const){await session.page.evaluate(target=>window.__SCENE__!.setCamera({mode:'game',target:[...target],zoom:.55}),target);await session.ready();await session.screenshot(`${out}/${label}.png`);}
   if(process.env.L5_TIMING==='1'){
    await session.page.evaluate(()=>window.__SCENE__!.setCamera({mode:'game',target:[-24,.6,1],zoom:1.5}));await session.ready();
    const cadence=await session.page.evaluate(async()=>{
     const api=window.__SS__!;api.resume();const frames:number[]=[];let previous=0,warm:Record<string,number>={};
     for(let i=0;i<720;i++){const now=await new Promise<number>(requestAnimationFrame);if(i===119)warm={...api.perf().nodeBuildMaterials};if(i>=120&&previous)frames.push(now-previous);previous=now;}
     api.pause();frames.sort((a,b)=>a-b);return {count:frames.length,p95:frames[Math.ceil(frames.length*.95)-1],max:frames.at(-1),over200:frames.filter(t=>t>200).length,builds:Object.entries(api.perf().nodeBuildMaterials).filter(([key,count])=>count!==(warm[key]??0)),perf:api.perf()};
    });
    writeJson(`${out}/cadence.json`,{revision,base,variant,tier,backend,hostLoad:loadavg(),cadence,status:'Shared-host diagnostic; final quiet-window performance pending'});
    assert.equal(cadence.over200,0);assert.deepEqual(cadence.builds,[]);
   }
  }else{
   for(let i=0;i<2;i++){await session.page.evaluate(i=>window.__SCENE__!.setCamera({mode:'game',target:[4.5,.6,i*12+3],zoom:1.5}),i);await session.ready();await session.screenshot(`${out}/group-${i}.png`);}
  }
  writeJson(`${out}/receipt.json`,{revision,base,variant,tier,backend,result,metrics,resources,errors:session.errors});
 }
 if(session.errors.length)throw Error(session.errors.join('\n'));
}finally{await session.close();stopServer();}
