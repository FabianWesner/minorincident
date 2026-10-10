import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import manifest from '../../src/assets/manifest.json';
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
test('T-E17-05e @E17-AC05 integrated survivor art uses accepted rigs without placeholder logs', async ({page}) => {
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
  expect(character.sources.map(source => source.source)).toEqual(['glb', 'glb']);
  expect(events.filter(event => event.id.startsWith('char.survivor-'))).toEqual([]);
});
test('T-E17-05c @E17-AC05 missing production art renders a logged placeholder', async ({page,baseURL}) => {
  // The radio is now integrated. Fail its real export request to exercise missing-art fallback.
  await page.route('**/assets/models/util.radio*.glb*', route => route.abort());
  await page.goto(`${baseURL}/preview/?asset=util.radio&test=1&renderer=webgl`);
  await page.waitForFunction(()=>!!window.__ASSET__);
  await page.evaluate(()=>window.__ASSET__!.ready);
  const info=await page.evaluate(()=>window.__ASSET__!.info());
  expect(info.placeholder).toBe(true);
  expect(info.events[0]).toMatchObject({type:'asset.placeholder',id:'util.radio'});
});

/** E17-AC08 inventory proof: one renderer, released assets, five views for every modeled GLB. */
test('T-E17-08-all @E17 @E17-AC08 all modeled assets have five game renderer views', async ({ page, baseURL }) => {
  test.setTimeout(1_800_000);
  const directory = 'test-results/epics/E17/turntables';
  mkdirSync(directory, { recursive: true });
  const results: { id: string; coverage?: number[]; error?: string }[] = [];
  const selected = manifest.filter(a => ['modeled', 'integrated', 'final'].includes(a.status) && a.glb && existsSync(a.glb));
  for (const asset of selected) {
    try {
      await page.setViewportSize(asset.dimensions.y > Math.max(asset.dimensions.x, asset.dimensions.z) ? { width: 360, height: 640 } : { width: 640, height: 360 });
      const coverage = await captureTurntable(page, asset.id, `${directory}/${asset.id}`, baseURL!);
      const info = await page.evaluate(() => window.__ASSET__!.info());
      results.push({ id: asset.id, coverage, ...(info.placeholder ? { error: 'placeholder' } : coverage.some(c => c < .1 || c > .8) ? { error: 'coverage outside 10–80%' } : {}) });
    } catch (error) { results.push({ id: asset.id, error: String(error) }); }
    writeFileSync(`${directory}/summary.json`, JSON.stringify(results, null, 2) + '\n');
  }
  expect(results.filter(a => a.error)).toEqual([]);
  expect(results).toHaveLength(selected.length);
});
