import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch({headless:true,args:['--use-angle=metal']});
try {
 const page = await browser.newPage({viewport:{width:480,height:360}});
 for(const id of ['veh.sedan-red','veh.sedan-blue','veh.sedan-white','veh.suv-dark']) {
  const dir=`test-results/l5-burned-civilian-cars/${id}.burned`;
  mkdirSync(dir,{recursive:true});
  await page.goto(`http://127.0.0.1:3313/preview/?asset=${id}&test=1&renderer=webgl&production=1`);
  await page.waitForFunction(()=>!!window.__ASSET__);
  await page.evaluate(()=>window.__ASSET__!.ready);
  await page.locator('#toolbar').evaluate(el=>{el.style.display='none';});
  await page.evaluate(async()=>{await window.__ASSET__!.deliveryView!('high',20);});
  await page.screenshot({path:`${dir}/peer.png`});
  await page.locator('#decay').evaluate(el=>{(el as HTMLSelectElement).value='burned';});
  const results=[];
  for(const quality of ['high','lod1','lod2'] as const){
   await page.evaluate(async quality=>{await window.__ASSET__!.deliveryView!(quality,20);},quality);
   const info=await page.evaluate(()=>window.__ASSET__!.info());
   if(info.placeholder) throw Error(`${id} ${quality} placeholder`);
   results.push({quality,...info});
   await page.screenshot({path:`${dir}/game-${quality}.png`});
  }
  writeFileSync(`${dir}/loading.json`,JSON.stringify(results,null,2)+'\n');
 }
} finally {await browser.close();}
