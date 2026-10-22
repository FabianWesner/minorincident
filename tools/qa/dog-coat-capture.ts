/** Visual-only authored LOD1 palette comparison. Other model materials are hidden after normal crowd selection. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Object3D, Material } from 'three/webgpu';
import type { Game } from '../../src/Game';
import { infectedDefinitions } from '../../src/data/infected';
import { SceneSession, stopServer } from '../scenelab/session';
const label = process.argv[2]; assert.ok(label === 'before' || label === 'after');
const out = 'test-results/ac-close-shared/dog-coats'; mkdirSync(out,{recursive:true});
const session = new SceneSession({ backend:'webgl2',tier:'low',viewport:{width:1600,height:900} });
try {
  await session.open();
  const targets = await session.page.evaluate(async roles => {
    const a=window.__SS__!;await a.loadScenario('horde-arena');a.pause();a.cheats.god(true);
    for(let i=0;i<180;i++)a.spawn(roles[i%roles.length],{x:0,z:-3},{state:'idle',perched:false});
    const targets=['inf.dog','inf.dog.black','inf.dog.cream'].map((variant,i)=>({variant,id:a.spawn('infected.dog',{x:(i-1)*1.5,z:2},{state:'idle',variant})}));
    a.camera.cinematic({position:[10,10,14],target:[0,.5,0]},true);await a.step(0);await a.screenshotReady();return targets;
  },infectedDefinitions.filter(d=>d.id!=='infected.dog'&&d.id!=='infected.crow').map(d=>d.id));
  const proof=await session.page.evaluate(targets=>{
    const game=(window.__SCENE__ as unknown as {game:Game}).game;
    const c=(game.view as unknown as {crowd:{batches:Map<string,{mesh:Object3D&{material:Material};probe:{figures:{id:number;lod?:string}[]}}> ;sharedDogCoats?:boolean;rolePixels:Map<string,number>}}).crowd;
    for(const [key,b]of c.batches)if(!/^inf\.dog(?:\.(?:black|cream))?:/.test(key))b.mesh.material.visible=false;
    return {label:'authored LOD1 only; non-dog materials hidden for visual comparison, no performance claim',targets:targets.map(t=>({...t,entity:window.__SS__!.getEntity(t.id),batches:[...c.batches].filter(([,b])=>b.probe.figures.some(f=>f.id===t.id)).map(([key,b])=>({key,lod:b.probe.figures.find(f=>f.id===t.id)!.lod}))})),roleModels:[...c.rolePixels.keys()],shared:c.sharedDogCoats??false};
  },targets);
  const image=await session.screenshot(`${out}/${label}.png`);
  writeFileSync(`${out}/${label}.json`,JSON.stringify({...proof,sha256:createHash('sha256').update(image).digest('hex'),errors:session.errors},null,2)+'\n');
  assert.equal(proof.shared,label==='after',`${label}: served runtime palette flag`);
  assert.ok(proof.targets.every(t=>t.batches.length===1&&t.batches[0].lod==='lod1'),JSON.stringify(proof.targets.map(t=>t.batches)));
  assert.ok(proof.roleModels.length>=26,`${proof.roleModels.length} visible model roles`);assert.deepEqual(session.errors,[]);
  console.log(JSON.stringify({label,roles:proof.roleModels.length,shared:proof.shared,targets:proof.targets.map(t=>({id:t.id,variant:t.variant,batches:t.batches}))}));
} finally {await session.close();stopServer();}
