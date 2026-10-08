import { expect, test } from 'vitest';
import { catalog } from '../../../src/data/actions/catalog';
import type { GameEvent } from '../../../src/sim/world/types';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { arena, equip, fire, health, step } from './helpers';

/** PO 2026-10-07 (00 §6.2): bat roundhouse when surrounded; the L2 fire axe shares the mechanism (E20 §5.3). */
const ring = (w: SimWorld, count: number, radius: number, hp = 100, from = 0) => Array.from({ length: count }, (_, i) => {
  const a = from + i * Math.PI * 2 / count;
  return w.spawnDummy('infected.dummy', { x: Math.cos(a) * radius, z: Math.sin(a) * radius }, { hp });
});
const attacks = (w: SimWorld) => w.events.events().filter((e): e is Extract<GameEvent, { type: 'combat.attack' }> => e.type === 'combat.attack' && e.sourceId === 1);
const hits = (w: SimWorld, attackId: number) => w.events.events().filter((e): e is Extract<GameEvent, { type: 'combat.hit' | 'combat.kill' }> => e.type === 'combat.hit' && e.attackId === attackId && e.amount > 0);

test('T-E05-roundhouse @E05 @E06 bat: >= 3 infected within reach turn the click into a 360° roundhouse that strikes the nearest 3 all around', async () => {
  const sweep = catalog['weapon.bat'].roundhouse!;
  for (const count of [3, 5]) {
    const w = await arena(); equip(w, ['weapon.bat']);
    // Spread all around the courier, including straight behind: a frontal swing could reach at most one of them.
    // With 5, two stand a little further out: the sweep connects with the nearest `maxTargets` (PO: fight a few, not all).
    const ids = Array.from({ length: count }, (_, i) => {
      const a = i * Math.PI * 2 / count, r = i < 3 ? 1.3 : 1.9;
      return w.spawnDummy('infected.dummy', { x: Math.cos(a) * r, z: Math.sin(a) * r }, { hp: 100 });
    });
    const struckIds = ids.slice(0, sweep.maxTargets);
    const before = ids.map(id => ({ ...w.entities.get(id)!.transform }));
    fire(w); step(w, 40);
    const [attack] = attacks(w);
    expect(attack.style).toBe('roundhouse');
    const struck = hits(w, attack.attackId);
    expect(new Set(struck.map(e => e.targetId))).toEqual(new Set(struckIds));
    for (const id of ids) expect(health(w, id)).toBe(struckIds.includes(id) ? 100 - sweep.damage : 100);
    // Struck one by one as the bat passes (several ticks), each with its own hit-stop beat and impact.
    expect(new Set(struck.map(e => e.tick)).size).toBeGreaterThan(1);
    expect(w.events.events().filter(e => e.type === 'combat.hit-stop').length).toBe(struckIds.length);
    // The shove creates space but stays modest (<= 0.8 m) and never knocks down.
    struckIds.forEach((id, i) => {
      const t = w.entities.get(id)!.transform, moved = Math.hypot(t.x - before[i].x, t.z - before[i].z);
      expect(moved).toBeGreaterThan(.3); expect(moved).toBeLessThanOrEqual(.8 + 1e-6);
      expect(w.entities.get(id)!.combat!.reaction?.heavy ?? false).toBe(false);
    });
    // The courier itself never moves for an attack click.
    const p = w.entities.get(1)!.transform; expect(Math.hypot(p.x, p.z)).toBeLessThan(.05);
  }
});

test('T-E05-roundhouse-few @E05 bat: with 1 or 2 infected in reach (or a third just outside it) the click stays the normal frontal swing', async () => {
  for (const layout of [[[1.4, 0]], [[1.4, 0], [1.2, .6]], [[1.4, 0], [1.2, .6], [-2.4, 0]]]) {
    const w = await arena(); equip(w, ['weapon.bat']);
    const ids = layout.map(([x, z]) => w.spawnDummy('infected.dummy', { x, z }, { hp: 100 }));
    fire(w); step(w, 30);
    const [attack] = attacks(w);
    expect(attack.style).toBeUndefined();
    expect(hits(w, attack.attackId).map(e => e.targetId).sort()).toEqual(ids.slice(0, Math.min(2, ids.length)).sort());
  }
});

test('T-E05-roundhouse-rate @E05 bat: chained clicks repeat the roundhouse, but its recovery caps it at <= 1.25 per second', async () => {
  const w = await arena(); equip(w, ['weapon.bat']);
  const ids = ring(w, 4, 1.3, 100000), home = ids.map(id => ({ ...w.entities.get(id)!.transform }));
  // A click every 4 ticks (15 Hz) for 6 s; dummies are put back so the crowd stays in reach.
  for (let tick = 0; tick < 360; tick++) {
    ids.forEach((id, i) => { const e = w.entities.get(id)!; Object.assign(e.transform, home[i]); w.spatial.set(id, home[i].x, home[i].z); });
    if (tick % 4 === 0) fire(w); else step(w, 1);
  }
  const sweeps = attacks(w).filter(e => e.style === 'roundhouse');
  expect(sweeps.length).toBeGreaterThanOrEqual(3);
  // Sustained rate (between the first and last sweep) and every gap respect the 0.8 s lockout.
  expect((sweeps.length - 1) / ((sweeps.at(-1)!.tick - sweeps[0].tick) / 60)).toBeLessThanOrEqual(1.25 + 1e-9);
  for (let i = 1; i < sweeps.length; i++) expect(sweeps[i].tick - sweeps[i - 1].tick).toBeGreaterThanOrEqual(48);
});

test('T-E20-roundhouse-axe @E20 @E20-AC10 fire axe: the shared sweep with E20 values (>= 3 within 2.5 m, 25 each, >= 2 m push, 0.8 s stagger, 1.0 s)', async () => {
  const axe = catalog['weapon.fire-axe'].roundhouse!, bat = catalog['weapon.bat'].roundhouse!;
  expect(axe).toMatchObject({ threshold: 3, radius: 2.5, damage: 25, stagger: .8 });
  expect(axe.knockback).toBeGreaterThanOrEqual(2); expect(axe.knockback).toBeLessThanOrEqual(3);
  expect(axe.windup + axe.active + axe.recovery).toBeCloseTo(1, 5);
  expect(bat).toMatchObject({ threshold: 3, radius: 2.2 }); expect(bat.damage).toBeGreaterThan(0); expect(bat.damage).toBeLessThanOrEqual(catalog['weapon.bat'].damage);
  expect(bat.knockback).toBeLessThanOrEqual(.8);
  expect(axe.damage).toBeGreaterThan(bat.damage); expect(axe.radius).toBeGreaterThan(bat.radius); expect(axe.knockback).toBeGreaterThan(bat.knockback);
  const w = await arena(); equip(w, ['weapon.fire-axe']);
  const ids = ring(w, 3, 2.3, 100, .4);
  fire(w); step(w, 70);
  const [attack] = attacks(w);
  expect(attack.style).toBe('roundhouse');
  for (const id of ids) {
    expect(health(w, id)).toBe(75);
    const t = w.entities.get(id)!.transform; expect(Math.hypot(t.x, t.z) - 2.3).toBeGreaterThanOrEqual(2 - .05);
  }
});
