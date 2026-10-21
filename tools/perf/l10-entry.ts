/** Run with quiet-run. Measures production debug selection and L9 automatic continue. */
import assert from 'node:assert/strict';
import { SceneSession, origin, stopServer } from '../scenelab/session';
import { measureL10Entry } from './l10Entry';

const out = process.env.L10_OUT ?? 'test-results/fixes-13h-l10/entry';
const backend = process.env.L10_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const session = new SceneSession({ backend, tier: 'low', viewport: { width: 1600, height: 900 }, nativeFrameTiming: true });
try {
  await session.open();
  for (const entry of (process.env.L10_ENTRIES ?? 'debug,continue').split(',')) {
    if (entry !== 'debug' && entry !== 'continue') throw Error(`Unknown entry ${entry}`);
    const result = await measureL10Entry(session.page, origin, entry, backend, out);
    assert.ok(result.playableFrames > 100);
    if (process.env.L10_ASSERT === '1') assert.ok(result.max <= 200, `${entry}: ${result.max} ms after loading`);
  }
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }
