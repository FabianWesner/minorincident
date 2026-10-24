import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('native timing admission detects relative Vitest paths and concurrent typechecks', () => {
  const script = readFileSync('tools/perf/quiet-run.sh', 'utf8');
  const pattern = new RegExp(script.match(/! pgrep -f '([^']*node_modules[^']*)'/)![1]);
  for (const command of [
    'node node_modules/.bin/vitest run tests/unit --maxWorkers=4',
    '/opt/homebrew/bin/node /repo/node_modules/.bin/vitest run tests/unit',
    'node /repo/node_modules/.bin/tsc --noEmit',
    '/usr/bin/node node_modules/typescript/bin/tsc --noEmit',
  ]) expect(pattern.test(command), command).toBe(true);
  expect(pattern.test('node tools/qa/census.ts')).toBe(false);
  expect(pattern.test('codex exec a task mentioning node node_modules/.bin/vitest')).toBe(false);
});
