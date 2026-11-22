import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
const out = 'test-results/s224-lioness-motion'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 800, height: 600 } });
try {
  await session.open();
  await session.page.evaluate(`(() => { const game=window.__SCENE__.game, load=game.loadLevel.bind(game); game.loadLevel=(id,opts,perf,speculative)=>load(id,{...opts,setup:world=>{opts?.setup?.(world);world.scenario='L8';}},perf,speculative); })()`);
  await session.load({ name: 's224-lioness-motion', seed: 8, ground: 'asphalt', time: 'L8-zoo', size: 60, dof: false,
    actors: [{ id: 'courier', kind: 'courier', at: [0, 0], god: true }, { id: 'lioness', kind: 'infected', archetype: 'infected.lioness', look: { model: 'inf.lioness' }, at: [-8, 0], yaw: 0, state: { chase: 'courier' } }],
    camera: { mode: 'game', target: 'courier', zoom: 1 }, frames: 3 });
  const cells = [];
  for (let frame = 0; frame <= 300; frame += 30) {
    await session.step(frame ? 30 : 3); cells.push({ frame, jpeg: await session.snapshot() });
  }
  await session.makeSheet(cells, `${out}/sheet.jpg`, 400, 500);
  writeFileSync(`${out}/metrics.json`, JSON.stringify({ metrics: await session.metrics(), errors: session.errors }, null, 2));
} finally { await session.close(); stopServer(); }
