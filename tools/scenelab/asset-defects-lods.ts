/** Focused visual review: each delivered tier beside the established house kit,
 * at the game lens/elevation, front and rear. Headless via tools/e2e-lock.sh. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, origin, stopServer } from './session';

const out = process.argv[2] ?? 'test-results/asset-defects/lods';
const session = new SceneSession({ viewport: { width: 480, height: 360 } });
const qualities = ['high', 'lod1', 'lod2'] as const;
const angles = [45, 225];
const ids = ['bld.park-lodge', 'bld.reptile-house', 'bld.zoo-gate', 'bld.police-station', 'bld.clinic-annex'];
try {
  await session.open();
  const cells = new Map<string, Buffer[]>(), metadata: unknown[] = [];
  for (const id of [...ids, 'bld.house-b']) {
    await session.page.goto(`${origin}/preview/?asset=${id}&test=1&renderer=webgl&production=1&inspection=1`);
    await session.page.waitForFunction(() => !!window.__ASSET__);
    await session.page.evaluate(() => window.__ASSET__!.ready);
    await session.page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
    const frames: Buffer[] = [];
    for (const angle of angles) for (const quality of qualities) {
      await session.page.evaluate(async ({ quality, angle }) => {
        await window.__ASSET__!.inspectionView!(quality, angle);
        let label = document.querySelector<HTMLDivElement>('#lod-label');
        if (!label) { label = document.createElement('div'); label.id = 'lod-label'; label.style.cssText = 'position:fixed;top:0;left:0;color:white;background:#17151bcc;font:14px sans-serif;padding:5px'; document.body.append(label); }
        label.textContent = `${quality === 'high' ? 'LOD0' : quality.toUpperCase()} / ${angle}°`;
      }, { quality, angle });
      const info = await session.page.evaluate(() => window.__ASSET__!.info());
      if (info.placeholder) throw new Error(`${id}/${quality}: placeholder`);
      metadata.push({ id, quality, angle, ...info });
      frames.push(await session.page.screenshot());
    }
    cells.set(id, frames);
  }
  mkdirSync(out, { recursive: true });
  for (const id of ids) {
    const sheet = new PNG({ width: 1440, height: 1440 });
    for (let a=0; a<2; a++) for (let q=0; q<3; q++) {
      PNG.bitblt(PNG.sync.read(cells.get(id)![a*3+q]), sheet, 0, 0, 480, 360, q*480, a*720);
      PNG.bitblt(PNG.sync.read(cells.get('bld.house-b')![a*3+q]), sheet, 0, 0, 480, 360, q*480, a*720+360);
    }
    writeFileSync(`${out}/${id}.png`, PNG.sync.write(sheet));
  }
  writeFileSync(`${out}/views.json`, JSON.stringify(metadata, null, 2)+'\n');
} finally { await session.close(); stopServer(); }
