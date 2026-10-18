/** Run from repository root through tools/e2e-lock.sh after a production build. */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, type Backend } from '../../../../tools/scenelab/session';
import { runSpec } from '../../../../tools/scenelab/run';
const backend = (process.argv[2] ?? 'webgpu') as Backend;
const prefix = process.env.PHONE_SCENE_PREFIX ?? 'ui-night-';
const rows = [];
const root = process.env.PHONE_OUT ?? `docs/reports/merge-batch10/matrix/phone-${backend}${process.env.PHONE_SCENE_PREFIX ? '-gate-final' : ''}`;
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const session = new SceneSession({ backend, tier: 'low', phone: true, viewport });
    try {
      await session.open();
      for (const file of readdirSync('tests/scenes/catalog').filter(f => f.startsWith(prefix) && f.endsWith('.json')).sort()) {
        for (const zoom of [.5, 1, 1.5]) {
          const spec = readSpec(`tests/scenes/catalog/${file}`);
          spec.camera = { ...spec.camera!, zoom };
          const name = `${spec.name}@low-z${zoom}-${viewport.width}x${viewport.height}`;
          const result = await runSpec(session, spec, { file, out: `${root}/${name}`, shots: [], sheet: spec.sheet ?? Math.max(1, Math.ceil((spec.frames ?? 120) / 16)) });
          rows.push({ name, viewport, backend, ...result });
          mkdirSync(root, { recursive: true });
          writeFileSync(`${root}/index.json`, JSON.stringify(rows, null, 2) + '\n');
          console.log(`${result.pass ? 'pass' : 'FAIL'} ${name}`);
        }
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
if (rows.some(r => !r.pass)) process.exitCode = 1;
