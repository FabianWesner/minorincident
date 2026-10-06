import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from './fixtures';
import { missionSandbox } from '../fixtures/scenarios/mission-sandbox';
import { stateHash } from '../../src/sim/world/stateHash';
const dir='test-results/epics/E12';
async function load(page: import('@playwright/test').Page,def=missionSandbox()){
  await page.evaluate(async def=>{const api=window.__SS__!;await api.loadScenario('mission-sandbox',{seed:1});api.pause();api.missions.load(def);await api.screenshotReady();},def);
  await expect(page.getByRole('heading',{name:'Mission briefing'})).toBeVisible();await page.getByRole('button',{name:'Begin mission'}).click();
}
async function photo(page:import('@playwright/test').Page,name:string){mkdirSync(dir,{recursive:true});await page.evaluate(()=>window.__SS__!.screenshotReady());await page.screenshot({path:`${dir}/${name}.png`});}
test('T-E12-08 @E12 @E12-AC08 active world anchor, HUD distance, minimap and clamped direction arrow',async({page})=>{
  await boot(page);await load(page);
  await page.evaluate(()=>window.__SS__!.screenshotReady());
  const tracker=page.locator('.mission-tracker');await expect(tracker).toContainText('Complete reach · 5 m');
  const render=await page.evaluate(()=>window.__SS__!.getState().render.missionMarker);expect(render).toEqual({visible:true,position:[5,0,0]});
  await expect(page.locator('.mission-map-pin[data-objective="reach"]')).toBeVisible();await expect(page.locator('.mission-marker')).toHaveAttribute('data-offscreen','false');
  await photo(page,'marker-desktop');
  const def=missionSandbox();def.anchors.goal.x=100;
  await page.evaluate(async def=>{window.__SS__!.missions.load(def);window.__SS__!.missions.begin();await window.__SS__!.screenshotReady();},def);
  const marker=page.locator('.mission-marker');await expect(marker).toHaveAttribute('data-offscreen','true');await expect(marker).toHaveText('➜');
  for(const [width,height,name]of [[1600,900,'marker-offscreen'],[390,844,'marker-mobile']]as const){
    await page.setViewportSize({width,height});await photo(page,name);const box=await marker.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);expect(box!.y+box!.height).toBeLessThanOrEqual(height);
    const text=await tracker.boundingBox();expect(text!.width).toBeGreaterThan(100);expect(text!.x+text!.width).toBeLessThan(width);
  }
});
test('T-E12-09 @E12 @E12-AC09 results equal accumulated sim events; continue requests progression',async({page})=>{
  await boot(page);const def=missionSandbox('escort');await load(page,def);
  const data=await page.evaluate(async()=>{
    const api=window.__SS__!;api.missions.checkpoint('C');api.missions.damageActor('boss',10000);api.survivor.damage(1000);await api.step(120);api.teleport(api.missions.state()!.actors.escort,{x:5,z:0});await api.step(1);await api.screenshotReady();
    return {state:api.missions.state(),events:api.events(),perf:api.perf()};
  });
  expect(data.state!.phase).toBe('result');
  const expected={time:Math.max(...data.events.filter(e=>e.type==='sim.tick').map(e=>e.tick))/60,kills:data.events.filter(e=>e.type==='combat.kill'&&e.sourceId===1).length,damage:data.events.reduce((n,e)=>n+(e.type==='player.damaged'?e.amount:0),0),deaths:data.events.filter(e=>e.type==='player.died').length,rescued:data.events.filter(e=>e.type==='escort.rescued').length};
  expect(data.state!.result).toMatchObject(expected);
  for(const[key,value]of Object.entries(expected))await expect(page.locator(`[data-stat="${key}"]`)).toHaveText(String(Math.round(value*100)/100));
  await photo(page,'result');writeFileSync(`${dir}/result.json`,JSON.stringify({expected,...data},null,2));
  await page.getByRole('button',{name:'Continue'}).click();await expect(page.getByRole('heading',{name:'Progression',exact:true})).toBeVisible();expect(await page.evaluate(()=>window.__SS__!.events().at(-1)?.type)).toBe('progression.requested');
});
test('T-E12-06-browser @E12 @E12-AC06 real keyboard skip, caption/letterbox and watch/skip hashes equal',async({page})=>{
  await boot(page);const def=missionSandbox();def.onComplete=[{kind:'cinematic',id:'twist'}];
  const run=async(skip:boolean)=>{await load(page,def);await page.evaluate(async()=>{window.__SS__!.cheats.completeObjective();await window.__SS__!.step(29);});await expect(page.locator('.mission-ui')).toHaveClass(/is-cinematic/);await expect(page.locator('.mission-subtitle')).toHaveText('Mission successful. Outbreak not contained.');if(skip){await photo(page,'cinematic');await page.keyboard.press('KeyE');await page.evaluate(()=>window.__SS__!.step(1));}else await page.evaluate(()=>window.__SS__!.step(91));return page.evaluate(()=>window.__SS__!.getState());};
  expect(stateHash(await run(true))).toBe(stateHash(await run(false)));
});
test('T-E12-10-browser @E12 @E12-AC10 radio subtitle text and ID match the dialogue event',async({page})=>{
  await boot(page);await load(page);const line=await page.evaluate(()=>window.__SS__!.events().find(e=>e.type==='dialogue.line'));expect(line?.type).toBe('dialogue.line');if(line?.type!=='dialogue.line')throw new Error('Missing radio line');
  await expect(page.locator('.mission-subtitle')).toHaveText(line.text);await expect(page.locator('.mission-subtitle')).toHaveAttribute('data-line-id',line.id);await photo(page,'radio');
});
test('@E12 timer, escort and defend fail screens retry to checkpoint/start',async({page})=>{
  await boot(page);
  for(const type of ['reach','escort','defend']as const){const def=missionSandbox(type);if(type==='reach')def.steps[0].timer=1/60;await load(page,def);await page.evaluate(async type=>{const api=window.__SS__!;if(type!=='reach')api.missions.damageActor(type==='escort'?'escort':'target',10000);await api.step(1);},type);await expect(page.getByRole('heading',{name:'Mission failed'})).toBeVisible();await page.getByRole('button',{name:'Retry',exact:true}).click();expect(await page.evaluate(()=>window.__SS__!.missions.state()!.phase)).toBe('playing');}
});
