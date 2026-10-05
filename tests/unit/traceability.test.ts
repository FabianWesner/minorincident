import { expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { selectionFor } from '../../tools/verify-selection';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sourceFiles(`${dir}/${entry.name}`) : /\.(test|spec)\.ts$/.test(entry.name) ? [`${dir}/${entry.name}`] : []);
}
test('T-E01-traceability @E01 every active epic AC has a matching test tag', () => {
  const status: Record<string, string> = JSON.parse(readFileSync('specs/status.json', 'utf8'));
  const tests = sourceFiles('tests').map((file) => readFileSync(file, 'utf8')).join('\n');
  for (const file of readdirSync('specs').filter((file) => /^epic-\d+.*\.md$/.test(file))) {
    const text = readFileSync(`specs/${file}`, 'utf8');
    const ids = [...text.matchAll(/^\| (E\d{2}-AC\d+) \|/gm)].map((match) => match[1]);
    for (const id of ids) if (status[id.slice(0, 3)] !== 'todo') expect(tests, id).toContain(`@${id}`);
  }
});

test('T-E01-11 @E01 @E01-AC11 verify selects only exact E01 tags plus smoke across runners', () => {
  const { epics, pattern } = selectionFor('E01');
  expect(epics).toEqual(['E01']);
  const regex = new RegExp(pattern);
  for (const title of ['T-E01 @E01', 'T-E01-01 @E01-AC01', 'S-01 @smoke', 'T-E01-03 @E01-AC03 other']) expect(regex.test(title)).toBe(true);
  for (const title of ['T-E02-01 @E02 @E02-AC01', '@E010', '@E01-AC01extra', '@smokescreen']) expect(regex.test(title)).toBe(false);
  expect(selectionFor('M0').epics).toEqual(['E01', 'E02', 'E03', 'E17']);
  expect(() => selectionFor('E99')).toThrow('Unknown epic');
  expect(() => selectionFor('garbage')).toThrow('Usage');
  const verify = readFileSync('tools/verify.ts', 'utf8');
  expect(verify).toContain("'vitest', 'run', '-t', selection.pattern");
  expect(verify).toContain("'playwright', 'test', '--grep', selection.pattern");
});
