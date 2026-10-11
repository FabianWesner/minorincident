import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { test, expect } from '../e2e/fixtures';
const scene = (name: string) => JSON.parse(readFileSync(`tools/l5/scenes/${name}.json`, 'utf8')) as SceneSpec;
test('T-E23-15v @E23 @E23-AC15 authored metro leaf visibly descends through halfway to closed on both tiers', async ({ page }) => {
  for (const tier of ['high', 'low']) {
    await page.goto(`/?test=1&scenelab&renderer=webgl&audio=muted&quality=${tier}`);
    await page.waitForFunction(() => !!window.__SCENE__);
    await page.evaluate(async s => { await window.__SS__!.ready; await window.__SCENE__!.load(s); await window.__SCENE__!.step(2); await window.__SCENE__!.ready(); }, scene('metro-doors'));
    const open = PNG.sync.read(await page.locator('canvas').screenshot());
    await page.evaluate(async () => { await window.__SCENE__!.step(30); await window.__SCENE__!.ready(); });
    const half = PNG.sync.read(await page.locator('canvas').screenshot());
    await page.evaluate(async () => { await window.__SCENE__!.step(57); await window.__SCENE__!.ready(); });
    const closed = PNG.sync.read(await page.locator('canvas').screenshot());
    const changed = (a: PNG, b: PNG) => { let n = 0; for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 30) n++; return n; };
    // Large image changes at each pose prevent a hidden/no-op shutter from passing.
    expect(changed(open, half)).toBeGreaterThan(1000); expect(changed(half, closed)).toBeGreaterThan(1000);
  }
});
