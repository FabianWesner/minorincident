import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
const lod = Number(process.env.S224_LOD ?? 2);
if (![0, 1, 2].includes(lod)) throw Error('S224_LOD must be 0, 1 or 2');
const tier = process.env.S224_TIER === 'low' ? 'low' : 'high';
const out = `test-results/s224-zebra-motion/lod${lod}-${tier}`; mkdirSync(out, { recursive: true });
const bakes = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) as Record<string, string>;
const session = new SceneSession({ backend: 'webgl2', tier, viewport: { width: 800, height: 600 } });
try {
  await session.open();
  await session.page.route('**/assets/**', async route => {
    const url = new URL(route.request().url());
    if (/^\/assets\/models\/skinned\/inf\.zebra\.lod[012](\.low)?\.glb$/.test(url.pathname)) url.pathname = `/assets/models/skinned/inf.zebra.lod${lod}${tier === 'low' ? '.low' : ''}.glb`;
    else if (/^\/assets\/civilians\/inf\.zebra\.lod[012]\.infected\.[^.]+\.bin\.gz$/.test(url.pathname)) url.pathname = bakes[`inf.zebra:lod${lod}:infected`];
    else return route.continue();
    return route.continue({ url: url.href });
  });
  await session.page.evaluate(`(() => { const game=window.__SCENE__.game, load=game.loadLevel.bind(game); game.loadLevel=(id,opts,perf,speculative)=>load(id,{...opts,setup:world=>{opts?.setup?.(world);world.scenario='L8';}},perf,speculative); })()`);
  await session.load({ name: 's224-zebra-motion', seed: 8, ground: 'asphalt', time: 'L8-zoo', size: 60, dof: false,
    actors: [{ id: 'courier', kind: 'courier', at: [0, 0], god: true }, { id: 'zebra', kind: 'infected', archetype: 'infected.zebra', look: { model: 'inf.zebra' }, at: [-8, 0], yaw: 0, state: { chase: 'courier' } }],
    camera: { mode: 'game', target: 'zebra', zoom: 1 }, frames: 3 });
  const cells = [];
  for (let frame = 0; frame <= 300; frame += 15) {
    await session.step(frame ? 15 : 3); cells.push({ frame, jpeg: await session.snapshot() });
    await session.screenshot(`${out}/frame${frame}.png`);
  }
  await session.makeSheet(cells, `${out}/sheet.jpg`, 400, 500);
  writeFileSync(`${out}/metrics.json`, JSON.stringify({ metrics: await session.metrics(), errors: session.errors }, null, 2));
} finally { await session.close(); stopServer(); }
