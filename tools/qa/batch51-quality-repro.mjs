/** Isolate the capture run's quality-switch failure through ordinary Settings UI. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from '../browser-pool/client.ts';
const out='test-results/batch51/quality-repro';mkdirSync(out,{recursive:true});
const result={method:'Fresh sole WebGPU context; native L4 turn checkpoint; ordinary Escape > Settings quality control > Back > Resume, repeated four times.',errors:[],switches:[]};
const browser=await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>result.errors.push({kind:'pageerror',text:e.stack??e.message}));
 page.on('console',m=>{if(m.type()==='error') result.errors.push({kind:'console',text:m.text()});});
 await page.addInitScript('window.__name=f=>f');
 await page.goto('http://127.0.0.1:4901/?test=poses&testApi=1&scenelab=1&debug=1&quality=high&audio=muted&dpr=1');
 await page.waitForFunction(()=>!!window.__SS__&&!!window.__SCENE__);
 await page.getByTestId('start-game').click();
 await page.getByTestId('character-female').click();
 await page.getByTestId('level-L4').click({force:true});
 await page.waitForFunction(()=>!!window.__SCENE__.game.world.missions);
 await page.evaluate(async()=>{const a=window.__SS__;await a.ready;await a.loadLevel('L4',{seed:1,checkpoint:'turn'});a.missions.begin();a.cheats.god(true);window.__SCENE__.game.ui.show(null);a.resume();});
 await page.waitForTimeout(1500);
 for(const quality of ['low','high','low','high']){
  await page.keyboard.press('Escape');await page.getByTestId('pause-settings').click({timeout:10000});
  await page.getByTestId('setting-quality').selectOption(quality);await page.getByTestId('settings-back').click();await page.getByTestId('resume-game').click();
  const before=await page.evaluate(()=>window.__SS__.tick());await page.waitForTimeout(1500);
  const after=await page.evaluate(()=>({tick:window.__SS__.tick(),backend:window.__SS__.perf().backend,quality:window.__SS__.getState().render.quality}));
  result.switches.push({quality,before,...after,progress:after.tick>before});
 }
 await page.screenshot({path:`${out}/final.jpg`,type:'jpeg',quality:85});
}catch(error){result.failure=String(error);}finally{await browser.close();writeFileSync('docs/reports/batch51-qa/quality-repro.json',JSON.stringify(result,null,2));}
console.log(JSON.stringify(result));
