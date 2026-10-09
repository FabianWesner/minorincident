/** Reproducible headless evidence: run under tools/e2e-lock.sh. */
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { referenceFor } from '../../tools/assets/turntable.ts';
const directory='test-results/l4-fairhaven-civic-buildings';
const measurements=JSON.parse(readFileSync(`${directory}/measurements.json`,'utf8'));
const peers=['bld.mainstreet-brick','bld.mainstreet-brick','bld.civic-center','bld.house-b'];
const definitions=JSON.parse(readFileSync('src/assets/manifest.json','utf8'));
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:300,height:240}});
const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
function fill(w:number,h:number){const p=new PNG({width:w,height:h});for(let i=0;i<p.data.length;i+=4){p.data[i]=42;p.data[i+1]=39;p.data[i+2]=48;p.data[i+3]=255;}return p;}
function tile(source:PNG,target:PNG,x:number,y:number,w:number,h:number){const scale=Math.min(w/source.width,h/source.height);const rw=Math.round(source.width*scale),rh=Math.round(source.height*scale);x+=Math.floor((w-rw)/2);y+=Math.floor((h-rh)/2);for(let yy=0;yy<rh;yy++)for(let xx=0;xx<rw;xx++){const a=(Math.floor(yy/scale)*source.width+Math.floor(xx/scale))*4;const b=((y+yy)*target.width+x+xx)*4;source.data.copy(target.data,b,a,a+4);}}
async function open(id:string){await page.goto(`http://127.0.0.1:${process.env.E2E_PORT??3327}/preview/?asset=${id}&test=1&renderer=webgl&production=1`);await page.waitForFunction(()=>!!window.__ASSET__);await page.evaluate(()=>window.__ASSET__!.ready);await page.locator('#toolbar').evaluate(el=>el.style.display='none');}
async function label(text:string){await page.evaluate(text=>{let el=document.querySelector<HTMLDivElement>('#qa-label');if(!el){el=document.createElement('div');el.id='qa-label';el.style.cssText='position:fixed;top:0;color:white;background:#17151bcc;font:11px sans-serif;padding:4px';document.body.append(el);}el.textContent=text;},text);}
function distance(d:number[],pixels:number){const elevation=Math.PI*.2;const h=d[1]*Math.cos(elevation)+(d[0]+d[2])*Math.SQRT1_2*Math.sin(elevation);return h*240/(2*Math.tan(25*Math.PI/360)*pixels);}
try{
 for(const [index,item] of measurements.entries()){
  const sheet=fill(1600,480),cutaway=fill(900,240);const info=[];const id=item.id;const d=item.tiers[0].dimensions;
  const ref=PNG.sync.read(readFileSync(referenceFor(id)));tile(ref,sheet,0,0,400,480);
  await open(id);
  for(const [column,quality] of (['high','lod1','lod2'] as const).entries()){
   for(const [row,pixels] of [135,190].entries()){
    await page.evaluate(async({quality,distance})=>window.__ASSET__!.deliveryView!(quality,distance),{quality,distance:distance(d,pixels)});
    await label(`${id} ${quality==='high'?'LOD0':quality} | ~${pixels}px`);
    const state=await page.evaluate(()=>window.__ASSET__!.info());if(state.placeholder)throw new Error(`${id} ${quality}: placeholder`);info.push({quality,pixels,...state});
    tile(PNG.sync.read(await page.screenshot()),sheet,400+column*300,row*240,300,240);
   }
   await page.evaluate(async quality=>window.__ASSET__!.inspectionView!(quality,315,false),quality);await label(`${id} ${quality} | roof hidden`);tile(PNG.sync.read(await page.screenshot()),cutaway,column*300,0,300,240);
  }
  const peer=peers[index];const peerDef=definitions.find((e:any)=>e.id===peer);await open(peer);
  for(const [row,pixels] of [135,190].entries()){
   await page.evaluate(async distance=>window.__ASSET__!.deliveryView!('high',distance),distance([peerDef.dimensions.x,peerDef.dimensions.y,peerDef.dimensions.z],pixels));
   await label(`${peer} integrated | ~${pixels}px`);const state=await page.evaluate(()=>window.__ASSET__!.info());if(state.placeholder)throw new Error(`${peer}: placeholder`);
   tile(PNG.sync.read(await page.screenshot()),sheet,1300,row*240,300,240);
  }
  writeFileSync(`${directory}/${id}/game-reference-peer.png`,PNG.sync.write(sheet));writeFileSync(`${directory}/${id}/cutaway.png`,PNG.sync.write(cutaway));writeFileSync(`${directory}/${id}/game-camera.json`,JSON.stringify({id,peer,fov:25,azimuth:45,polar:Math.PI*.3,views:info,pageErrors:errors},null,2)+'\n');
 }
 if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();}
