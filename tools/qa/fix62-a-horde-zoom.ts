/** The explicit 80-infected visibility fixture at both unlocked zoom limits. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { measureCourierShare } from '../scenelab/run';
import { provenance } from './accept/probe';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

const out = 'test-results/fix62-a/horde-zoom';
mkdirSync(`${out}/captures`, { recursive: true });
const runs = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
    try {
      await session.open(); await session.page.evaluate('window.__name=f=>f');
      const spec: SceneSpec = { name: 'fix62-a-horde-80', seed: 1, ground: 'asphalt', size: 40, time: 'L3', infectedCap: 200, hud: true,
        actors: [{ id: 'courier', kind: 'courier', at: [0, 0], god: true }, ...Array.from({ length: 80 }, (_, i) => {
          const angle = i * 2.3999632297, radius = 2 + Math.sqrt(i / 80) * 3;
          return { id: `infected-${i}`, kind: 'infected' as const, at: [Math.cos(angle) * radius, Math.sin(angle) * radius] as [number, number], state: 'chase' as const };
        })], camera: { mode: 'follow', actor: 'courier', zoom: 1 } };
      await session.load(spec); await session.step(180);
      const frames = [];
      for (const zoom of [.5, 1.5]) {
        await session.page.evaluate(async zoom => { window.__SCENE__!.setCamera({ mode: 'follow', actor: 'courier', zoom }); await window.__SS__!.screenshotReady(); }, zoom);
        const state = await session.page.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game;
          return { tick: g.world.tick, zoom: g.view.view.playerZoom, living: g.world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.pendingAdmission).length,
            foreground: g.view.getState().courierForeground };
        });
        assert.equal(state.zoom, zoom); assert.equal(state.living, 80);
        const file = `${out}/captures/${tier}-z${zoom}.png`;
        await session.page.screenshot({ path: file });
        const visibility = await measureCourierShare(session); assert(visibility.reference > 0);
        frames.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), state, visibility });
      }
      assert.deepEqual(session.errors, []); runs.push({ tier, frames }); console.log(tier, frames.map(f => f.visibility.share));
    } finally { await session.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), method: 'Explicit80-infected production crowd fixture, normal follow camera at actual unlocked zoom0.5/1.5. No population reduction. Same-frame ID masks report visible courier body pixels independently of manual review.', runs }, null, 2)); }
