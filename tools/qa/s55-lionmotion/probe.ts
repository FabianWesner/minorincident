import { mkdirSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, writeJson } from '../../scenelab/session';
const out = 'test-results/s55-lionmotion/probe';
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 960, height: 540 } });
try {
  await session.open();
  const spec = readSpec('specs/scenes/r36-lion-cats-run.json');
  spec.trace = true;
  await session.load(spec);
  for (let i = 0; i < 15; i++) {
    await session.step(60);
    writeJson(`${out}/metrics.json`, await session.metrics());
    console.log(`recorded ${(i + 1) * 60} frames`);
  }
} finally { await session.close(); stopServer(); }
