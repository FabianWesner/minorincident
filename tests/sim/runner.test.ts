import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('T-E01-08 @E01 @E01-AC08 npm sim writes a headless JSON report', () => {
  const output = execFileSync('npm', ['run', 'sim', '--', '--scenario', 'empty', '--ticks', '600', '--seed', '1'], { encoding: 'utf8' });
  const summary = JSON.parse(output.trim().split('\n').at(-1)!);
  const report = JSON.parse(readFileSync(summary.output, 'utf8'));
  expect(report).toMatchObject({ outcome: 'tick-budget', ticks: 600, seed: 1 });
  expect(report.stateHash).toMatch(/^[0-9a-f]{8}$/);
  expect(report.simMsP95).toBeGreaterThanOrEqual(0);
});
