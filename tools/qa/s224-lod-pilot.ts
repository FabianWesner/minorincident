import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, origin, stopServer } from '../scenelab/session';
const out = 'test-results/s224-lod-pilot'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ viewport: { width: 800, height: 600 } });
const names = ['lion', 'lioness', 'flamingo', 'zebra', 'gorilla', 'monkey', 'elephant'];
try {
  await session.open(); const page = session.page; const results = [];
  for (const name of names) {
    await page.goto(`${origin}/preview/?asset=inf.${name}&test=1&renderer=webgl&production=1`);
    await page.waitForFunction(() => !!window.__ASSET__); await page.evaluate(() => window.__ASSET__!.ready);
    await page.locator('#toolbar').evaluate(el => { (el as HTMLElement).style.display = 'none'; });
    for (const quality of ['high', 'lod1', 'lod2'] as const) {
      await page.evaluate(async quality => { await window.__ASSET__!.deliveryView!(quality, 16); }, quality);
      const info = await page.evaluate(() => window.__ASSET__!.info());
      if (info.placeholder) throw new Error(`${name} ${quality}: placeholder`);
      await page.screenshot({ path: `${out}/${name}-${quality}.png` }); results.push({ name, quality, info });
      console.log(name, quality, info.triangles);
    }
  }
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
} finally { await session.close(); stopServer(); }
