import { expect, test } from '@playwright/test';
import { captureTurntable } from '../../tools/assets/turntable';
import { boot } from './fixtures';

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
test('T-E17-05e @E17-AC05 pending survivor art uses E04 code rigs with placeholder logs', async ({page}) => {
  const events: {type:string;id:string;reason:string}[] = [];
  page.on('console', message => {
    if (message.type() === 'info' && message.text().startsWith('{')) {
      const event = JSON.parse(message.text());
      if (event.type === 'asset.placeholder') events.push(event);
    }
  });
  await boot(page);
  const character = await page.evaluate(async () => {
    await window.__SS__!.loadScenario('survivor'); window.__SS__!.pause();
    return window.__SS__!.getState().render.character!;
  });
  expect(character.sources.map(source => source.source)).toEqual(['placeholder', 'placeholder']);
  for (const variant of ['female', 'male']) expect(events).toContainEqual({type:'asset.placeholder',id:`char.survivor-${variant}`,reason:'status reference'});
});
test('T-E17-05c @E17-AC05 pre-integrated production art renders a logged placeholder', async ({page,baseURL}) => {
  await page.goto(`${baseURL}/preview/?asset=inf.common-worker&test=1&renderer=webgl`);
  await page.waitForFunction(()=>!!window.__ASSET__);
  await page.evaluate(()=>window.__ASSET__!.ready);
  const info=await page.evaluate(()=>window.__ASSET__!.info());
  expect(info.placeholder).toBe(true);
  expect(info.events[0]).toMatchObject({type:'asset.placeholder',id:'inf.common-worker'});
});
