/** Q-191: matched production depot choreography at the requested game zoom. */
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer, writeJson } from '../scenelab/session';
import { runSpec } from '../scenelab/run';

const stage = process.argv[2] ?? 'before';
const out = resolve('test-results/small-27/depot', stage);
try {
  for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ tier, backend: 'webgl2', viewport: { width: 1600, height: 900 } });
    try {
      await session.open();
      const spec = readSpec(resolve('specs/scenes/qa-handover-depot.json'));
      spec.camera = { mode: 'game', target: 'courier', zoom: 1.5 };
      spec.shots = [0, 60, 160, 250, 330, 400, 470];
      const result = await runSpec(session, spec, { out: resolve(out, tier), sheet: 60 });
      writeJson(resolve(out, tier, 'receipt.json'), result);
      console.log(`${stage}/${tier}: ${JSON.stringify(result)}`);
    } finally { await session.close(); }
  }
} finally { stopServer(); }
