/** Controlled survival-protected L4 renderer route: shared corpse layout audit and pile/route captures. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import type { Game } from '../../src/Game';
import type { BufferGeometry, InstancedMesh, Object3D } from 'three/webgpu';
import type { EntitySnapshot } from '../../src/sim/world/types';
import { preset } from '../../src/sim/progression/Campaign';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
const tier=(process.argv[2]==='high'?'high':'low') as 'low'|'high',stage=process.argv[3]??'before',out=`test-results/blk-v/${stage}/L4-${tier}`;mkdirSync(`${out}/captures`,{recursive:true});
const counterexample=process.argv.includes('--counterexample'),warOnly=process.argv.includes('--war-only');
const identity=provenance(),session=new SceneSession({tier,backend:'webgl2',query:{profile:'0',ui:'1'}}),samples:unknown[]=[],captures:unknown[]=[];
try{
 await session.open();await session.page.evaluate('window.__name = f => f');const save=preset('L4-default');save.settings.quality=tier;
 await session.page.evaluate(async({tier,save})=>{
  const a=window.__SS__!;a.campaign.restore(save);await a.loadLevel('L4',{seed:1});a.pause();a.settings.set({quality:tier,cameraShake:false});a.cheats.god(true);a.missions.begin();a.camera.follow();a.camera.zoom(1);a.bot.start('complete');document.documentElement.setAttribute('data-scene-hud','');
 },{tier,save});
 let warPhoto=false,failPhoto=false,entry=false;
 for(let i=0;i<600;i++){
  await session.page.evaluate(async()=>{await window.__SS__!.step(60);});
  const sample=await session.page.evaluate(async()=>{
   const g=(window.__SCENE__ as unknown as {game:Game}).game,w=g.world,s=w.missions!.state.l4!;
   const path='/src/render/characters/CorpseLayout.ts',module=await import(/* @vite-ignore */path);
   const layout=module.corpseLayout(w),audit=layout.audit();
   const bodies=[...layout.bodies.values()] as {x:number;y:number;z:number;height:number;body:{id:number;transform:{y:number}}}[];
   const piles=bodies.map(p=>({id:p.body.id,x:p.x,y:p.y,z:p.z,height:p.height,rootLift:p.y-(p.body.transform.y-.7),top:p.y+p.height-(p.body.transform.y-.7)}));
   const worstLayout=piles.sort((a,b)=>b.top-a.top)[0]??null;
   // Measure the actual frozen vertices, not the layout's thin collision strip.
   const owners=new Set<Object3D>();g.view.scene.traverse(node=>{const mesh=node as InstancedMesh;if(mesh.instanceMatrix&&mesh.name.startsWith('corpses:')&&mesh.parent)owners.add(mesh.parent);});
   const scope=window as unknown as {__corpseVertexCache?:WeakMap<BufferGeometry,Map<string,{min:number;max:number}>>};
   const cache=scope.__corpseVertexCache??=new WeakMap();
   let worstRendered:{id:number;x:number;y:number;z:number;top:number;mesh:string;vertices:number}|null=null;const frozenIds=new Set<number>();
   for(const owner of owners){
    const pool=owner as unknown as {slots:Map<string,{page:{mesh:InstancedMesh};index:number}>;bodies:Map<string,EntitySnapshot>};
    for(const [key,slot]of pool.slots){
     const body=pool.bodies.get(key);if(!body||body.corpseThrown&&body.corpseBlast)continue;
     const mesh=slot.page.mesh,im=mesh.instanceMatrix.array,mw=mesh.matrixWorld.elements,o=slot.index*16;
     const x=mw[1]*im[o]+mw[5]*im[o+1]+mw[9]*im[o+2],y=mw[1]*im[o+4]+mw[5]*im[o+5]+mw[9]*im[o+6],z=mw[1]*im[o+8]+mw[5]*im[o+9]+mw[9]*im[o+10];
     const ty=mw[1]*im[o+12]+mw[5]*im[o+13]+mw[9]*im[o+14]+mw[13],signature=`${x},${y},${z}`;
     let projections=cache.get(mesh.geometry);if(!projections){projections=new Map();cache.set(mesh.geometry,projections);}
     let bounds=projections.get(signature);const positions=mesh.geometry.getAttribute('position');
     if(!bounds){let min=Infinity,max=-Infinity;for(let i=0;i<positions.count;i++){const v=x*positions.getX(i)+y*positions.getY(i)+z*positions.getZ(i);min=Math.min(min,v);max=Math.max(max,v);}bounds={min,max};projections.set(signature,bounds);}
     frozenIds.add(body.id);const top=ty+bounds.max-(body.transform.y-.7);
     if(!worstRendered||top>worstRendered.top)worstRendered={id:body.id,x:mw[0]*im[o+12]+mw[4]*im[o+13]+mw[8]*im[o+14]+mw[12],y:ty,z:mw[2]*im[o+12]+mw[6]*im[o+13]+mw[10]*im[o+14]+mw[14],top,mesh:mesh.name,vertices:positions.count};
    }
   }
   const player=w.entities.get(1)!.transform,near=w.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission&&!e.corpse).sort((a,b)=>Math.hypot(a.transform.x-player.x,a.transform.z-player.z)-Math.hypot(b.transform.x-player.x,b.transform.z-player.z)).slice(0,20);
   const models=new Map<string,number>();for(const e of near){const model=e.infected!.model??e.appearance?.asset??e.infected!.variant;models.set(model,(models.get(model)??0)+1);}
   const renderedLookBatches=g.view.getState().crowd?.batches.filter(b=>b.instances>0).map(b=>({id:b.id,lod:b.lod,instances:b.instances}))??[];
   return{corpseIds:[...w.entities.iterate()].filter(e=>e.corpse).map(e=>e.id).sort((a,b)=>a-b),tick:w.tick,phase:s.phase,warSeconds:s.warAt?(w.tick-s.warAt)/60:0,actualTier:w.infected!.director.tier,renderTier:g.view.getState().quality,backend:g.view.getState().backend,audit,layoutEnvelopeTopM:worstLayout?.top??0,maxRenderedTopM:worstRendered?.top??0,frozenBodies:frozenIds.size,worst:worstRendered??worstLayout,nearest20Looks:{count:near.length,models:Object.fromEntries(models)},renderedLookBatches,player:{...player},deaths:w.missions!.state.stats.deaths,descendAt:s.descendAt};
  });samples.push(sample);
  assert.equal(sample.actualTier,tier);assert.equal(sample.renderTier,tier);
  if(sample.audit.count>20)assert(sample.frozenBodies>0&&sample.maxRenderedTopM>0,'retained frozen vertices must be measured');
  const reason=!warPhoto&&sample.warSeconds>=120?'war-120':!failPhoto&&sample.maxRenderedTopM>1.05?'tall-pile':sample.descendAt?'cellar-entry':null;
  if(reason){
   if(reason==='war-120')warPhoto=true;if(reason==='tall-pile')failPhoto=true;
   for(const zoom of [.5,1.5]){
    await session.page.evaluate(async zoom=>{const a=window.__SS__!,g=(window.__SCENE__ as unknown as {game:Game}).game;a.camera.follow();a.camera.zoom(zoom);g.view.view.update(g.world.entities.get(1)!.transform,1);await a.screenshotReady();},zoom);
    const file=`${out}/captures/${reason}-z${zoom}-route.jpg`;await session.page.screenshot({path:file,type:'jpeg',quality:92});captures.push({file,reason,zoom,view:'ordinary follow',sample});
    if(sample.worst){
     await session.page.evaluate(async({p,zoom})=>{const a=window.__SS__!;a.camera.cinematic({position:[p.x+15*zoom,p.y+19*zoom,p.z+15*zoom],target:[p.x,p.y,p.z]},true);await a.screenshotReady();},{p:sample.worst,zoom});
     const file=`${out}/captures/${reason}-z${zoom}-pile.jpg`;await session.page.screenshot({path:file,type:'jpeg',quality:92});captures.push({file,reason,zoom,view:'render-only heap detail; courier unmoved',sample});
    }
   }
   await session.page.evaluate(async()=>{const a=window.__SS__!,g=(window.__SCENE__ as unknown as {game:Game}).game;a.camera.follow();a.camera.zoom(1);g.view.view.update(g.world.entities.get(1)!.transform,1);await a.screenshotReady();});
  }
  writeFileSync(`${out}/receipt.json.gz`,gzipSync(JSON.stringify({...identity,tier,method:'Controlled renderer route: production complete-bot InputFrames and survival-protected courier from progressed L4 start, no objective advance or actor repositioning. Production renderer/corpseLayout audit after every rendered sim second. Airborne corpseBlast flights are excluded. Frozen instance geometry vertices are projected through actual instance/world matrices and compared to source feet; the layout envelope height is reported separately. Heap details move only the paused camera; the follow blend is completed before the next sim tick. courierClear is footprint telemetry, not a pixel-ordering assertion.',counterexample,warOnly,samples,captures,errors:session.errors})));
  if(sample.descendAt){entry=true;break;}
  if(counterexample&&failPhoto||warOnly&&sample.warSeconds>=150)break;
 }
 console.log(JSON.stringify({tier,entry,samples:samples.length,captures:captures.length,errors:session.errors}));
 assert(entry||(counterexample||warOnly)&&failPhoto,'full route must reach cellar; counterexample mode must measure a >1.05m settled frozen body');assert(!session.errors.length);
}finally{await session.close();stopServer();}
