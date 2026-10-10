import { l1v2 } from '../../../src/data/l1v2';
import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { duel, type DuelResult } from './duel';
import { action } from '../../../src/data/actions/catalog';
import { comboDefinition, meleeMoves } from '../../../src/data/meleeCombos';
import { infectedDef, INFECTED_TOUGHNESS } from '../../../src/data/infected';

const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
const hp = infectedDef('infected.runner').hp * INFECTED_TOUGHNESS; // PO 10-10: infected HP x1.5 (40 → 60)
const summary = (rows: DuelResult[]) => ({ won: rows.filter(r => r.won).length, died: rows.filter(r => r.died).length, diedWithin20s: rows.filter(r => r.died && r.seconds <= 20).length, beatenWithin20s: rows.filter(r => r.seconds <= 20 && (r.died || r.hp <= 10)).length, hitsPerKill: rows.reduce((a, r) => a + r.hits, 0) / Math.max(1, rows.reduce((a, r) => a + r.kills, 0)), rows });

test('E19 @E19 @E19-AC14 unarmed never one-shots: every move 6 damage, 10 hits; bat 3 hits (PO 10-10)', () => {
  expect(hp).toBe(60); // PO 10-10: infected HP x1.5 (40 → 60)
  const fists = action('weapon.fists');
  meleeMoves['weapon.fists'].forEach((_, combo) => {
    const def = comboDefinition(fists, combo);
    expect(def.damage, `unarmed move ${combo}`).toBeGreaterThanOrEqual(l1v2.combat.unarmedDamage[0]); expect(def.damage).toBeLessThanOrEqual(l1v2.combat.unarmedDamage[1]);
    expect(def.damage).toBeLessThan(hp);
    expect(Math.ceil(hp / def.damage)).toBe(10); // PO 10-10: infected HP x1.5 (6–7 → 10 hits)
    // PO 00 §6.2 supersedes the original E19 shove: every unarmed beat is normal.
    expect(def.knockback).toBeLessThanOrEqual(.4); expect(def.stagger).toBeLessThanOrEqual(.25);
    expect(def.knockdown).not.toBe(true);
  });
  const bat = action('weapon.bat'), beats = meleeMoves['weapon.bat'].map((_, combo) => comboDefinition(bat, combo));
  expect(beats.map(b => b.damage)).toEqual([22, 22, 30]);
  for (const b of beats.slice(0, 2)) { expect(b.knockback).toBeLessThanOrEqual(.4); expect(b.stagger).toBeLessThanOrEqual(.25); expect(b.knockdown).not.toBe(true); }
  // PO 10-08 fight speed: the finisher still knocks down but keeps the body inside the bat's reach (was a 3.3 m fling).
  expect(beats[2].knockdown).toBe(true); expect(beats[2].knockback).toBeLessThanOrEqual(.5);
  expect(beats[0].damage + beats[1].damage).toBeLessThan(hp); expect(beats[0].damage + beats[1].damage + beats[2].damage).toBeGreaterThanOrEqual(hp); // PO 10-10: infected HP x1.5 (2 → 3 bat hits)
});

test('E19 @E19 @E19-AC14 duel battery: newbie beats 1 (≥19/20) and 2 (≥14/20) unarmed (10 hits); standing vs 5 beaten within 20 s (≥18/20, dead ≥15/20); bat kills in 3 (PO 10-10)', async () => {
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
  // AC14 (criterion fix 2026-10-07): beaten = dead, or a pyrrhic win at <= 10 HP; still dead on >= 15/20.
  expect(report.standFive.beatenWithin20s).toBeGreaterThanOrEqual(18);
  expect(report.standFive.diedWithin20s).toBeGreaterThanOrEqual(15);
  expect(report.oneUnarmed.hitsPerKill).toBe(10); // PO 10-10: infected HP x1.5 (6–7 → 10 hits)
  for (const row of bat) if (row.kills) expect(row.hits / row.kills).toBe(3); // PO 10-10: infected HP x1.5 (2 → 3 bat hits)
}, 300_000);
