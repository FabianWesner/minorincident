import { test, expect } from '../e2e/fixtures';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { AssetDef } from '../../src/assets/types';

const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];

// Explicit batch review; each category produces temporary comparison contact sheets.
for (const prefix of ['char', 'npc', 'inf', 'wpn', 'thr', 'pick', 'prop', 'kit', 'bld', 'int', 'veh']) {
  test(`asset delivery contact sheets ${prefix}`, async ({ page }) => {
    test.skip(!process.env.ASSET_DELIVERY_VISUAL, 'Explicit asset delivery review');
    test.setTimeout(600_000);
    await page.setViewportSize({ width: 480, height: 270 });
    const definitions = (manifest as AssetDef[]).filter(def => existsSync(`assets/${def.id}/model.glb`) && def.id.startsWith(`${prefix}.`));
    mkdirSync('test-results/assets/delivery-sheets', { recursive: true });
    let sheet: PNG;
    for (const [index, def] of definitions.entries()) {
      const row = index % 6;
      if (row === 0) sheet = new PNG({ width: 480 * 6, height: 270 * Math.min(6, definitions.length - index) });
      await page.goto(`/preview/?asset=${def.id}&test=1&renderer=webgl&production=1&inspection=1`);
      await page.waitForFunction(() => !!window.__ASSET__);
      await page.evaluate(() => window.__ASSET__!.ready);
      await page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
      let column = 0;
      for (const distance of [16, 30]) for (const quality of ['high', 'lod1', 'lod2'] as const) {
        if (quality !== 'high' && !def.lods?.[quality]) { column++; continue; }
        await page.evaluate(async ({ quality, distance }) => { await window.__ASSET__!.deliveryView!(quality, distance); }, { quality, distance });
        expect(await page.evaluate(() => window.__ASSET__!.info().placeholder), `${def.id}:${quality}`).toBe(false);
        await page.evaluate(({ id, quality, distance }) => {
          let label = document.querySelector<HTMLDivElement>('#delivery-label');
          if (!label) { label = document.createElement('div'); label.id = 'delivery-label'; label.style.cssText = 'position:fixed;top:0;left:0;background:#17151bcc;color:white;font:12px sans-serif;padding:4px;z-index:100'; document.body.append(label); }
          label.textContent = `${id} ${quality} ${distance}m`;
        }, { id: def.id, quality, distance });
        const frame = PNG.sync.read(await page.screenshot());
        PNG.bitblt(frame, sheet!, 0, 0, 480, 270, column * 480, row * 270);
        column++;
      }
      if (row === 5 || index === definitions.length - 1) writeFileSync(`test-results/assets/delivery-sheets/${prefix}-${Math.floor(index / 6)}.png`, PNG.sync.write(sheet!));
    }
  });
}
