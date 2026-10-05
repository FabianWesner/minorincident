import { expect, test } from './fixtures';
import { mkdirSync, readFileSync } from 'node:fs';
import type { AssetDef } from '../../src/assets/types';
const manifest = JSON.parse(readFileSync('src/assets/manifest.json','utf8')) as AssetDef[];

for (const id of ['char.survivor-female', 'veh.sedan-red', 'prop.bench', 'npc.civilian-woman-a', 'veh.suv-dark']) {
  test(`T-E17-conformance ${id} @E17-AC02 optimized export renders in the game camera`, async ({page,baseURL}) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${baseURL}/preview/?asset=${id}&production=1&test=1&renderer=webgl`);
    await page.waitForFunction(() => !!window.__ASSET__);
    await page.evaluate(() => window.__ASSET__!.ready);
    await page.evaluate(() => window.__ASSET__!.view(4));
    const info = await page.evaluate(() => window.__ASSET__!.info());
    expect(info.placeholder).toBe(false);
    for (const name of manifest.find(def => def.id === id)!.frontNodes) expect(info.nodes).toContain(name);
    expect(info.triangles).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    mkdirSync('test-results/epics/E17/conformance',{recursive:true});
    await page.locator('canvas').screenshot({path:`test-results/epics/E17/conformance/${id}.png`});
    if (id === 'char.survivor-female') for (const lod of ['lod1','lod2']) {
      const previous = await page.evaluate(() => window.__ASSET__!.info().triangles);
      await page.locator('#quality').selectOption(lod);
      await page.waitForFunction(previous => window.__ASSET__!.info().triangles !== previous,previous);
      await page.locator('canvas').screenshot({path:`test-results/epics/E17/conformance/${id}.${lod}.png`});
      expect((await page.evaluate(() => window.__ASSET__!.info())).placeholder).toBe(false);
    }
  });
}

test('T-E17-direction @E17-AC03 E04 survivor turns toward keyboard movement', async ({page}) => {
  await page.goto('/?test=1&renderer=webgl&audio=muted');
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(async () => { await window.__SS__!.ready; await window.__SS__!.loadScenario('survivor'); window.__SS__!.pause(); });
  const start = await page.evaluate(() => window.__SS__!.getState().player!.transform);
  await page.keyboard.down('KeyW');
  await page.evaluate(() => window.__SS__!.step(30));
  await page.keyboard.up('KeyW');
  const end = await page.evaluate(() => window.__SS__!.getState().player!.transform);
  const dx = end.x-start.x, dz = end.z-start.z, distance = Math.hypot(dx,dz);
  expect(distance).toBeGreaterThan(1);
  expect(Math.cos(end.yaw)*dx/distance - Math.sin(end.yaw)*dz/distance).toBeGreaterThan(.99);
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({path:'test-results/epics/E17/conformance/survivor-movement.png'});
});

for (const [id,limb] of [['inf.common-worker','armR'],['inf.suburban-mom','head'],['inf.riot-cop','foreArmR']]) {
  test(`T-E17-gore-probe ${id} ${limb} @E17-AC11 hidden cap closes detached joint`, async ({page,baseURL}) => {
    await page.goto(`${baseURL}/preview/?asset=${id}&production=1&test=1&renderer=webgl`);
    await page.waitForFunction(()=>!!window.__ASSET__);
    await page.evaluate(()=>window.__ASSET__!.ready);
    const result=await page.evaluate(limb=>window.__ASSET__!.goreProbe!(limb),limb);
    expect(result.hiddenBefore).toBe(true); expect(result.visibleAfter).toBe(true);
    expect(result.capTriangles).toBe(56); expect(result.jointError).toBeLessThan(.001);
    mkdirSync('test-results/epics/E17/conformance-2',{recursive:true});
    await page.locator('canvas').screenshot({path:`test-results/epics/E17/conformance-2/${id}.${limb}.png`});
  });
}
