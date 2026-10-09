import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { encounter, type EncounterResult } from './encounter';

const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

// PO rule "fight a few, flee from many" (PO 10-08: "I killed a single zombie efficiently but already down to 84. That's
// too tough."): an efficient clicker standing its ground loses <= 5 HP (median) to one L1 runner, ~5-15 to two, ~15-30
// to three, and six kill a courier that does not retreat.
test('T-E05-encounter @E05 @E19 efficient clicker HP lost per encounter: one infected <= 5 HP (bat and unarmed), two/three with the bat <= 15/30', async () => {
  const rows: EncounterResult[] = [];
  const table: Record<string, { median: number; p80: number; died: number; seeds: number }> = {};
  for (const policy of ['hold', 'engage', 'misses'] as const) for (const weapon of ['weapon.bat', 'weapon.fists']) for (const count of [1, 2, 3, 6]) {
    const batch: EncounterResult[] = [];
    for (let seed = 1; seed <= 20; seed++) batch.push(await encounter(seed, count, weapon, policy));
    rows.push(...batch);
    const lost = batch.map(r => r.lost).sort((a, b) => a - b);
    table[`${policy}:${weapon}x${count}`] = { median: median(lost), p80: lost[Math.floor(lost.length * .8)], died: batch.filter(r => r.died).length, seeds: batch.length };
  }
  mkdirSync('test-results/epics/E05', { recursive: true });
  writeFileSync('test-results/epics/E05/encounter-balance.json', JSON.stringify({ protocol: 'L1 runners from 7-11 m, hold = 7.5 Hz target clicks when in reach + 0.6 m (2.6 m on a wind-up), engage = clicks from 12 m (Diablo approach), misses = engage with head/chest clicks resolved as the old PROD pick; 20 seeds; 6+ fight the full 30 s', table, rows }, null, 2) + '\n');
  console.log(JSON.stringify(table));
  // Gated: the PO's case (one infected, bat or unarmed) and two with the bat. Reported only (PO decision pending, see
  // the lane report): unarmed vs 2-3 costs more than the 5-15 / 15-30 bands, and six do not kill a bat courier who stands.
  for (const policy of ['hold', 'engage']) for (const weapon of ['weapon.bat', 'weapon.fists']) {
    expect(table[`${policy}:${weapon}x1`].median, `${policy} ${weapon} 1v1`).toBeLessThanOrEqual(5);
    expect(table[`${policy}:${weapon}x1`].died).toBe(0);
  }
  for (const policy of ['hold', 'engage']) {
    expect(table[`${policy}:weapon.bat` + 'x2'].median, `${policy} bat 1v2`).toBeLessThanOrEqual(15);
    expect(table[`${policy}:weapon.bat` + 'x3'].median, `${policy} bat 1v3`).toBeLessThanOrEqual(30);
  }
  expect(table['engage:weapon.fists' + 'x2'].median, 'engage unarmed 1v2').toBeLessThanOrEqual(15);
  // The old PROD pick (head/chest clicks walked into the lunge) is what cost the PO 16 HP against one infected.
  expect(table['misses:weapon.fists' + 'x1'].median).toBeGreaterThan(table['engage:weapon.fists' + 'x1'].median);
}, 600_000);
