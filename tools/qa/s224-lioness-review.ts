import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

const out = 'test-results/s224-lioness'; mkdirSync(out, { recursive: true });
for (const tier of ['low', 'high'] as const) for (const zoom of [1, 1.5]) {
  const session = new SceneSession({ backend: 'webgl2', tier, viewport: { width: 800, height: 600 } });
  try {
    await session.open();
    await session.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game, load = game.loadLevel.bind(game);
      game.loadLevel = (id, opts, perf, speculative) => load(id, { ...opts, setup: world => { opts?.setup?.(world); world.scenario = 'L8'; } }, perf, speculative);
    });
    const spec: SceneSpec = { name: `s224-lioness-${tier}-${zoom}`, seed: 8, ground: 'asphalt', time: 'L8-zoo', size: 40, dof: false,
      actors: [
        { id: 'healthy', kind: 'animal', species: 'lion', at: [-2, 0], yaw: -45, state: 'idle' },
        { id: 'infected', kind: 'infected', archetype: 'infected.lion', look: { model: 'inf.lioness' }, at: [2, 0], yaw: -45, state: 'idle' },
      ], camera: { mode: 'game', target: [0, .8, 0], zoom }, frames: 3 };
    await session.load(spec); await session.step(3); await session.ready();
    const metrics = await session.metrics();
    await session.screenshot(`${out}/${tier}-z${zoom}.png`);
    writeFileSync(`${out}/${tier}-z${zoom}.json`, JSON.stringify({ metrics, errors: session.errors }, null, 2));
    console.log(tier, zoom, JSON.stringify(Object.fromEntries(Object.entries(metrics.actors).map(([k, v]) => [k, { lod: v.lod, drawnFrames: v.drawnFrames }]))));
  } finally { await session.close(); }
}
