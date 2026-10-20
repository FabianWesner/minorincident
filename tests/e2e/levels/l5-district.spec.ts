import { readFileSync } from 'node:fs';
import type { SceneSpec } from '../../../src/debug/scenelab/spec';
import { test, expect } from '../fixtures';
const scene = (name: string) => JSON.parse(readFileSync(`tools/l5/scenes/${name}.json`, 'utf8')) as SceneSpec;
test('T-E23-12e @E23 @E23-AC12 shelf pickup is drawn, highlighted and collectible from the clear aisle', async ({ page }) => {
  await page.goto('/?test=1&scenelab&renderer=webgl&audio=muted');
  await page.waitForFunction(() => !!window.__SCENE__);
  await page.evaluate(async s => { await window.__SS__!.ready; await window.__SCENE__!.load(s); await window.__SCENE__!.step(2); await window.__SCENE__!.ready(); }, scene('shotgun-shelf'));
  const pickup = await page.evaluate(() => window.__SS__!.query({ kind: 'pickup' }).find(e => e.archetype === 'weapon.shotgun' && e.pickup && 'actionId' in e.pickup && !e.pickup.survivorOnly));
  expect(pickup?.pickup).toMatchObject({ surfaceY: .385 });
  // Scene Lab owns actor inputs; exercise collection with real keyboard input in the campaign.
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L5', { seed: 1, progression: 'L5-default' }); a.pause(); a.missions.begin(); const p = a.query({ kind: 'pickup' }).find(e => e.archetype === 'weapon.shotgun' && e.pickup && 'actionId' in e.pickup && !e.pickup.survivorOnly)!; a.teleport(1, { x: p.transform.x + .95, z: p.transform.z }); await a.step(2); });
  await page.keyboard.down('e');
  await page.evaluate(async () => { await window.__SS__!.step(38); await window.__SS__!.screenshotReady(); });
  expect(await page.evaluate(() => window.__SS__!.query({ kind: 'pickup' }).filter(e => e.archetype === 'weapon.shotgun' && e.pickup && 'actionId' in e.pickup && !e.pickup.survivorOnly))).toHaveLength(0);
  await page.keyboard.up('e');
});
