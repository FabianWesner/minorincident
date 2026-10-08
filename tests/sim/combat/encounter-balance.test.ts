import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { encounter, type EncounterResult } from './encounter';

const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

// PO rule "fight a few, flee from many" (PO 10-08: "I killed a single zombie efficiently but already down to 84. That's
// too tough."): an efficient clicker standing its ground loses <= 5 HP (median) to one L1 runner, ~5-15 to two, ~15-30
// to three, and six kill a courier that does not retreat.
test('T-E05-encounter @E05 @E19 efficient clicker HP lost per encounter: 1 <= 5, 2 ~5-15, 3 ~15-30, 6 forces a retreat', async () => {
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
  writeFileSync('test-results/epics/E05/encounter-balance.json', JSON.stringify({ protocol: 'L1 runners from 7-11 m, efficient 7.5 Hz target clicks when in reach + 0.6 m, courier holds position, 20 seeds', table, rows }, null, 2) + '\n');
  console.log(JSON.stringify(table));
  for (const policy of ['hold', 'engage']) for (const weapon of ['weapon.bat', 'weapon.fists']) {
    const k = (n: number) => `${policy}:${weapon}x${n}`;
    expect(table[k(1)].median, `${policy} ${weapon} 1v1`).toBeLessThanOrEqual(5);
    expect(table[k(2)].median, `${policy} ${weapon} 1v2`).toBeLessThanOrEqual(15);
    expect(table[k(3)].median, `${policy} ${weapon} 1v3`).toBeGreaterThanOrEqual(10);
    expect(table[k(3)].median, `${policy} ${weapon} 1v3`).toBeLessThanOrEqual(35);
    expect(table[k(6)].died, `${policy} ${weapon} 1v6 standing`).toBeGreaterThanOrEqual(14);
  }
}, 600_000);
