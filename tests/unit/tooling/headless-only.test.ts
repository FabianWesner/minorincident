import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// The user works on this Mac while tests run: a browser window must never appear.
describe('browser automation is headless only', () => {
  it('no test, tool or config launches a headed browser', () => {
    const hits = execSync(
      "git grep -nE \"headless:[[:space:]]*false|--headed|headed:[[:space:]]*true|HEADED=1\" -- tests tools experiment/tools '*.config.ts' package.json || true",
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter((l) => l && !l.includes('headless-only.test.ts'));
    expect(hits).toEqual([]);
  });
});
