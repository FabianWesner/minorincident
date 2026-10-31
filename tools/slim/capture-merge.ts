/** Compare the actual player across both merge parents and the combined repair. */
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {SceneSession,stopServer} from '../scenelab/session';
const out='docs/reports/slim/merge', selected=process.env.SLIM_MERGE_PHASES?.split(','), rows:unknown[]=selected?(JSON.parse(readFileSync(`${out}/capture.json`,'utf8')) as {rows:{phase:string}[]}).rows.filter(r=>!selected.includes(r.phase)):[];
const files=['char.courier-male.skin.glb','char.courier-male.skin.low.glb','acc.courier-gear.male.tiers.glb','acc.courier-gear.male.tiers.low.glb','acc.courier-gear.male.tiers.lod2.glb'];
try {
 for(const phase of ['main','slim','merged','merged-lod2','main-lod2','slim-lod2'] as const) for(const quality of ['high','low'] as const) {
  if(selected&&!selected.includes(phase)||phase.endsWith('-lod2')&&quality==='low') continue;
  const revision=phase.startsWith('main')?'b0aac03dd99be27e63c9737edc7de0c4759e7ea1':phase.startsWith('slim')?'146de330b':undefined;
  const data=new Map(files.map(f=>[f,revision?execFileSync('git',['show',`${revision}:public/assets/models/${f}`],{maxBuffer:16*1024*1024}):readFileSync(`public/assets/models/${f}`)]));
  const s=new SceneSession({tier:quality,viewport:{width:1800,height:1600},deviceScaleFactor:2,query:{dpr:'2',skin:'1'}});
  const dir=`${out}/crops/${phase}-${quality}`;mkdirSync(dir,{recursive:true});
  try {
   await s.open();
   await s.page.route('**/assets/models/**',async route=>{
    let name=new URL(route.request().url()).pathname.split('/').pop()!;
    if(phase.endsWith('-lod2')&&name==='acc.courier-gear.male.tiers.glb') name='acc.courier-gear.male.tiers.lod2.glb';
    const body=data.get(name);if(body) await route.fulfill({body,contentType:'model/gltf-binary'});else await route.continue();
   });
   await s.page.reload();await s.page.waitForFunction(()=>!!window.__SS__&&!!window.__SCENE__);await s.page.evaluate(async()=>{await window.__SS__!.ready;window.__SS__!.pause();});
   for(const zoom of [1.5,.5]) for(const tier of [0,1,2,3,4]) for(const [view,yaw] of [['front',-45],['side',45],['three-quarter',0]] as const) {
    await s.load({name:`merge-${phase}`,ground:'sidewalk',time:'L1',size:20,dof:false,actors:[{id:'courier',kind:'courier',at:[0,0],yaw,look:{model:'male',gearTier:tier},state:'idle'}],camera:{mode:'game',target:[0,.8,0],zoom}});
    // AmbientLife's GPU petals can cross the shirt. Omit only atmosphere for this asset comparison.
    await s.page.evaluate(()=>{const v=(window.__SCENE__ as unknown as {game:{view:{scene:import('three').Scene}}}).game.view;const ambient=v.scene.getObjectByName('ambient-gpu-life');if(ambient)ambient.visible=false;});
    await s.step(60);await s.ready();
    const clip=await s.page.evaluate(async()=>{const path='/tools/slim/garment-render.ts';return(await import(path)).courierClip();});
    await s.page.screenshot({path:`${dir}/z${zoom}-t${tier}-${view}.jpg`,type:'jpeg',quality:96,clip});
    rows.push({phase,revision:revision??'combined working tree',ambientLifeOmitted:true,quality,zoom,tier,view,clip,metrics:await s.metrics()});
    writeFileSync(`${out}/capture.json`,JSON.stringify({rows},null,2)+'\n');console.log(phase,quality,zoom,tier,view);
   }
   if(s.errors.length)throw Error(s.errors.join('\n'));
  }finally{await s.close();}
 }
}finally{stopServer();}
