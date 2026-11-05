/** Z-D2 visual evidence. Run with SCENE_PORT=<private port> sh tools/e2e-lock.sh npx tsx tools/qa/zebra-asset.ts. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, origin, readSpec, stopServer } from '../scenelab/session';
const out = 'test-results/epics/E07/zebra';
mkdirSync(out, { recursive: true });
const session = new SceneSession({ viewport: { width: 480, height: 360 } });
try {
  await session.open();
  const page = session.page, sheet = new PNG({ width: 1920, height: 1280 });
  sheet.data.fill(255);
  const views = [];
  for (const [column, id] of ['amb.zebra', 'inf.zebra', 'inf.lion', 'inf.gorilla'].entries()) {
    await page.goto(`${origin}/preview/?asset=${id}&test=1&renderer=webgl&production=1`);
    await page.waitForFunction(() => !!window.__ASSET__);
    await page.evaluate(() => window.__ASSET__!.ready);
    await page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
    for (const [row, quality] of (['high', 'lod1', 'lod2'] as const).entries()) {
      await page.evaluate(async quality => { await window.__ASSET__!.deliveryView!(quality, 16); }, quality);
      const info = await page.evaluate(() => window.__ASSET__!.info());
      if (info.placeholder) throw new Error(`${id} ${quality}: placeholder`);
      await page.evaluate(label => {
        let el = document.querySelector<HTMLDivElement>('#asset-label');
        if (!el) { el = document.createElement('div'); el.id = 'asset-label'; el.style.cssText = 'position:fixed;top:0;left:0;color:white;background:#17151b;font:16px sans-serif;padding:8px'; document.body.append(el); }
        el.textContent = label;
      }, `${id} · LOD${row} · game angle / 16 m`);
      PNG.bitblt(PNG.sync.read(await page.screenshot()), sheet, 0, 0, 480, 360, column * 480, 200 + row * 360);
      views.push({ id, lod: row, ...info });
    }
  }
  // The source concept is copied as a crop into evidence, never edited in place.
  const reference = PNG.sync.read(readFileSync('initial-drafts/animals-pets-and-zoo.png'));
  const scratch = await page.context().newPage();
  const header = await scratch.evaluate(async src => {
    const i = new Image(); i.src = src; await i.decode();
    const c = document.createElement('canvas'); c.width = 1920; c.height = 200;
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#2a2730'; ctx.fillRect(0, 0, 1920, 200);
    // Concept image is 1448x1086; scale crop coordinates for source resolution.
    ctx.drawImage(i, 713/1448*i.width, 783/1086*i.height, 271/1448*i.width, 221/1086*i.height, 25, 5, 240, 190);
    ctx.fillStyle = '#fff'; ctx.font = '24px sans-serif'; ctx.fillText('Z-D2 zebra: original zoo concept reference + shipped game materials', 300, 65);
    ctx.font = '20px sans-serif'; ctx.fillText('Same 16 m camera, 36° elevation, 45° azimuth; healthy/infected share topology and rig.', 300, 110);
    ctx.fillText('Columns: normal zebra, derived infected zebra, shipped infected lion, shipped infected gorilla.', 300, 150);
    return c.toDataURL('image/png').split(',')[1];
  }, `data:image/png;base64,${PNG.sync.write(reference).toString('base64')}`);
  await scratch.close();
  PNG.bitblt(PNG.sync.read(Buffer.from(header, 'base64')), sheet, 0, 0, 1920, 200, 0, 0);
  writeFileSync(`${out}/after-lod-comparison.png`, PNG.sync.write(sheet));
  writeFileSync(`${out}/lod-comparison.json`, JSON.stringify(views, null, 2));
  const poses = new PNG({ width: 1920, height: 1080 });
  for (const [row, lod] of [0, 1, 2].entries()) {
    for (const [column, probe] of [
      { id: 'amb.zebra', clip: 'zebra-rear-kick', seconds: .7 },
      { id: 'inf.zebra', clip: 'zebra-rear-kick', seconds: .7 },
      { id: 'amb.zebra', clip: 'zebra-stampede', seconds: 56 / 60 },
      { id: 'inf.zebra', clip: 'zebra-stampede', seconds: 56 / 60 },
    ].entries()) {
      await page.goto(`${origin}/preview/?asset=amb.zebra&test=1&renderer=webgl`);
      await page.waitForFunction(() => !!window.__ASSET__);
      await page.evaluate(() => window.__ASSET__!.ready);
      await page.evaluate(async ({ id, clip, seconds, lod }) => {
        const modulePath = '/tools/qa/zebra-pose-view.ts';
        const { drawPose } = await import(modulePath);
        await drawPose(id, lod, clip, seconds);
      }, { ...probe, lod });
      PNG.bitblt(PNG.sync.read(await page.screenshot()), poses, 0, 0, 480, 360, column * 480, row * 360);
    }
  }
  writeFileSync(`${out}/after-poses.png`, PNG.sync.write(poses));
  await page.setViewportSize({ width: 1280, height: 720 });
  await session.load(readSpec('tests/scenes/zebra-asset/zoo-base.json'));
  await session.screenshot(`${out}/after-zoo-0000.png`);
  await session.step(60); await session.screenshot(`${out}/after-zoo-0060.png`);
  writeFileSync(`${out}/zoo-metrics.json`, JSON.stringify(await session.metrics(), null, 2));
} finally { await session.close(); stopServer(); }
