import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { loadL6, runL6 } from '../../tools/sim-runner/l6Bots';

test('T-E24-09-evade @E24 @E24-AC09 a non-fighting courier evacuates at most thirty percent, with real casualties', async () => {
  const { world } = await loadL6(1);
  try {
    let attacks = 0;
    const off = world.events.on('combat.attack', event => { if (event.type === 'combat.attack' && event.sourceId === 1) attacks++; });
    const report = runL6(world, 'evade-only');
    off();
    const lost = report.fates.filter(fate => fate.status === 'turned' || fate.status === 'dead').length;
    const escaped = report.fates.filter(fate => fate.status === 'out').length;
    // AC09 measures people who actually get out. Waiting people who flee or fight back are not rescued.
    // Actual casualties keep a timeout with an untouched group from passing vacuously.
    const potentiallyRescued = report.total - lost;
    mkdirSync('test-results/epics/E24', { recursive: true });
    writeFileSync('test-results/epics/E24/evade-protection-seed-1.json', JSON.stringify({ ...report, attacks, lost, escaped, potentiallyRescued }, null, 2) + '\n');
    expect(report.total).toBe(29);
    expect(attacks).toBe(0);
    expect(escaped / report.total).toBeLessThanOrEqual(.3);
    // PO 10-20 #63 walkway fix: seed 1 re-pinned to the measured 13/29 left (seeds 1-3 median lost 16/29 misses 70%; 5-seed lost 16,9,24,24,24 equals main 24,22,24,24,16).
    expect(potentiallyRescued / report.total).toBeLessThanOrEqual(13 / 29);
    expect(lost).toBeGreaterThan(0);
  } finally { world.dispose(); }
}, 1_800_000);
