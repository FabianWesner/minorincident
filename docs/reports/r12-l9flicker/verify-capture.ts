import { readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../../../tools/scenelab/session';
const [backend='webgpu',tier='high',level='l9']=process.argv.slice(2);
const session=new SceneSession({backend,tier,seed:1});
try {
 await session.open(); console.log("opened");
 await session.load(JSON.parse(readFileSync(`docs/reports/r12-l9flicker/${level==='l9'?'l9-start':'l10-campus'}.json`,'utf8')));
 console.log('loaded');
 if(level==='l9') await session.step(1170); else { await session.page.evaluate(()=>{window.__SCENE__.game.world.tick=38160;}); await session.step(1); }
 await session.ready(); console.log('ready');
 const depth=await session.page.evaluate(()=>{const rows=[];window.__SCENE__.game.view.districts.parts.terrain.traverse(o=>{if(o.isMesh)rows.push({name:o.name,layer:o.material.userData.groundLayer,bias:o.material.polygonOffsetUnits,enabled:o.material.polygonOffset});});return rows;});console.log(JSON.stringify({layers:[...new Set(depth.map(d=>d.layer))]}));if(!depth.some(d=>d.layer>0))throw Error('Ground depth priorities lost during material sharing');
 const samples=await session.page.evaluate(async()=>{
  const api=window.__SS__,canvas=document.querySelector('canvas')!,frames=[];api.resume();
  for(let i=0;i<30;i++){const now=await new Promise(requestAnimationFrame);frames.push({now,tick:api.tick(),rendered:api.perf().renderedFrames,png:canvas.toDataURL('image/png').split(',')[1]});}
  api.pause();return frames;
 });
 for(const i of [0,10,20]) writeFileSync(`/private/tmp/r12-${level}-${backend}-${tier}-${i}.png`,Buffer.from(samples[i].png!,'base64'));
 console.log('captured');
 const corners=[];
 const sites=level==='l9'?[[-550,7],[-450,0],[450,0],[-350,-330],[350,-330],[-300,240],[300,240],[-250,-30],[250,-30],[-365,-306],[-1,-337],[-9,-322],[182,-322],[271,-322],[-1,-342],[269,-318],[-379,132],[-232,250]]:[[2364,-75],[2250,-70],[2450,-70],[3740,-33],[3906,-39]];
 for(const [x,z] of sites){await session.page.evaluate(({x,z,zoom})=>{window.__SS__.teleport('player',{x,z});window.__SCENE__.setCamera({mode:'game',target:[x,z],zoom});},{x,z,zoom:level==='l9'?1.14:1.3});await session.step(2);await session.ready();corners.push({x,z,perf:await session.page.evaluate(()=>window.__SS__.perf())});}
 const receipt={backend,tier,level,depth,errors:session.errors,frames:samples.map(({png,...f})=>f),corners,state:await session.page.evaluate(()=>window.__SS__.getState().render)};
 writeFileSync(`docs/reports/r12-l9flicker/${level}-${backend}-${tier}-after.json`,JSON.stringify(receipt,null,2));
 console.log(JSON.stringify({backend,tier,level,errors:session.errors,frames:receipt.frames}));
}finally{await session.close();stopServer();}
