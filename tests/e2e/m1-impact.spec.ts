import { test, expect } from './fixtures';
import { menuStart } from './ui-helpers';
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

test('M1-11 @E19 bat hit feedback renders airborne red droplets at the game camera', async ({ page }) => {
  await menuStart(page);
  await page.evaluate(async()=>{const a=window.__SS__!;a.pause();await a.loadLevel('L1',{checkpoint:'melee'});a.teleport('player',{x:70,z:-7});a.cheats.god(true);a.settings.set({gore:'Off'});a.cheats.killAll();await a.step(90);a.settings.set({gore:'Full'});await a.screenshotReady();});
  const before = PNG.sync.read(await page.screenshot());
  const ground=await page.evaluate(()=>{const a=window.__SS__!,p=a.getState().player!.transform;return a.input.project({x:p.x+2,z:p.z+2});});
  await page.evaluate(()=>{const a=window.__SS__!,p=a.getState().player!.transform;a.vfx.emit({type:'combat.hit',actionId:'weapon.bat',sourceId:1,targetId:1,amount:30,position:{x:p.x+2,z:p.z+2},direction:{x:-.707,z:-.707},knockback:.9,damageType:'melee'} as never);a.vfx.stepRender(.18);});
  await page.evaluate(()=>window.__SS__!.screenshotReady());
  const bytes=await page.screenshot({path:'test-results/m1-anim/blood-probe.png'}),after=PNG.sync.read(bytes);
  let red=0;
  for(let i=0;i<after.data.length;i+=4)if(Math.floor(i/4/after.width)<ground.y-35&&after.data[i]>120&&after.data[i]>after.data[i+1]*1.8&&after.data[i]>after.data[i+2]*1.4&&(after.data[i]-before.data[i]>20||before.data[i+1]-after.data[i+1]>20))red++;
  writeFileSync('test-results/m1-anim/blood-probe.json',JSON.stringify({red,vfx:await page.evaluate(()=>window.__SS__!.getState().render.vfx)},null,2));
  expect(red).toBeGreaterThan(80);
});
