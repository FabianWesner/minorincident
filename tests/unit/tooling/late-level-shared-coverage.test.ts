import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { selectionFor } from '../../../tools/verify-selection';

// These level criteria explicitly reuse E07's combat contracts. A passing E07
// run must not be the only way to execute them when verifying the level itself.
for (const [file, epics] of [
  ['tests/sim/ai/alpha.test.ts', ['E29', 'E30', 'E32']],
  ...['sim/ai/zoo-s1.test.ts', 'sim/ai/zoo-s2.test.ts', 'sim/ai/zoo-s3.test.ts',
    'e2e/zoo-s1.spec.ts', 'e2e/zoo-s2.spec.ts', 'e2e/zoo-s3.spec.ts'].map(file => [`tests/${file}`, ['E30']] as const),
] as const) test(`shared combat criteria remain selected for ${file}`, () => {
  const source = readFileSync(file, 'utf8');
  const titles = [...source.matchAll(/test\(\s*(['"`])(.+?)\1/g)].map(match => match[2]).filter(title => title.includes('@E07-AC'));
  expect(titles.length).toBeGreaterThan(0);
  for (const epic of epics) {
    const pattern = new RegExp(selectionFor(epic).pattern);
    for (const title of titles) expect(pattern.test(title), `${epic}: ${title}`).toBe(true);
  }
});
