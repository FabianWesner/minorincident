import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
const { SceneSession, readSpec, stopServer } = await import(pathToFileURL(resolve('tools/scenelab/session.ts')).href);
const s = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width:1600,height:900 } });
const geared = readSpec('tests/scenes/catalog/seethrough-gear-four.json'), gate=readSpec('tests/scenes/catalog/seethrough-door-gate.json');
try {
 await s.open();
 const rows=[];
 for(const sequence of [[gate],[geared,gate]]) {
  const r=await s.page.evaluate(async specs=>{
   const l:any=window.__SCENE__,a=window.__SS__;
   for(const spec of specs){await l.load(spec);await l.ready();}
   const samples=[];let last=-1;
   for(let i=0;i<250;i++){
    await l.step(1);const v=l.game.view,p=a!.perf();
    if(p.drawCalls!==last){last=p.drawCalls;const meshes:any[]=[];v.scene.traverseVisible((o:any)=>{if(o.isMesh)meshes.push({name:o.name,group:o.parent?.name,type:o.type,count:o.count,castShadow:o.castShadow,geometry:o.geometry?.type});});samples.push({frame:i+1,draws:p.drawCalls,profile:structuredClone(v.renderer.profile),effects:v.vfx?.snapshot().blasts,meshes});}
   }
   return {before:a!.getState().render.character!.gearTier,metrics:(await l.metrics()).perf,samples};
  },sequence);
  rows.push({sequence:sequence.map(s=>s.name),...r});
 }
 writeFileSync(process.argv[2],JSON.stringify(rows,null,2));
} finally {await s.close();stopServer();}
