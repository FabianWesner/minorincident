import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import{infectedDefinitions}from'../../src/data/infected';
import type{Game}from'../../src/Game';
import type {AssetDef} from '../../src/assets/types';
import type {SceneSpec,CameraSpec} from '../../src/debug/scenelab/spec';
import {SceneSession,stopServer,origin} from '../scenelab/session';
const [phase='after',out='docs/reports/q249/rollout/lineup',censusPath='docs/reports/q249/rollout/census.json',offset='0',count='999']=process.argv.slice(2);
const manifest=JSON.parse(readFileSync('src/assets/manifest.json','utf8')) as AssetDef[];
const census=JSON.parse(readFileSync(resolve(censusPath),'utf8')) as {rows:{id:string;rootName?:string;child?:boolean;error?:string;dimensions?:{y:number;z:number}}[]};
const rows=census.rows.filter(r=>!r.child&&!r.error&&(!process.env.Q249_IDS||process.env.Q249_IDS.split(',').includes(r.id))).slice(Number(offset),Number(offset)+Number(count));
const tier=process.env.Q249_TIER==='low'?'low':'high',label=phase+(tier==='low'?'-low':'');
const output=resolve(out);mkdirSync(output,{recursive:true});
const beforePath=resolve(output,'before-studio.json');
const before=existsSync(beforePath)?JSON.parse(readFileSync(beforePath,'utf8')) as Record<string,unknown>:{};
const receipt:Record<string,unknown>={};
const keyOf=(r:typeof rows[number])=>r.id+(r.rootName?'--'+r.rootName:'');
const session=new SceneSession({tier,viewport:{width:900,height:700},query:{skin:'1'},log:()=>{}});
try{
 await session.open();if(tier==='high'&&!process.env.Q249_STATES&&!process.env.Q249_SKIP_STUDIO){await session.page.goto(`${origin}/tools/q249/rollout-studio.html`);await session.page.waitForFunction(()=>!!(window as unknown as {__ROLLOUT__?:unknown}).__ROLLOUT__);
 for(const row of rows){
  const key=keyOf(row),def=manifest.find(d=>d.id===row.id)!;
  const path=row.id==='char.courier-male'?def.glb.replace('.glb','.skin.glb'):def.glb;
  const data=await session.page.evaluate(async({path,member,frozen})=>(window as unknown as {__ROLLOUT__:{show:(p:string,m?:string,f?:unknown)=>Promise<unknown>}}).__ROLLOUT__.show('/'+path.replace(/^public\//,''),member,frozen),{path,member:row.rootName,frozen:phase==='after'?(before[key] as {frame?:unknown})?.frame:undefined});
  await session.page.screenshot({path:resolve(output,`${phase}-${key}-studio.jpg`),type:'jpeg',quality:91});receipt[key]=data;console.log(phase,'studio',key);
 }
 writeFileSync(resolve(output,`${phase}-studio-${offset}.json`),JSON.stringify(receipt,null,2)+'\n');
 const all=existsSync(resolve(output,`${phase}-studio.json`))?JSON.parse(readFileSync(resolve(output,`${phase}-studio.json`),'utf8')):{};
 writeFileSync(resolve(output,`${phase}-studio.json`),JSON.stringify({...all,...receipt},null,2)+'\n');
 }
 for(const row of rows.filter(r=>!process.env.Q249_STUDIO_ONLY&&(!r.rootName||r.rootName==='survivor01_root'))){
  const def=manifest.find(d=>d.id===row.id)!,key=row.id;if(process.env.Q249_STATES&&!def.crowdSkin)continue;
  const spacing=Math.max(.5,Math.min(2.2,(row.dimensions??def.dimensions).z*.45));
  const spec:SceneSpec={name:'q249-'+row.id,ground:'sidewalk',time:'L1',dof:false,size:20,actors:[{id:'heroine',kind:'courier',at:[-spacing,spacing],yaw:315,look:{model:'female'},state:'idle'}],camera:{mode:'game',target:[0,Math.max(.7,(row.dimensions??def.dimensions).y*.35),0],zoom:1.5}};
  if(def.crowdSkin){spec.actors!.push({id:'figure',kind:row.id.startsWith('inf.')?'infected':'pedestrian',at:[spacing,-spacing],yaw:315,archetype:row.id.startsWith('inf.')?(infectedDefinitions.find(d=>d.asset===row.id&&d.id!=='infected.runner')?.id??(row.id.includes('alpha')?'infected.alpha':'infected.sprinter')):undefined,look:{model:row.id,accessories:['none']},state:'idle'});}
  else if(row.id!=='char.courier-male')spec.props=[{id:'figure',asset:row.id,at:[spacing,-spacing],yaw:315}];
  await session.load(spec);
  if(row.id==='char.courier-male')await session.page.evaluate(async({def,spacing,tier})=>{
   const path='/src/assets/registry.ts';const {AssetRegistry}=await import(path);const lab=window.__SCENE__ as unknown as{game:Game};const view=lab.game.view as unknown as{renderer:unknown;materials:unknown;scene:import('three').Scene};
   const skin={...def,glb:def.glb.replace('.glb',tier==='low'?'.skin.low.glb':'.skin.glb'),lods:{},crowdSkin:true,textureMode:'baseColor'};
   const registry=new AssetRegistry(()=>{},{manifest:[skin],renderer:view.renderer,materials:view.materials});const model=await registry.loadAsset(def.id);model.position.set(spacing,0,-spacing);model.rotation.y=315*Math.PI/180;model.updateMatrixWorld(true);view.scene.add(model);view.scene.updateMatrixWorld(true);
  },{def,spacing,tier});
  if(row.id.startsWith('inf.')&&def.crowdSkin){await session.page.evaluate(model=>{const lab=window.__SCENE__ as unknown as{game:Game;actors:Map<string,{entity:number}>};const e=lab.game.world.entities.get(lab.actors.get('figure')!.entity)!;e.infected!.model=model;delete e.appearance;},row.id);await session.step(1);}
  await session.ready();
  if(process.env.Q249_STATES){
   if(!row.id.startsWith('inf.'))await session.page.evaluate(()=>window.__SCENE__!.command('figure',{infect:{instant:true}}));
   await session.step(120);await session.page.evaluate(radius=>window.__SCENE__!.setCamera({mode:'close',target:[0,Math.max(.7,(row.dimensions??def.dimensions).y*.35),0],radius,azimuth:45}),Math.max(5,(row.dimensions??def.dimensions).y*2.6));await session.ready();
   await session.page.screenshot({path:resolve(output,`${label}-${key}-infected.jpg`),type:'jpeg',quality:91});
   await session.page.evaluate(()=>window.__SCENE__!.command('figure',{corpse:true}));await session.step(180);await session.ready();
   await session.page.screenshot({path:resolve(output,`${label}-${key}-corpse.jpg`),type:'jpeg',quality:91});
   writeFileSync(resolve(output,`${label}-${key}-states.json`),JSON.stringify(await session.metrics(),null,2)+'\n');console.log(phase,'states',key);continue;
  }

  for(const [view,camera]of Object.entries({game15:{mode:'game',target:[0,Math.max(.7,(row.dimensions??def.dimensions).y*.35),0],zoom:1.5},game1:{mode:'game',target:[0,Math.max(.7,(row.dimensions??def.dimensions).y*.35),0],zoom:1},close3m:{mode:'close',target:[0,Math.max(1.1,(row.dimensions??def.dimensions).y*.4),0],radius:Math.max(3,(row.dimensions??def.dimensions).y*1.8),azimuth:45}} as Record<string,CameraSpec>)){
   if(tier==='low'&&view==='close3m')continue;
   await session.page.evaluate(c=>window.__SCENE__!.setCamera(c),camera);await session.ready();await session.page.screenshot({path:resolve(output,`${label}-${key}-${view}.jpg`),type:'jpeg',quality:91});
  }
  console.log(phase,'game',key);
 }
 if(session.errors.length)throw Error(session.errors.join('\n'));
}finally{await session.close();stopServer();}
