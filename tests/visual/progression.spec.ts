import {mkdirSync,writeFileSync} from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import {boot,expect,test} from '../e2e/fixtures';
import {preset} from '../../src/sim/progression/Campaign';
const dir='test-results/epics/E13';
test('T-E13-08-visual @E13 @E13-AC08 @visual default campaign gear is visible on the avatar across five tiers',async({page})=>{
  test.setTimeout(180_000);mkdirSync(dir,{recursive:true});await boot(page);await page.evaluate(async()=>{await window.__SS__!.loadScenario('survivor');window.__SS__!.pause();window.__SS__!.camera.preset('right');});
  const sheet=new PNG({width:2500,height:800}),metrics=[];let base:PNG|null=null,baseMask:PNG|null=null;let characterPixels=0,gearDifferenceRatio=0;
  for(const [index,level]of ([2,3,4,5,6]as const).entries()){
    const save=preset(`L${level}-default`);await page.evaluate(async save=>{const a=window.__SS__!;a.campaign.restore(save);a.setLoadout(['weapon.bat'],['weapon.kick']);await a.screenshotReady();},save);
    const state=await page.evaluate(()=>window.__SS__!.getState());expect(state.render.character!.gearTier).toBe(index);
    const png=PNG.sync.read(await page.screenshot({path:`${dir}/gear-${index}.png`,clip:{x:550,y:80,width:500,height:800}}));PNG.bitblt(png,sheet,0,0,500,800,index*500,0);
    await page.evaluate(()=>window.__SS__!.settings.set({idPass:true}));const mask=PNG.sync.read(await page.screenshot({path:`${dir}/gear-${index}-mask.png`,clip:{x:550,y:80,width:500,height:800}}));await page.evaluate(()=>window.__SS__!.settings.set({idPass:false}));
    const isCharacter=(p:PNG,i:number)=>p.data[i]>240&&p.data[i+1]<20&&p.data[i+2]>240;
    const diff=new PNG({width:500,height:800});if(base){const pixels=pixelmatch(base.data,png.data,diff.data,500,800,{threshold:.1});expect(pixels).toBeGreaterThan(100);metrics.push({tier:index,differingPixels:pixels});if(index===4){pixelmatch(base.data,png.data,diff.data,500,800,{threshold:.1,diffMask:true});let differences=0;for(let i=0;i<diff.data.length;i+=4)if(diff.data[i+3]&&(isCharacter(mask,i)||isCharacter(baseMask!,i)))differences++;gearDifferenceRatio=differences/characterPixels;expect(gearDifferenceRatio).toBeGreaterThan(.05);}}else{base=png;baseMask=mask;for(let i=0;i<mask.data.length;i+=4)if(isCharacter(mask,i))characterPixels++;expect(characterPixels).toBeGreaterThan(1000);}
  }
  const perf=await page.evaluate(()=>window.__SS__!.perf());expect(perf.drawCalls).toBeLessThanOrEqual(600);expect(perf.triangles).toBeLessThanOrEqual(1_500_000);
  writeFileSync(`${dir}/gear-sheet.png`,PNG.sync.write(sheet));writeFileSync(`${dir}/gear-metrics.json`,JSON.stringify({metrics,characterPixels,gearDifferenceRatio,perf},null,2));
});
