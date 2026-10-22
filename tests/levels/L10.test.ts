import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { runLevel } from '../../tools/sim-runner/levels';

test('T-E32-04-complete @E32-AC04 one seed completes the full L10 route with ordinary inputs and regional timing', async () => {
  const report = await runLevel('L10', 'complete', 32);
  mkdirSync('test-results/epics/E32/Q3', { recursive: true });
  writeFileSync('test-results/epics/E32/Q3/complete-seed-32.json', JSON.stringify(report, null, 2) + '\n');
  expect(report.completed, JSON.stringify(report)).toBe(true);
  expect(report.deaths).toBe(0);
  expect(report.regions).toHaveLength(7);
  expect(report.regions!.every(r => r.seconds > 0)).toBe(true);
  expect(report.regions!.reduce((n, r) => n + r.seconds, 0)).toBeCloseTo(report.time, 4);
  expect(report.regions!.reduce((n, r) => n + r.epilogueSeconds, 0)).toBeCloseTo(150, 4);
  for (const r of report.regions!) expect(r.travelSeconds + r.combatSeconds + r.interactionSeconds + r.holdSeconds + r.epilogueSeconds + r.otherSeconds).toBeCloseTo(r.seconds, 4);
  expect(report.maxConcurrentInfected).toBeLessThanOrEqual(200);
  expect(report.objectiveTimeline.map(e => e.id)).toEqual(['crash', 'residential-fringe', 'industrial-area', 'military-zone', 'research-campus', 'research', 'cure', 'research-exit', 'destroyed-corridor', 'dispersal-complex', 'install', 'hold', 'mega', 'release', 'epilogue', 'credits']);
}, 300_000);
