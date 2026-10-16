import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { runLevel } from '../../tools/sim-runner/levels';

test('T-E29-02 @E29-AC02 standalone seed 1 boards at least 60% of the starting group without cheats', async () => {
  let starting = 0, boarded = 0;
  const report = await runLevel('L7', 'complete', 1, 1200, 'auto', undefined, (world, result) => {
    starting = world.l7Encounters!.state.roster.length;
    boarded = result.rescued;
    expect(world.combat!.damage.god).toBe(false);
    expect(world.entities.get(1)!.health.current).toBeGreaterThan(0);
  });
  mkdirSync('test-results/spec-audit-c', { recursive: true });
  writeFileSync('test-results/spec-audit-c/l7-standalone.json', JSON.stringify({ ...report, starting, boarded }, null, 2) + '\n');
  expect(report.completed, JSON.stringify(report)).toBe(true);
  expect(starting).toBe(24);
  expect(boarded).toBeGreaterThanOrEqual(Math.ceil(starting * .6));
  expect(report.deaths).toBe(0);
}, 300_000);
