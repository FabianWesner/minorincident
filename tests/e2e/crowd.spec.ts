import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

test('T-E17-07b @E17-AC07 100 infected use one draw per material and GPU poses match at five times', async ({page,baseURL}) => {
  const errors:string[]=[];
  page.on('pageerror',(e)=>errors.push(e.message));
  page.on('console',(e)=>{if(e.type()==='error')errors.push(e.text());});
  await page.goto(`${baseURL}/preview/?asset=inf.common-worker&crowd=1&test=1&renderer=webgl`);
  await page.waitForFunction(()=>!!window.__ASSET__);
  await page.evaluate(()=>window.__ASSET__!.ready);
  const proof=await page.evaluate(()=>window.__ASSET__!.crowdProbe!());
  mkdirSync('test-results/epics/E17',{recursive:true});
  writeFileSync('test-results/epics/E17/crowd.json',JSON.stringify(proof,null,2)+'\n');
  expect(proof.instances).toBe(100);
  expect(proof.drawCalls).toBe(proof.materials);
  expect(proof.poseError).toBeLessThanOrEqual(.02);
  expect(errors).toEqual([]);
  await page.locator('canvas').screenshot({path:'test-results/epics/E17/crowd.png'});
});
