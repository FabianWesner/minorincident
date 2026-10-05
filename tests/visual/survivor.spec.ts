import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { boot, expect, test } from '../e2e/fixtures';
import type { Page } from '@playwright/test';
import type { GearTier, SurvivorVariant } from '../../src/data/survivor';
const output = 'test-results/epics/E04';
const views = ['front', 'right', 'back', 'left'] as const;
async function setup(page: Page): Promise<void> {
  mkdirSync(output, { recursive: true }); await boot(page);
  await page.evaluate(async () => {
    const api = window.__SS__!; await api.loadScenario('survivor', { seed: 1 }); api.pause();
    api.input.set({ aim: { x: 1, z: 0 }, left: { down: true, held: true, up: false } }); await api.step(1); api.input.clear(); await api.step(6);
  });
}
async function capture(page: Page, variant: SurvivorVariant, tier: GearTier, view: string, name: string): Promise<PNG> {
  await page.evaluate(async ({ variant, tier, view }) => { const api = window.__SS__!; api.survivor.select(variant, tier); api.camera.preset(view); await api.screenshotReady(); }, { variant, tier, view });
  return PNG.sync.read(await page.screenshot({ path: `${output}/${name}.png`, clip: { x: 500, y: 80, width: 600, height: 800 } }));
}
function colorCounts(p: PNG, mask: PNG): { red: number; teal: number; character: number } {
  let red = 0, teal = 0, character = 0, top = p.height, bottom = 0;
  for (let i = 0; i < mask.data.length; i += 4) if (isCharacter(mask, i)) { const y = Math.floor(i / 4 / p.width); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  for (let i = 0; i < p.data.length; i += 4) {
    if (!isCharacter(mask, i)) continue;
    character++;
    const r = p.data[i], g = p.data[i + 1], b = p.data[i + 2];
    const y = Math.floor(i / 4 / p.width);
    // Sample the torso/backpack region; red shoes and skin cannot satisfy red-top identity.
    if (y < top + (bottom - top) * 0.25 || y > top + (bottom - top) * 0.65) continue;
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b), delta = hi - lo;
    const hue = delta === 0 ? 0 : ((hi === r ? (g - b) / delta + 6 : hi === g ? (b - r) / delta + 2 : (r - g) / delta + 4) % 6) * 60;
    if ((hue < 12 || hue > 348) && delta / hi > 0.4 && r > 60) red++;
    if (hue > 150 && hue < 195 && delta / hi > 0.25 && g > 35) teal++;

  }
  return { red, teal, character };
}

function isCharacter(mask: PNG, i: number): boolean { return mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240; }
async function mask(page: Page, name: string): Promise<PNG> {
  await page.evaluate(() => window.__SS__!.settings.set({ idPass: true }));
  const image = PNG.sync.read(await page.screenshot({ path: `${output}/${name}-mask.png`, clip: { x: 500, y: 80, width: 600, height: 800 } }));
  await page.evaluate(() => window.__SS__!.settings.set({ idPass: false })); return image;
}

test('T-E04-10 @E04 @E04-AC10 all five tiers retain red/teal; tier 0 and 4 differ on over 5% of character pixels', async ({ page }) => {
  test.setTimeout(180_000); await setup(page); const results = [];
  for (const variant of ['female', 'male'] as const) {
    const base: PNG[] = [], baseMasks: PNG[] = []; let characterPixels = 0, differences = 0;
    for (const tier of [0, 1, 2, 3, 4] as const) {
      let red = 0, teal = 0;
      for (let i = 0; i < views.length; i++) {
        const image = await capture(page, variant, tier, views[i], `${variant}-tier-${tier}-${views[i]}`), silhouette = await mask(page, `${variant}-tier-${tier}-${views[i]}`), counts = colorCounts(image, silhouette);
        red += counts.red; teal += counts.teal;
        if (tier === 0) { base.push(image); baseMasks.push(silhouette); characterPixels += counts.character; }
        if (tier === 4) {
          const diff = new PNG({ width: image.width, height: image.height });
          pixelmatch(base[i].data, image.data, diff.data, image.width, image.height, { threshold: 0.1, diffMask: true });
          for (let p = 0; p < diff.data.length; p += 4) if (diff.data[p + 3] && (isCharacter(baseMasks[i], p) || isCharacter(silhouette, p))) differences++;
        }
      }
      expect(red, `${variant} tier ${tier} red top`).toBeGreaterThan(100); expect(teal, `${variant} tier ${tier} teal bag`).toBeGreaterThan(100);
      results.push({ variant, tier, red, teal });
    }
    const ratio = differences / characterPixels;
    expect(characterPixels).toBeGreaterThan(1000); expect(ratio).toBeGreaterThan(0.05); results.push({ variant, differences, characterPixels, ratio });
    const perf = await page.evaluate(() => window.__SS__!.perf());
    expect(perf.drawCalls).toBeLessThanOrEqual(600); expect(perf.triangles).toBeLessThanOrEqual(1_500_000); results.push({ variant, perf });
  }
  writeFileSync(`${output}/gear-colors.json`, JSON.stringify(results, null, 2));
});

test('T-E04-11 @E04 @E04-AC11 supplied GLB character sheet has a reviewed Character vision checklist', async ({ page }) => {
  test.setTimeout(120_000); await setup(page);
  const sheet = new PNG({ width: 2400, height: 1600 });
  for (const [row, variant] of (['female', 'male'] as const).entries()) for (const [column, view] of views.entries()) {
    const image = await capture(page, variant, 0, view, `sheet-${variant}-${view}`);
    PNG.bitblt(image, sheet, 0, 0, image.width, image.height, column * 600, row * 800);
  }
  writeFileSync(`${output}/character-sheet.png`, PNG.sync.write(sheet));
  await capture(page, 'female', 0, 'gameplay', 'female-gameplay');
  await capture(page, 'male', 0, 'gameplay', 'male-gameplay');
  await capture(page, 'female', 4, 'gameplay', 'gear-gameplay');
  const review = readFileSync('tests/visual/survivor-review.md', 'utf8'); writeFileSync(`${output}/review.md`, review);
  for (const item of ['B1', 'B2', 'B3', 'B4', 'B5']) expect(review).toMatch(new RegExp(`${item}.*PASS`));
});
