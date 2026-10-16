import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { preset } from '../../../src/sim/progression/Campaign';
import { l7DefaultArsenal } from '../../../src/data/l7';
import { runnerLevels } from '../../../tools/sim-runner/levels';

test('T-E29-02-preset @E29-AC02 L7-default retains the five prior weapons and leaves the rocket to its pickup', () => {
  const save = preset('L7-default');
  expect(save.completedLevels).toBe(6); expect(save.unlockedLevel).toBe(7);
  expect(save.racks).toEqual(l7DefaultArsenal);
  expect(save.ownedActions).toEqual(expect.arrayContaining([...l7DefaultArsenal.LEFT, ...l7DefaultArsenal.RIGHT]));
  expect(save.ownedActions).not.toContain('weapon.rocket-launcher');
});

test('T-E29-02-cli @E29-AC02 explicit and all-level CLI registration include L7 in campaign order', () => {
  expect(runnerLevels).toEqual(Array.from({ length: 10 }, (_, i) => `L${i + 1}`));
  const out = 'test-results/spec-audit-c/l7-cli.json';
  execFileSync(process.execPath, ['--import', 'tsx', 'tools/sim-runner/index.ts', '--level', 'L7', '--ticks', '0', '--out', out], { stdio: 'pipe' });
  const result = JSON.parse(readFileSync(out, 'utf8'));
  expect(result.runs).toBe(1); expect(result.reports[0].level).toBe('L7');
  expect(result.reports[0].time).toBe(0);
});
