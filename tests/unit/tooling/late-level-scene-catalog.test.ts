import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { infectedSpecialMoves } from '../../../src/data/infected';
import { readSpec } from '../../../tools/scenelab/session';

test('late-level matrix includes all ten inherited zoo moves and Alpha/rocket fixtures', () => {
  const moves = Object.keys(infectedSpecialMoves).filter(move => !move.startsWith('alpha.'));
  expect(moves).toHaveLength(10);
  for (const name of [...moves.map(move => move.replace('.', '-')), 'alpha-roar', 'rocket-alpha']) {
    const path = `tests/scenes/catalog/qa-late-${name}.json`;
    const alias = JSON.parse(readFileSync(path, 'utf8'));
    expect(Object.keys(alias).sort()).toEqual(['extends', 'name', 'note']);
    const spec = readSpec(path);
    expect(spec.camera?.mode, name).toBe('game');
    expect(spec.expect?.consoleErrors, name).toBe(0);
    expect(spec.script?.length, name).toBeGreaterThan(0);
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  expect(pkg.scripts['scene:matrix']).toContain('qa-late-*');
});
