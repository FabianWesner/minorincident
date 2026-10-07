import { chromium } from '@playwright/test';
import { launchArgs } from '../../../../tools/performance/load-measure';
import { mkdirSync, writeFileSync } from 'node:fs';
const [base, output] = process.argv.slice(2);
const browser = await chromium.launch({headless:true,args:[...launchArgs,...(process.env.LOAD_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.LOAD_SPKI}`]:[])]});
mkdirSync(output,{recursive:true});
try {
 for (const profile of ['phone','desktop']) {
  const context = await browser.newContext(profile==='phone'?{viewport:{width:412,height:915},isMobile:true,hasTouch:true,deviceScaleFactor:1}:{viewport:{width:1600,height:900}});
  const page = await context.newPage();
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+`?test=1&renderer=${process.env.CAPTURE_RENDERER ?? 'webgl'}&audio=muted&seed=1`);
  await page.waitForFunction(()=>!!window.__SS__,undefined,{timeout:90000});
  await page.evaluate(async()=>{const api=window.__SS__!;await api.ready;api.pause();await api.loadLevel('L1',{seed:1});api.pause();await api.screenshotReady();api.missions.begin();api.pause();});
  for (const tick of [0,120,300,600]) {
   await page.evaluate(async tick=>{const a=window.__SS__!;await a.step(tick-a.tick());await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},tick);
   await page.locator('canvas').first().screenshot({path:`${output}/${profile}-${tick}.png`});
  }
  writeFileSync(`${output}/${profile}.json`,JSON.stringify({errors,state:await page.evaluate(()=>window.__SS__!.getState())},null,2));
  console.log('captured',profile);await context.close();
 }
}finally{await browser.close();}
