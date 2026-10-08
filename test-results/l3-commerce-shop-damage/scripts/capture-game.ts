import { chromium } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:240,height:180}});
const targets=process.argv.includes('--props')?['decay.burned-facade.brick','decay.burned-facade.diner']:['bld.mainstreet-brick.w2','bld.mainstreet-brick.w3','bld.joes-diner.w2','bld.joes-diner.w3','bld.maple-hardware.w2','bld.maple-hardware.w3','decay.burned-facade.brick','decay.burned-facade.diner'];
try{
 for(const id of targets){const match=id.match(/^(bld\..+)\.(w[23])$/);const base=match?.[1]??id,decay=match?.[2];
  const dir=`test-results/l3-commerce-shop-damage/${id}`;mkdirSync(dir,{recursive:true});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:3348/preview/?asset=${base}&test=1&renderer=webgl&production=1`);
  await page.waitForFunction(()=>!!window.__ASSET__);await page.evaluate(()=>window.__ASSET__!.ready);
  if(decay)await page.locator('#decay').evaluate((el,value)=>{(el as HTMLSelectElement).value=value;},decay);
  await page.locator('#toolbar').evaluate(el=>el.style.display='none');
  const views:any[]=[];
  for(const quality of ['high','lod1','lod2'] as const){
   await page.evaluate(async q=>{await window.__ASSET__!.inspectionView!(q,45);},quality);
   const info=await page.evaluate(()=>window.__ASSET__!.info());if(info.placeholder||info.events.length||errors.length)throw Error(id+JSON.stringify({info,errors}));
   const path=`${dir}/game-${quality}.png`;const bytes=await page.locator('canvas').screenshot({path});
   const png=PNG.sync.read(bytes);let minX=240,minY=180,maxX=0,maxY=0;
   for(let y=0;y<180;y++)for(let x=0;x<240;x++){const i=(y*240+x)*4;if([42,39,48].some((v,k)=>Math.abs(png.data[i+k]-v)>8)){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
   views.push({quality,...info,pixelWidth:maxX-minX+1,pixelHeight:maxY-minY+1});
  }
  if(match){await page.setViewportSize({width:480,height:360});await page.evaluate(async()=>{await window.__ASSET__!.inspectionView!('high',45,false);});await page.locator('canvas').screenshot({path:`${dir}/cutaway.png`});await page.setViewportSize({width:240,height:180});}
  writeFileSync(`${dir}/game-camera.json`,JSON.stringify({id,fov:25,azimuth:45,polar:Math.PI*.30,errors,views},null,2)+'\n');
 }
}finally{await browser.close();}
