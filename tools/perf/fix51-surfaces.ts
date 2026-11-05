/** Deterministic mixed-atlas/live/frozen controls for the shader batching change. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
import { runSpec } from '../scenelab/run';

const out = process.env.FIX51_SURFACES_OUT ?? 'test-results/fix51-perf/surfaces';
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const backend of ['webgpu', 'webgl2'] as const) for (const tier of ['high', 'low'] as const) {
    if (process.env.FIX51_SURFACE_CELL && process.env.FIX51_SURFACE_CELL !== `${backend}-${tier}`) continue;
    const session = new SceneSession({ backend, tier });
    try {
      await session.open();
      for (const name of ['perf-heap-corpse-pools', 'l5-po-dale-discovery']) {
        if (process.env.FIX51_SURFACE_SCENE && process.env.FIX51_SURFACE_SCENE !== name) continue;
        const file = `tests/scenes/catalog/${name}.json`, spec = readSpec(file);
        const result = await runSpec(session, spec, { file, out: `${out}/${backend}-${tier}-${name}`, frames: name === 'perf-heap-corpse-pools' ? 360 : 1,
          shots: name === 'perf-heap-corpse-pools' ? [0, 120, 360] : [1], sheet: 0 });
        rows.push({ backend, tier, name, pass: result.pass, failed: result.failed, files: result.files });
        if (!result.pass) throw Error(JSON.stringify(rows.at(-1)));
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/receipts.json`, JSON.stringify(rows, null, 2) + '\n'); }
console.log(JSON.stringify(rows));
