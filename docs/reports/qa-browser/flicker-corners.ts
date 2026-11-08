/** Thirty real rendered frames at every reported corner, including camera movement. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../../../tools/scenelab/session';
const [backend='webgpu',tier='high',level='l9']=process.argv.slice(2),key=`${level}-${backend}-${tier}${process.env.QA_CORNER_IDS?'-detail':''}`;
const raw=`/private/tmp/qa-browser-corners/${key}`,out='docs/reports/qa-browser/flicker';mkdirSync(raw,{recursive:true});
const s=new SceneSession({backend:backend as 'webgpu'|'webgl2',tier:tier as 'high'|'low'}),rows=[];
try{
 await s.open();await s.load(JSON.parse(readFileSync(`docs/reports/r12-l9flicker/${level==='l9'?'l9-start':'l10-campus'}.json`,'utf8')));
 const sites=level==='l9'?[[-550,7],[-450,0],[450,0],[-350,-330],[350,-330],[-300,240],[300,240],[-250,-30],[250,-30],[-365,-306],[-1,-337],[-9,-322],[182,-322],[271,-322],[-1,-342],[269,-318],[-379,132],[-232,250]]:[[2364,-75],[2250,-70],[2450,-70],[3740,-33],[3906,-39]];
 for(const [i,[x,z]] of sites.entries()){
  if(process.env.QA_CORNER_IDS&&!process.env.QA_CORNER_IDS.split(',').includes(String(i)))continue;
  await s.page.evaluate(({x,z,zoom})=>{window.__SS__!.teleport('player',{x,z});window.__SCENE__.setCamera({mode:'game',target:[x,z],zoom});},{x,z,zoom:level==='l9'?1.14:1.3});await s.ready();
  const frames=await s.page.evaluate(async({x,z,zoom,detail})=>{
   const a=window.__SS__!,canvas=window.__SCENE__.game.view.renderer.domElement,strip=document.createElement('canvas');strip.width=30*128;strip.height=96;const ctx=strip.getContext('2d')!,rows=[],fulls=[];a.resume();
   for(let i=0;i<30;i++){
    if(i===15){window.__SCENE__.camera={mode:'game',target:[x+.15,z+.1],zoom};window.__SCENE__.applyCamera();}
    const now=await new Promise<number>(requestAnimationFrame);rows.push({now,tick:a.tick(),rendered:a.perf().renderedFrames});if(detail&&[0,14,15,29].includes(i))fulls.push({frame:i,jpeg:canvas.toDataURL('image/jpeg',.9).split(',')[1]});ctx.drawImage(canvas,440,360,480,360,i*128,0,128,96);
   }a.pause();return{rows,fulls,jpeg:strip.toDataURL('image/jpeg',.85).split(',')[1],backend:a.getState().render.backend,quality:a.getState().render.quality};
  },{x,z,zoom:level==='l9'?1.14:1.3,detail:!!process.env.QA_CORNER_IDS});
  for(const f of frames.fulls)writeFileSync(`${raw}/corner-${i}-frame-${f.frame}.jpg`,Buffer.from(f.jpeg,'base64'));
  const file=`corner-${i}.jpg`;writeFileSync(`${raw}/${file}`,Buffer.from(frames.jpeg,'base64'));rows.push({x,z,file,...frames,jpeg:undefined,fulls:undefined,consecutive:frames.rows.every((f,j)=>!j||f.rendered===frames.rows[j-1].rendered+1)});
 }
 console.log(`${key}: ${rows.length} corners × 30 real RAF frames`);
}catch(error){rows.push({error:String(error)});process.exitCode=1;console.error(error);}
finally{writeFileSync(`${out}/${key}-corner-frames.json`,JSON.stringify({rows,errors:s.errors},null,2));await s.close();stopServer();}
