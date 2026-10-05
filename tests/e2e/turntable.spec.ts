import { expect, test } from '@playwright/test';
import { captureTurntable } from '../../tools/assets/turntable';

test('T-E17-08 @E17-AC08 @E17-AC04 five fire-engine views cover 10–80% and preserve contract nodes', async ({page,baseURL}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => { if(e.type()==='error') errors.push(e.text()); });
  const values = await captureTurntable(page,'veh.fire-engine','test-results/epics/E17',baseURL!);
  for (const value of values) expect(value).toBeGreaterThanOrEqual(.1);
  for (const value of values) expect(value).toBeLessThanOrEqual(.8);
  const info = await page.evaluate(() => window.__ASSET__!.info());
  expect(info.placeholder).toBe(false);
  for (const name of ['body','wheelFL','wheelFR','wheelRL','wheelRR','ladder','sirenL','sirenR']) expect(info.nodes).toContain(name);
  expect(errors).toEqual([]);
});
test('T-E17-05c @E17-AC05 pre-integrated production art renders a logged placeholder', async ({page,baseURL}) => {
  await page.goto(`${baseURL}/preview/?asset=inf.common-worker&test=1&renderer=webgl`);
  await page.waitForFunction(()=>!!window.__ASSET__);
  await page.evaluate(()=>window.__ASSET__!.ready);
  const info=await page.evaluate(()=>window.__ASSET__!.info());
  expect(info.placeholder).toBe(true);
  expect(info.events[0]).toMatchObject({type:'asset.placeholder',id:'inf.common-worker'});
});
