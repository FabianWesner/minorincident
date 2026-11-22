import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const names = process.env.S224_NAMES?.split(',') ?? ['lion', 'lioness', 'flamingo', 'zebra', 'gorilla', 'monkey', 'elephant'];
const lod = Number(process.env.S224_LOD ?? 2);
if (![0, 1, 2].includes(lod)) throw new Error('S224_LOD must be 0, 1 or 2');
const deliveries = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) as Record<string, string>;
const redirects: string[] = [];
const yaw = Number(process.env.S224_YAW ?? -45);
const out = process.env.S224_OUT ?? 'test-results/s224-animal-current';
mkdirSync(out, { recursive: true });
try {
  for (const tier of [process.env.S224_TIER === 'low' ? 'low' : 'high'] as const) {
    const session = new SceneSession({ backend: 'webgl2', tier, viewport: { width: 800, height: 600 } });
    try {
      await session.open();
      await session.page.route('**/assets/**', async route => {
        const url = new URL(route.request().url());
        const model = url.pathname.match(/^\/assets\/models\/skinned\/(inf\.(?:lion|lioness|flamingo|zebra|gorilla|monkey|elephant))\.lod[012](\.low)?\.glb$/);
        const bake = url.pathname.match(/^\/assets\/civilians\/(inf\.(?:lion|lioness|flamingo|zebra|gorilla|monkey|elephant))\.lod[012]\.infected\.[^.]+\.bin\.gz$/);
        if (model) url.pathname = `/assets/models/skinned/${model[1]}.lod${lod}${model[2] ?? ''}.glb`;
        else if (bake) {
          const target = deliveries[`${bake[1]}:lod${lod}:infected`];
          if (!target) throw new Error(`Missing ${bake[1]} lod${lod} bake`);
          url.pathname = target;
        } else return route.continue();
        redirects.push(`${route.request().url()} -> ${url.href}`);
        return route.continue({ url: url.href });
      });
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
        await session.screenshot(`${out}/lod${lod}-${tier}-${name}-z${zoom}.png`);
        writeFileSync(`${out}/lod${lod}-${tier}-${name}-z${zoom}.json`, JSON.stringify({ metrics, errors: session.errors }, null, 2));
        console.log(tier, name, zoom, JSON.stringify(metrics.actors.infected?.lod));
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/redirects-lod${lod}-${process.env.S224_TIER ?? 'high'}.json`, JSON.stringify(redirects, null, 2)); }
