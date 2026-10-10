import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from './fixtures';

/** Honest inventory of placeholders submitted by the level photo cameras. */
test('T-E17-09-photo @E17 @E17-AC09 level photo spot asset inventory', async ({ page }) => {
  test.setTimeout(600_000);
  await boot(page, '/?test=1&renderer=webgl&quality=high&audio=muted');
  const rows = [];
  for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']) {
    await page.evaluate(async level => { const a = window.__SS__!; await a.loadLevel(level); a.pause(); a.missions.begin(); }, level);
    const spots = await page.evaluate(() => window.__SS__!.getState().render.districts!.photoSpots);
    for (const spot of spots) {
      const proof = await page.evaluate(async spot => {
        const a = window.__SS__!; a.camera.preset(spot); await a.screenshotReady();
        const render = a.getState().render, batches = render.districts!.batches;
        const actorIds = new Set(render.entityAssets?.actors.filter(e => e.source === 'placeholder').map(e => e.id));
        const heroIds = new Set(render.npcs?.heroes.filter(e => e.source === 'placeholder').map(e => e.id));
        const vehicleIds = new Set(render.vehicles.filter(e => e.placeholder).map(e => e.id));
        const dynamicPlaceholders = a.query({}).filter(e => !e.hidden && (actorIds.has(e.id) || heroIds.has(e.id) || vehicleIds.has(e.id) || e.traffic || e.convoy)).flatMap(e => {
          const point = a.input.project({ x: e.transform.x, z: e.transform.z });
          if (point.x < 0 || point.x > innerWidth || point.y < 0 || point.y > innerHeight) return [];
          return [{ id: e.id, assetId: e.appearance?.asset ?? e.archetype, representation: e.traffic || e.convoy ? 'NpcView procedural traffic box' : 'runtime model placeholder' }];
        });
        return { dynamicPlaceholders, placeholders: [...new Set(batches.filter(b => b.placeholder && b.triangles > 0).map(b => b.assetId))], assets: [...new Set(batches.filter(b => b.triangles > 0).map(b => b.assetId))] };
      }, spot);
      rows.push({ level, spot, ...proof });
    }
  }
  mkdirSync('test-results/epics/E17', { recursive: true });
  writeFileSync('test-results/epics/E17/photo-assets.json', JSON.stringify(rows, null, 2) + '\n');
  expect(rows.filter(r => r.placeholders.length)).toEqual([]);
});
