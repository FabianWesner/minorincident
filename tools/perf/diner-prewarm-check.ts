/** Stream every high L3 diner LOD and reject new artwork shader graphs. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.DINER_CHECK_OUT ?? 'test-results/fix51-perf/diner-prewarm.json';
const rows = [];
try {
  for (const backend of ['webgpu', 'webgl2'] as const) {
    const session = new SceneSession({ backend, tier: 'high', query: { loadProfile: '2' } });
    try {
      await session.open();
      const result = await session.page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        await a.loadLevel('L3', { seed: 1 }); a.pause();
        const loaded = { ...a.perf().nodeBuildMaterials };
        const signs = g.world.districts!.districts.flatMap(d => d.layout.placements.filter(p => p.assetId === 'bld.joes-diner')
          .map(p => ({ x: p.position[0] + d.origin[0], z: p.position[2] + d.origin[1] })));
        a.missions.begin();
        for (const at of signs) {
          a.camera.cinematic({ position: [at.x + 14, 18, at.z + 20], target: [at.x, 0, at.z] }, true);
          await a.screenshotReady();
        }
        const after = { ...a.perf().nodeBuildMaterials };
        const keys = Object.keys(after).filter(key => key.startsWith('diner-sign-neon:'));
        return { signs: signs.length, warmed: keys.filter(key => loaded[key]), late: keys.filter(key => after[key] !== loaded[key]) };
      });
      rows.push({ backend, ...result, errors: session.errors });
      assert(result.signs > 0); assert(result.warmed.length > 0); assert.deepEqual(result.late, []); assert.deepEqual(session.errors, []);
    } finally { await session.close(); }
  }
} finally { stopServer(); mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true }); writeFileSync(out, JSON.stringify(rows, null, 2) + '\n'); }
console.log(JSON.stringify(rows));
