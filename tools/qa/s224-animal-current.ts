import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const names = process.env.S224_NAMES?.split(',') ?? ['lion', 'lioness', 'flamingo', 'zebra', 'gorilla', 'monkey', 'elephant'];
const yaw = Number(process.env.S224_YAW ?? -45);
const out = process.env.S224_OUT ?? 'test-results/s224-animal-current';
mkdirSync(out, { recursive: true });
try {
  for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ backend: 'webgl2', tier, viewport: { width: 800, height: 600 } });
    try {
      await session.open();
      await session.page.evaluate(`(() => {
        const game = window.__SCENE__.game, load = game.loadLevel.bind(game);
        game.loadLevel = (id, opts, perf, speculative) => load(id, { ...opts, setup: world => { opts?.setup?.(world); world.scenario = 'L8'; } }, perf, speculative);
      })()`);
      for (const name of names) for (const zoom of [1, 1.5]) {
        const spec: SceneSpec = { name: `s224-${name}-${tier}-${zoom}`, seed: 8, ground: 'asphalt', time: 'L8-zoo', size: 40, dof: false,
          actors: [{ id: 'infected', kind: 'infected', archetype: `infected.${name}`, look: { model: `inf.${name}` }, at: [0, 0], yaw, state: 'idle' }],
          camera: { mode: 'game', target: [0, .8, 0], zoom }, frames: 3 };
        await session.load(spec); await session.step(3); await session.ready();
        const metrics = await session.metrics();
        await session.screenshot(`${out}/${tier}-${name}-z${zoom}.png`);
        writeFileSync(`${out}/${tier}-${name}-z${zoom}.json`, JSON.stringify({ metrics, errors: session.errors }, null, 2));
        console.log(tier, name, zoom, JSON.stringify(metrics.actors.infected?.lod));
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
