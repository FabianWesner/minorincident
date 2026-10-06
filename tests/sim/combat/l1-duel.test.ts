import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { duel, type DuelResult } from './duel';
import { action } from '../../../src/data/actions/catalog';
import { comboDefinition, meleeMoves } from '../../../src/data/meleeCombos';
import { infectedDef } from '../../../src/data/infected';

const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
const hp = infectedDef('infected.runner').hp;
const summary = (rows: DuelResult[]) => ({ won: rows.filter(r => r.won).length, died: rows.filter(r => r.died).length, diedWithin20s: rows.filter(r => r.died && r.seconds <= 20).length, hitsPerKill: rows.reduce((a, r) => a + r.hits, 0) / Math.max(1, rows.reduce((a, r) => a + r.kills, 0)), rows });

test('E19 @E19 @E19-AC14 unarmed never one-shots: every move 9–11 damage, 4–5 hits; bat 2 hits', () => {
  expect(hp).toBe(40);
  const fists = action('weapon.fists');
  meleeMoves['weapon.fists'].forEach((_, combo) => {
    const def = comboDefinition(fists, combo);
    expect(def.damage, `unarmed move ${combo}`).toBeGreaterThanOrEqual(9); expect(def.damage).toBeLessThanOrEqual(11);
    expect(def.damage).toBeLessThan(hp);
    expect(Math.ceil(hp / def.damage)).toBeGreaterThanOrEqual(4); expect(Math.ceil(hp / def.damage)).toBeLessThanOrEqual(5);
    // Kicks shove 1.5–2.5 m with a 0.4 s stagger; punches only flinch.
    if (/kick/.test(meleeMoves['weapon.fists'][combo].name)) { expect(def.knockback).toBeGreaterThanOrEqual(1.5); expect(def.knockback).toBeLessThanOrEqual(2.5); expect(def.stagger).toBeCloseTo(.4); }
  });
  const bat = action('weapon.bat'), beats = meleeMoves['weapon.bat'].map((_, combo) => comboDefinition(bat, combo));
  expect(beats.map(b => b.damage)).toEqual([22, 22, 30]);
  for (const b of beats) { expect(b.knockback).toBeGreaterThanOrEqual(2.5); expect(b.knockback).toBeLessThanOrEqual(3.5); }
  expect(beats[0].damage + beats[1].damage).toBeGreaterThanOrEqual(hp); expect(beats[0].damage).toBeLessThan(hp);
});

test('E19 @E19 @E19-AC14 duel battery: newbie beats 1 (≥19/20) and 2 (≥14/20) unarmed; standing vs 5 dies within 20 s (≥18/20); bat kills in 2', async () => {
  const one: DuelResult[] = [], two: DuelResult[] = [], five: DuelResult[] = [], bat: DuelResult[] = [];
  for (const seed of seeds) {
    one.push(await duel(seed, 1, 'newbie')); two.push(await duel(seed, 2, 'newbie'));
    five.push(await duel(seed, 5, 'stand', 'weapon.fists', 'infected.runner', 25)); bat.push(await duel(seed, 1, 'newbie', 'weapon.bat'));
  }
  const report = { oneUnarmed: summary(one), twoUnarmed: summary(two), standFive: summary(five), oneBat: summary(bat) };
  mkdirSync('test-results/epics/E19', { recursive: true });
  writeFileSync('test-results/epics/E19/ac14-duels.json', JSON.stringify(report, (key, value) => key === 'rows' ? value.map((r: DuelResult) => [r.seed, r.won ? 'W' : r.died ? 'D' : '-', +r.seconds.toFixed(2), r.hp, r.hits, r.kills].join(' ')) : value, 2));
  expect(report.oneUnarmed.won).toBeGreaterThanOrEqual(19);
  expect(report.twoUnarmed.won).toBeGreaterThanOrEqual(14);
  expect(report.standFive.diedWithin20s).toBeGreaterThanOrEqual(18);
  expect(report.oneUnarmed.hitsPerKill).toBeGreaterThanOrEqual(4); expect(report.oneUnarmed.hitsPerKill).toBeLessThanOrEqual(5);
  for (const row of bat) if (row.kills) expect(row.hits / row.kills).toBe(2);
}, 300_000);
