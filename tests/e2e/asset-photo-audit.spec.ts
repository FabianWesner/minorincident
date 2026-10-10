import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from './fixtures';

/** Honest inventory of placeholders submitted by the level photo cameras. */
test('T-E17-09-photo @E17 @E17-AC09 level photo spot asset inventory', async ({ page }) => {
  test.setTimeout(600_000);
  await boot(page, '/?test=1&renderer=webgl&quality=high&audio=muted');
  const rows = [];
  const phases: Record<string, (string | undefined)[]> = {
    L1: [undefined, 'accident', 'bat'], L2: [undefined, 'doors', 'escape', 'cluster'],
    L3: [undefined, 'fallback', 'segment-3b'], L4: [undefined, 'arrival', 'turn', 'line-break'],
    L5: [undefined, 'survivor-5'], L6: [undefined, 'abandon', 'exit-platform'],
  };
  for (const [level, checkpoints] of Object.entries(phases)) for (const checkpoint of checkpoints) {
    await page.evaluate(async ({ level, checkpoint }) => { const a = window.__SS__!; await a.loadLevel(level, { checkpoint }); a.pause(); a.missions.begin(); await a.step(1); }, { level, checkpoint });
    const spots = await page.evaluate(() => window.__SS__!.getState().render.districts!.photoSpots);
    for (const spot of spots.filter(spot => checkpoint === undefined || spot.includes(`/l${level.slice(1)}-`))) {
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
      rows.push({ level, checkpoint: checkpoint ?? 'start', spot, ...proof });
    }
  }
  mkdirSync('test-results/epics/E17', { recursive: true });
  writeFileSync('test-results/epics/E17/photo-assets.json', JSON.stringify(rows, null, 2) + '\n');
  expect(rows.filter(r => r.placeholders.length)).toEqual([]);
});
