/** Render restored native L8 snapshots once. Counters only; no frame-time verdict on a busy host. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { Game } from '../../src/Game';
import type { CampaignSave } from '../../src/sim/progression/Campaign';
import type { Mission } from '../../src/sim/missions/Mission';
import { SceneSession, stopServer } from '../scenelab/session';

const input = JSON.parse(await readFile(process.env.L8_STATE_OUT!, 'utf8')) as {
  campaign: CampaignSave; snapshots: { tick: number; saved: ReturnType<Mission['saveResume']> }[];
};
const session = new SceneSession({ backend: 'webgpu', tier: 'high', query: { crowdProbe: 'drawn' } });
const rows = [];
try {
  await session.open();
  await session.page.evaluate(async campaign => {
    const a = window.__SS__!; a.campaign.restore(campaign); a.settings.set({ quality: 'high' });
    await a.loadLevel('L8', { seed: 1 }); a.pause(); a.camera.follow(); a.camera.zoom(1.5); a.debug.figureJoints(false);
  }, input.campaign);
  for (const snapshot of input.snapshots) {
    const row = await session.page.evaluate(async snapshot => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      g.world.tick = snapshot.tick; g.world.missions!.loadResume(snapshot.saved);
      await a.step(0); await a.screenshotReady();
      const p = a.perf(), entities = [...g.world.entities.iterate()];
      return { diagnosticCountersOnly: true, tick: g.world.tick, backend: p.backend, quality: p.quality,
        player: g.world.entities.get(1)!.transform, checkpoint: g.world.missions!.state.checkpoint,
        drawCalls: p.drawCalls, triangles: p.triangles, profile: p.profile,
        largestAssets: Object.entries(p.profileAssets ?? {}).sort((a, b) => b[1].triangles - a[1].triangles).slice(0, 15),
        drawnCharacters: a.crowdFigures().filter(f => f.drawn).length,
        bars: (g.view as unknown as { healthBars?: { count: number } }).healthBars?.count ?? 0,
        livingInfected: g.world.infected!.active.filter(e => e.health.current > 0).length, directorSlots: g.world.infected!.director.count, corpses: entities.filter(e => !!e.corpse).length,
        followers: g.world.missions!.l8!.roster().length, nodeBuilds: p.nodeBuilds, heapBytes: p.heapBytes };
    }, snapshot);
    assert.equal(row.backend, 'webgpu'); rows.push(row);
    console.log(JSON.stringify({ tick: row.tick, draws: row.drawCalls, triangles: row.triangles, characters: row.drawnCharacters, bars: row.bars }));
  }
  assert.deepEqual(session.errors, []);
  await writeFile(process.argv[2] ?? 'docs/reports/r12-l8perf/render-census.json', JSON.stringify({ at: new Date().toISOString(), errors: session.errors, rows }, null, 2));
} finally { await session.close(); stopServer(); }
