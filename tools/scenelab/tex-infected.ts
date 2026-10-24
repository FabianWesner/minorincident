/** Textured infected visual/motion receipt, on the real crowd renderer and game camera. */
import { SceneSession, stopServer, writeJson } from './session';
const out = 'docs/reports/tex-infected';
const backend = process.env.TEX_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const tier = process.env.TEX_TIER === 'low' ? 'low' : 'high';
const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 } });
try {
  await session.open();
  await session.load({ name: 'suit-read', ground: 'asphalt', time: 'L1', dof: false,
    camera: { mode: 'game', target: [0, .8, 0], zoom: 1.5 },
    actors: [
      { id: 'current', kind: 'infected', archetype: 'infected.sprinter', at: [-1.2, 0], yaw: 315, look: { model: 'inf.cashier' }, state: 'idle' },
      { id: 'suit', kind: 'infected', at: [1.2, 0], yaw: 315, look: { model: 'inf.common-worker' }, state: 'idle' },
    ], trace: true });
  await session.step(1);
  await session.screenshot(`${out}/${backend}-${tier}-probe.png`);
  writeJson(`${out}/${backend}-${tier}-probe.json`, { metrics: await session.metrics(), state: await session.page.evaluate(() => window.__SS__!.getState().render), errors: session.errors });
  if (session.errors.length) throw new Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
