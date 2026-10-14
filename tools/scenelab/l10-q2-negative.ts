/** Real-browser negative controls: a green catalog must reject missing charge/release input. */
import { SceneSession, readSpec, stopServer, type Backend } from './session';
import { runSpec } from './run';
const backend = (process.argv[2] ?? 'webgpu') as Backend;
const session = new SceneSession({ backend, tier: 'high' });
try {
  await session.open();
  for (const [name, gate] of [['mist-no-release', 'cure.releaseCount.min'], ['charge-no-activation', 'cure.chargeTicks.min']]) {
    const spec = readSpec(`tests/scenes/negative/qa-l10-${name}.json`);
    const result = await runSpec(session, spec, { out: `test-results/epics/E32/l10-q2/negative-${backend}/${name}`, shots: [], sheet: spec.frames });
    if (result.pass || !result.failed.some(c => c.name === gate)) throw new Error(`${name} did not reject the broken variant through ${gate}`);
    console.log(`EXPECTED FAIL ${name}: ${result.failed.map(c => `${c.name}=${c.value}`).join(', ')}`);
  }
} finally { await session.close(); stopServer(); }
