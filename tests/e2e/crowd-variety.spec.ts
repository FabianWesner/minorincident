import { expect, test } from './fixtures';
import { readFileSync } from 'node:fs';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
const infected = JSON.parse(readFileSync(new URL('../scenes/crowd-variety/infected-20.json', import.meta.url), 'utf8')) as SceneSpec;
const pedestrians = JSON.parse(readFileSync(new URL('../scenes/crowd-variety/l1-street.json', import.meta.url), 'utf8')) as SceneSpec;

test.use({ launchOptions:{ args: process.platform==='darwin' ? ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--enable-unsafe-webgpu'] : ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-unsafe-webgpu'] } });
for (const backend of ['webgl','webgpu'] as const) test(`crowd variety and vertex layout on ${backend} @E07 @E08 @E18-AC01`, async ({page}) => {
  test.setTimeout(180000);
  if (backend==='webgpu') {
    await page.goto('/');
    const adapter = await page.evaluate(async()=>Boolean(await (navigator as Navigator & {gpu?:{requestAdapter():Promise<unknown>}}).gpu?.requestAdapter()));
    test.skip(!adapter && process.platform!=='darwin','No headless WebGPU adapter');
  }
  await page.goto(`/?test=1&scenelab=1&renderer=${backend}&quality=high&audio=muted&profile=1`);
  await page.waitForFunction(()=>Boolean(window.__SCENE__));
  await page.evaluate(async()=>{await window.__SS__!.ready;window.__SS__!.pause();});
  for (const [spec,kind,minimum] of [[infected,'infected',12],[pedestrians,'pedestrian',15]] as const) {
    await page.evaluate(async spec=>{await window.__SCENE__!.load(spec as SceneSpec);await window.__SCENE__!.step(1);await window.__SCENE__!.ready();},spec);
    const proof = await page.evaluate(async()=>({metrics:await window.__SCENE__!.metrics(),state:window.__SS__!.getState()}));
    expect(proof.metrics.backend).toBe(backend);
    const variety = proof.metrics.variety[kind]; expect(variety.figures).toBe(20); expect(variety.per20[0].distinct).toBeGreaterThanOrEqual(minimum); expect(variety.largestSameLookShare).toBeLessThanOrEqual(.25);
    if(kind==='infected') expect(variety.largestModelShare).toBeLessThanOrEqual(.25);
    const layouts = [...(proof.state.render.crowd?.batches.map(b=>b.layout) ?? []),...(proof.state.render.npcs?.civilians.layouts ?? []),...proof.state.render.accessories.map(b=>b.layout)];
    expect(layouts.length).toBeGreaterThan(0);
    for(const layout of layouts) { expect(layout!.buffers).toBeLessThanOrEqual(8); expect(layout!.locations).toBeLessThanOrEqual(16); }
  }
});
