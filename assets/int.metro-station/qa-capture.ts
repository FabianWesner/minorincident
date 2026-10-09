import {chromium} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const targets=[['int.metro-station','int.metro-station','int.fire-station-bay'],['util.flashlight','util.flashlight','wpn.halligan'],...['npc.civilian-elderly','npc.paramedic','npc.civilian-woman-a','npc.survivor-group'].map(id=>[id+'.aftermath',id,id])];
const manifest: {id:string;dimensions:{x:number;y:number;z:number}}[]=JSON.parse(readFileSync('src/assets/manifest.json','utf8'));
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:300,height:300}});
 for(const [label,id,peer] of targets.filter(t=>process.argv.length===2||process.argv.slice(2).includes(t[0]))){
  const out=`test-results/l5-shelter-arrival-and-skins/${label}`;mkdirSync(out,{recursive:true});
  const records=[];
  for(const [kind,asset] of [['model',id],['peer',peer]]){
   await page.goto(`http://127.0.0.1:${process.env.E2E_PORT ?? 3353}/preview/?asset=${asset}&production=1&test=1&renderer=webgl&inspection=1`);
   await page.waitForFunction(()=>!!window.__ASSET__);await page.evaluate(()=>window.__ASSET__!.ready);
   await page.locator('#toolbar').evaluate(e=>{e.style.display='none';});
   const d=manifest.find(a=>a.id===asset)!.dimensions;
   const w=(d.x+d.z)/Math.SQRT2,h=d.y*Math.cos(Math.PI*.2)+w*Math.sin(Math.PI*.2);
   for(const pixels of [135,190])for(const lod of ['high','lod1','lod2']){
    if(kind==='peer'&&lod!=='high')continue;
    await page.setViewportSize({width:300,height:300});
    const distance=Math.max(w,h)*300/(2*pixels*Math.tan(25*Math.PI/360));
    await page.evaluate(async({lod,distance})=>{await window.__ASSET__!.deliveryView!(lod as 'high',distance);},{lod,distance});
    const info=await page.evaluate(()=>window.__ASSET__!.info());if(info.placeholder)throw Error(asset+' placeholder');
    records.push({kind,asset,lod,pixels,...info});await page.screenshot({path:`${out}/${kind}-${lod}-${pixels}.png`});
   }
   if(kind==='model'){
    await page.setViewportSize({width:400,height:300});
    for(const lod of ['high','lod1','lod2'])for(const angle of [45,135,225,315,0]){
     await page.evaluate(async({lod,angle})=>{await window.__ASSET__!.inspectionView!(lod as 'high',angle);},{lod,angle});
     await page.screenshot({path:`${out}/ring-${lod}-${angle}.png`});
    }
   }
  }
  writeFileSync(`${out}/loading.json`,JSON.stringify({requested:label,loaded:id,blocked:label!==id,note:label!==id?'Existing base audit only; no aftermath skin delivered.':undefined,records},null,2)+'\n');
  console.log(label+' captured');
 }
}finally{await browser.close();}
