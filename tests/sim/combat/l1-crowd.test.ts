import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { duel, type DuelResult } from './duel';

/** PO 2026-10-07: "the user can fight a few zombies but not all at once. So running away and using the area is part of
 * the game." With the bat (roundhouse included): standing vs 4 wins, standing vs 10 loses within 30 s, and a policy that
 * retreats from the pack and picks off the followers survives the same 10 for >= 60 s. */
const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
const row = (r: DuelResult) => [r.seed, r.won ? 'W' : r.died ? 'D' : '-', +r.seconds.toFixed(2), r.hp, r.hits, r.kills].join(' ');

test('E19 @E19 @E19-AC14 bat crowd battery: stand vs 4 wins (>= 18/20); stand vs 10 dies within 30 s (>= 18/20); evade vs 10 survives 60 s (>= 16/20)', async () => {
  const four: DuelResult[] = [], ten: DuelResult[] = [], evade: DuelResult[] = [];
  for (const seed of seeds) {
    four.push(await duel(seed, 4, 'stand', 'weapon.bat', 'infected.runner', 40));
    ten.push(await duel(seed, 10, 'stand', 'weapon.bat', 'infected.runner', 30));
    evade.push(await duel(seed, 10, 'evade', 'weapon.bat', 'infected.runner', 60));
  }
  const report = {
    standFour: { won: four.filter(r => r.won).length, rows: four.map(row) },
    standTen: { diedWithin30s: ten.filter(r => r.died && r.seconds <= 30).length, rows: ten.map(row) },
    evadeTen: { survived60s: evade.filter(r => !r.died).length, rows: evade.map(row) },
  };
  mkdirSync('test-results/epics/E19', { recursive: true });
  writeFileSync('test-results/epics/E19/crowd-duels.json', JSON.stringify(report, null, 2));
  expect(report.standFour.won).toBeGreaterThanOrEqual(18);
  expect(report.standTen.diedWithin30s).toBeGreaterThanOrEqual(18);
  expect(report.evadeTen.survived60s).toBeGreaterThanOrEqual(16);
}, 600_000);
