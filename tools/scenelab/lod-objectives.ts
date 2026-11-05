/** QA sheets for the objective/armory/garage LOD packages (PKG-20/21/22): every delivered tier of each asset at the
 * game lens/elevation from two angles (45 and 225 degrees), forced via the preview inspection view.
 * Headless via tools/e2e-lock.sh: `sh tools/e2e-lock.sh npx tsx tools/scenelab/lod-objectives.ts [outDir] [assetId...]`. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, origin, stopServer } from './session';

const [, , outArg, ...picked] = process.argv;
const out = outArg ?? 'test-results/lod-objectives';
const ids = picked.length ? picked : ['prop.package-courier', 'prop.plank-stack', 'prop.armory-table', 'prop.axe-rack', 'prop.crowd-fence', 'house.garage.closed', 'house.garage.half'];
const qualities = ['high', 'lod1', 'lod2'] as const;
const angles = [45, 225];
const session = new SceneSession({ viewport: { width: 480, height: 360 } });
try {
  await session.open();
  mkdirSync(out, { recursive: true });
  const metadata: unknown[] = [];
  for (const id of ids) {
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
    const sheet = new PNG({ width: 1440, height: 720 });
    for (let a = 0; a < angles.length; a++) for (let q = 0; q < qualities.length; q++) PNG.bitblt(PNG.sync.read(frames[a * 3 + q]), sheet, 0, 0, 480, 360, q * 480, a * 360);
    writeFileSync(`${out}/${id}.png`, PNG.sync.write(sheet));
  }
  writeFileSync(`${out}/views.json`, JSON.stringify(metadata, null, 2) + '\n');
} finally { await session.close(); stopServer(); }
