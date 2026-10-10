import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from './fixtures';
import type { ProgressionPreset } from '../../src/sim/progression/Campaign';

test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });

/** Honest inventory of placeholders submitted by the level photo cameras. */
test('T-E17-09-photo @E17 @E17-AC09 level photo spot asset inventory', async ({ page }) => {
  test.setTimeout(600_000);
  await boot(page, '/?test=1&renderer=webgl&quality=high&audio=muted');
  const rows = [];
  mkdirSync('test-results/epics/E17', { recursive: true });
  const phases: Record<string, (string | undefined)[]> = {
    L1: [undefined, 'accident', 'bat'], L2: [undefined, 'doors', 'escape', 'cluster'],
    L3: [undefined, 'fallback', 'segment-3b'], L4: [undefined, 'arrival', 'turn', 'line-break'],
    L5: [undefined, 'survivor-5'], L6: [undefined, 'abandon', 'exit-platform'],
  };
  for (const [level, checkpoints] of Object.entries(phases)) {
    for (const checkpoint of checkpoints) {
      await page.evaluate(async ({ level, checkpoint }) => {
        const a = window.__SS__!;
        a.bot.stop();
        await a.loadLevel(level, { seed: level === 'L2' || level === 'L4' ? 2 : 1, progression: level === 'L1' ? undefined : `${level}-default` as ProgressionPreset });
        a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); await a.step(1);
        if (checkpoint) {
          const base = level === 'L2' && checkpoint !== 'doors' ? 'doors'
            : level === 'L3' && checkpoint === 'segment-3b' ? 'fallback'
              : level === 'L4' && checkpoint !== 'arrival' ? 'arrival'
                : level === 'L6' && checkpoint === 'exit-platform' ? 'abandon' : checkpoint;
          await a.loadLevel(level, { checkpoint: base });
          a.pause(); a.cheats.god(true);
          // Calm-only respawn checkpoints are not photo-state gates. Stage the
          // observer and advance ordinary timers without a completion bot.
          if (level === 'L3' && checkpoint === 'segment-3b') a.missions.teleport('player', { x: 92, z: 0 });
          if (level === 'L6' && checkpoint === 'exit-platform') a.missions.teleport('player', { x: 240, z: 15 });
          if (level === 'L2' && checkpoint === 'cluster') a.missions.teleport('player', { x: 49, z: 29 });
          const reached = () => {
            const m = a.missions.state()!;
            if (m.l2 && checkpoint === 'escape') return m.l2.radioAt > 0;
            if (m.l2 && checkpoint === 'cluster') return m.l2.clusterReached;
            if (m.l4 && checkpoint === 'turn') return m.l4.turnAt > 0;
            if (m.l4 && checkpoint === 'line-break') return m.l4.lineBreakAt > 0;
            return true;
          };
          const deadline = a.tick() + 60 * 600;
          while (!reached() && a.tick() < deadline) await a.step(15);
          if (!reached()) throw new Error(`Photo setup did not reach ${level}/${checkpoint}`);
        }
        await a.step(1);
      }, { level, checkpoint });
      const spots = await page.evaluate(() => window.__SS__!.getState().render.districts!.photoSpots);
      // DistrictView registers W0–W5 aliases with the exact same camera pose;
      // camera.preset does not change district wear. Inventory each physical
      // view once and retain all alias names as equivalent evidence.
      const views = new Map<string, string[]>();
      for (const spot of spots.filter(spot => checkpoint === undefined || spot.includes(`/l${level.slice(1)}-`))) {
        const key = spot.replace(/\/W[0-5]\//, '/');
        if (!views.has(key)) views.set(key, []);
        views.get(key)!.push(spot);
      }
      for (const equivalentSpots of views.values()) {
        const spot = equivalentSpots[0];
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
          return { tick: a.tick(), runtimeCheckpoint: a.missions.state()!.checkpoint, dynamicPlaceholders, placeholders: [...new Set(batches.filter(b => b.placeholder && b.triangles > 0).map(b => b.assetId))], assets: [...new Set(batches.filter(b => b.triangles > 0).map(b => b.assetId))] };
        }, spot);
        rows.push({ level, checkpoint: checkpoint ?? 'start', setup: checkpoint ? 'authored checkpoint + timed observer staging' : 'mission start', spot, equivalentSpots, ...proof });
        writeFileSync('test-results/epics/E17/photo-assets.json', JSON.stringify(rows, null, 2) + '\n');
      }
    }
  }
  mkdirSync('test-results/epics/E17', { recursive: true });
  writeFileSync('test-results/epics/E17/photo-assets.json', JSON.stringify(rows, null, 2) + '\n');
  expect(rows.filter(r => r.placeholders.length)).toEqual([]);
});
