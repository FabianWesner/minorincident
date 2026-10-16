import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { selectionFor } from '../../../tools/verify-selection';

test('E32 verifier selects every tagged native performance case @E32-AC31', () => {
  const source = readFileSync('tools/verify.ts', 'utf8');
  expect([...source.matchAll(/: target === 'E32'/g)]).toHaveLength(1);
  const branch = source.slice(source.indexOf(": target === 'E32'"), source.indexOf(": target === 'E30'"));
  expect(branch).toContain("'tools/perf/quiet-run.sh'");
  expect(branch).toContain("'--grep', `^(?=.*(?:${selection.pattern}))(?=.*@perf)`");
  expect(branch).not.toContain("'tests/perf/l10-district-budgets.spec.ts'");
  const pattern = new RegExp(`^(?=.*(?:${selectionFor('E32').pattern}))(?=.*@perf)`);
  for (const file of ['l10-district-budgets', 'l10-assault-budgets', 'l10-arena-budgets',
    'l10-finale-budgets', 'l10-cure-mist', 'l10-epilogue', 'l10-lod-residency',
    'l10-campus-corridor-budgets', 'l10-alpha-contracts']) {
    const titles = [...readFileSync(`tests/perf/${file}.spec.ts`, 'utf8').matchAll(/test\(\s*(['"`])(.+?)\1/g)].map(match => match[2]);
    expect(titles.some(title => pattern.test(title)), file).toBe(true);
  }
  expect(pattern.test('@E32-AC31 functional only')).toBe(false);
  expect(pattern.test('@E31-AC19 @perf another epic')).toBe(false);
});
