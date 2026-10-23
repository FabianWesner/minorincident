import { test, expect } from '../browser-pool/fixtures';
import { SceneSession, readSpec } from './session';
import { runSpec } from './run';

// Real Scene Lab workload through Playwright's normal worker/browser lifecycle.
// A dedicated benchmark config keeps this out of the ordinary game suite.
for (let round = 0; round < 2; round++) for (const name of ['house', 'courier-turns', 'qa-grove-east-south']) {
  test(`${round}: ${name}`, async ({ browser }) => {
    if (process.env.MI_PERF_LOCK_HELD !== '1') throw new Error('Reserve all browser slots with quiet-run');
    const session = new SceneSession();
    try {
      const began = Date.now();
      await session.open(browser);
      const result = await runSpec(session, readSpec(`specs/scenes/${name}.json`), { file: name, out: `${process.env.BENCH_OUT}/${round}-${name}`, openMs: Date.now() - began });
      expect(result.pass, JSON.stringify(result.failed)).toBe(true);
    } finally { await session.close(); }
  });
}
