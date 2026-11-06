/** Actual objective approaches: ring pixels and outer radius while the native hold is counting. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
import type { Game } from '../../src/Game';

const level = process.argv[2] === 'L4' ? 'L4' : 'L1';
const step = level === 'L1' ? 'pickup' : 'hide';
const out = `test-results/sweep-a3/ring-${level}`;
mkdirSync(`${out}/captures`, { recursive: true });
const runs: unknown[] = [];
try {
  for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of ['low', 'high'] as const) {
    const s = new SceneSession({ backend, tier, query: { ui: '1' } });
    try {
      await s.open(); await s.page.evaluate('window.__name=f=>f');
      await s.page.evaluate(async ({ level, step, tier }) => {
        const a = window.__SS__!;
        a.settings.set({ quality: tier });
        await a.loadLevel(level, { seed: 1, ...(level === 'L4' ? { progression: 'L4-default' } : {}) });
        a.missions.begin(); a.pause(); a.camera.follow(); a.bot.start('complete');
        document.documentElement.setAttribute('data-scene-hud', '');
        document.querySelectorAll('#hud,.hud').forEach(n => n.setAttribute('data-scene-hud', ''));
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        for (let i = 0; i < 30000; i++) {
          const q = g.world.missions!.state.steps[step];
          if (q.status === 'active' && q.interaction >= 10) break;
          await a.step(q.status === 'active' ? 1 : 30);
        }
        const q = g.world.missions!.state.steps[step];
        if (q.status !== 'active' || q.interaction < 10) throw Error('Native active hold not reached');
        a.bot.stop(); a.input.clear();
      }, { level, step, tier });
      const frames = [];
      for (const zoom of [.5, 1.5]) {
        const state = await s.page.evaluate(async ({ zoom, step }) => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
          a.camera.zoom(zoom); await a.screenshotReady();
          const m = g.world.missions!, anchor = m.def.anchors[m.state.marker!], p = g.world.entities.get(1)!.transform;
          const marker = (g.view as unknown as { marker: { visible: boolean; ring: { geometry: { parameters: { radius: number; tube: number } }; matrixWorld: { elements: number[] } } } }).marker;
          const ring = marker.ring, e = ring.matrixWorld.elements;
          return { tick: g.world.tick, marker: m.state.marker, anchor, holdTicks: m.state.steps[step].interaction,
            player: { ...p }, playerDistance: Math.hypot(p.x - anchor.x, p.z - anchor.z),
            actualZoom: g.view.view.playerZoom, visible: marker.visible,
            outerRadius: (ring.geometry.parameters.radius + ring.geometry.parameters.tube) * Math.hypot(e[0], e[1], e[2]) };
        }, { zoom, step });
        assert(state.visible && state.holdTicks >= 10 && state.playerDistance <= state.anchor.radius);
        assert(Math.abs(state.outerRadius - state.anchor.radius) < 1e-6);
        const file = `${out}/captures/${backend}-${tier}-z${zoom}.png`;
        await s.page.screenshot({ path: file });
        frames.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), requestedZoom: zoom, state });
      }
      assert.deepEqual(s.errors, []);
      runs.push({ backend, tier, frames }); console.log(level, backend, tier, 'active hold captured');
    } finally { await s.close(); }
  }
} finally {
  stopServer();
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), level, step, runs,
    method: 'Ordinary native complete InputFrames to an active objective hold, then paused input cleared. No relocation, actor injection, protection or objective skips. Production follow camera at both requested zooms; read-only geometry/world-matrix outer radius and actual trigger anchor retained. No performance timing.' }, null, 2) + '\n');
}
