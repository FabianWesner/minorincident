import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, origin, stopServer } from '../scenelab/session';
const dir='docs/scenes/l3-roofs/catalog';mkdirSync(dir,{recursive:true});
const selected=new Set(process.argv.slice(2));
const ids=(JSON.parse(readFileSync('src/assets/manifest.json','utf8')) as {id:string;decayVariants:string[]}[]).filter(a=>/^(bld\.|house\.|int\.)/.test(a.id)&&(!selected.size||selected.has(a.id))).flatMap(a=>['',...a.decayVariants].map(decay=>({id:a.id,decay})));
const session=new SceneSession({viewport:{width:400,height:300},log:()=>{}});
try{
 await session.open();
 for(const {id,decay} of ids){
  await session.page.goto(`${origin}/preview/?asset=${id}&test=1&renderer=webgl&production=1&inspection=1`);
  await session.page.waitForFunction(()=>!!window.__ASSET__);await session.page.evaluate(()=>window.__ASSET__!.ready);
  if(decay) await session.page.evaluate(value=>{document.querySelector<HTMLSelectElement>('#decay')!.value=value;},decay);
  await session.page.locator('#toolbar').evaluate(el=>{el.style.display='none';});
  const sheet=new PNG({width:1200,height:600});
  for(const [row,azimuth] of [45,225].entries())for(const [column,quality] of (['high','lod1','lod2'] as const).entries()){
   await session.page.evaluate(async({quality,azimuth})=>{await window.__ASSET__!.inspectionView!(quality,azimuth,true);},{quality,azimuth});
   if(await session.page.evaluate(()=>window.__ASSET__!.info().placeholder))throw Error(`${id}:${quality} placeholder`);
   await session.page.evaluate(label=>{let el=document.getElementById('roof-label');if(!el){el=document.createElement('div');el.id='roof-label';el.style.cssText='position:fixed;top:0;left:0;color:white;background:#25222ccc;font:12px sans-serif;padding:5px';document.body.append(el);}el.textContent=label;},`${id} ${quality} ${azimuth}°`);
   PNG.bitblt(PNG.sync.read(await session.page.screenshot()),sheet,0,0,400,300,column*400,row*300);
  }
  // Encode contact sheets as JPEG to keep review evidence small.
  const encoded=await session.page.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d')!.drawImage(img,0,0);return c.toDataURL('image/jpeg',.82).split(',')[1];},`data:image/png;base64,${PNG.sync.write(sheet).toString('base64')}`);
  writeFileSync(`${dir}/${id}${decay?`.${decay}`:''}.jpg`,Buffer.from(encoded,'base64'));console.log(id,decay);
 }
 if(session.errors.length)throw Error(session.errors.join('\n'));
}finally{await session.close();stopServer();}
