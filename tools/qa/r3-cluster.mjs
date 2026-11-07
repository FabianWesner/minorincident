/** r3-corpse: G14 overlap fixture truncated to the first N bodies (ids stay stable), free camera via CAM=px,py,pz,tx,ty,tz.
 *  Usage: r3-cluster.mjs <bodies> <out.png> [tier] */
import { SceneSession, readSpec, stopServer } from '../scenelab/session.ts';
const [count, file, tier = 'high'] = process.argv.slice(2);
const cam = (process.env.CAM ?? '-2.2,7,2.6,-2.2,0,1.7').split(',').map(Number);
const session = new SceneSession({ tier, backend: process.env.BACKEND ?? 'webgl2' });
try {
  await session.open();
  const spec = readSpec('tests/scenes/catalog/l4-corpses-persist.json');
  spec.actors[0].at = [0, 0]; if (process.env.ALIVE) for (const a of spec.actors) if (a.state) a.state = "idle"; spec.actors = spec.actors.slice(0, 1 + Number(count));
  await session.load(spec); await session.step(120);
  await session.page.evaluate(async c => { const a = window.__SS__; a.camera.cinematic({ position: [c[0], c[1], c[2]], target: [c[3], c[4], c[5]] }, true); await a.screenshotReady(); }, cam);
  await session.screenshot(file);
} finally { await stopServer(); }
