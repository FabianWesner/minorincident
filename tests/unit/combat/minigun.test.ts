import { expect, test } from 'vitest';
import { minigun } from '../../../src/data/minigun';
import { Minigun } from '../../../src/sim/combat/Minigun';

/** Runs `seconds` of fixed ticks with the trigger held (or not); returns the tick numbers (from 0) of the rounds. */
function hold(g: Minigun, seconds: number, trigger = true): number[] {
  const rounds: number[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) for (let r = g.step(trigger); r > 0; r--) rounds.push(i);
  return rounds;
}

/** Fires until the gun locks out (8 s of fire after the spin-up). */
function lock(g: Minigun): number { let t = 0; while (!g.locked && t < 60 * 12) { g.step(true); t++; } return t / 60; }

test('T-E32-18a spin-up comes before the first round, then 20 rounds/s', () => {
  const g = new Minigun(), rounds = hold(g, 2);
  expect(rounds[0]).toBeGreaterThanOrEqual(Math.ceil(minigun.fireSpin * minigun.spinUpS * 60) - 1);
  expect(rounds[0]).toBeLessThanOrEqual(30);
  // After the spin-up, exactly one round every third tick.
  expect(rounds.slice(1).every((t, i) => t - rounds[i] === 3)).toBe(true);
  const sustained = hold(new Minigun(), 3).filter(t => t >= 60);
  expect(sustained).toHaveLength(2 * 20);
  expect(g.spin).toBe(1);
});

test('T-E32-18b heat rises 12.5%/s and locks the gun at 100% after 8 s of fire', () => {
  const g = new Minigun();
  hold(g, 0.3); // still spinning up: no round, no heat
  expect(g.heat).toBe(0);
  hold(g, 0.1 + 4);
  expect(g.heat).toBeGreaterThan(.45); expect(g.heat).toBeLessThan(.55);
  expect(g.locked).toBe(false);
  hold(g, 4.2);
  expect(g.heat).toBe(1); expect(g.locked).toBe(true);
  expect(hold(g, 1)).toHaveLength(0); // locked: no rounds although the trigger is down
});

test('T-E32-18c cooling starts 0.5 s after the last round at 20%/s; unlock only below 40%', () => {
  const g = new Minigun();
  expect(lock(g)).toBeCloseTo(8.4, 1);
  hold(g, .45, false); expect(g.heat).toBe(1); // cooling delay
  hold(g, .1, false); expect(g.heat).toBeLessThan(1);
  hold(g, 1, false); // about 0.88 after 1.55 s idle: still locked
  expect(g.locked).toBe(true);
  // Holding the trigger on a locked gun does not delay cooling.
  hold(g, 2.4, true);
  expect(g.heat).toBeLessThan(.4 + 1e-6);
  expect(g.locked).toBe(false);
});

test('T-E32-18d tapping the trigger cannot shed heat inside the 0.5 s delay', () => {
  const g = new Minigun(); hold(g, 3); const heat = g.heat;
  for (let i = 0; i < 20; i++) { hold(g, .1, true); hold(g, .1, false); }
  expect(g.heat).toBeGreaterThanOrEqual(heat);
});

test('T-E32-18e snapshot keeps heat and lock, barrels start still after a reload', () => {
  const g = new Minigun(); lock(g);
  const copy = new Minigun(); copy.restore(JSON.parse(JSON.stringify(g.snapshot())));
  expect(copy.heat).toBe(1); expect(copy.locked).toBe(true); expect(copy.spin).toBe(0);
  const warm = new Minigun(); hold(warm, 3); const reload = new Minigun(); reload.restore(warm.snapshot());
  expect(reload.heat).toBeCloseTo(warm.heat, 6);
});
