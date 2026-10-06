import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { arena, dummy, equip, step } from './helpers';
import { balanceActions as actions } from '../../../src/data/actions/catalog';
import { combatArchetypes, ttkBands } from '../../../src/data/balance';
import { emptyInput } from '../../../src/input/InputFrame';
import { stateHash } from '../../../src/sim/world/stateHash';

test('T-E05-14 T-E06-10 @E05 @E05-AC14 @E06 @E06-AC10 measure every reference weapon × archetype TTK in authored bands', async () => {
  const rows = [];
  for (const weapon of Object.values(actions)) for (const [name, archetype] of Object.entries(combatArchetypes)) {
    const w = await arena(); equip(w, [weapon.id]); w.combat!.damage.god = true;
    const id = w.spawnDummy(`infected.${name}`, { x: 1.2, z: 0 }, { ...archetype, yaw: 0 }), target = w.entities.get(id)!;
    const frame = emptyInput(); frame.aim = { x: 1, z: 0 }; frame.aimPoint = { x: 1.2, z: 0 }; frame.left.held = true;
    for (let tick = 0; tick < 9000 && target.health.current > 0; tick++) {
      const player = w.entities.get(1)!, dx = target.transform.x - player.transform.x, dz = target.transform.z - player.transform.z, distance = Math.hypot(dx, dz);
      frame.aim!.x = distance ? dx / distance : 1; frame.aim!.z = distance ? dz / distance : 0;
      frame.aimPoint!.x = target.transform.x; frame.aimPoint!.z = target.transform.z;
      frame.move.x = distance > 1.3 ? frame.aim!.x : 0; frame.move.z = distance > 1.3 ? frame.aim!.z : 0;
      frame.left.down = (weapon.category === 'throwable' && w.combat!.projectiles.length === 0) || weapon.category === 'ability';
      w.applyInput(frame, 'keyboard'); w.update();
    }
    const seconds = w.tick / 60, band = ttkBands[weapon.id][name as keyof typeof combatArchetypes];
    rows.push({ weapon: weapon.id, archetype: name, ticks: w.tick, seconds, band, killed: target.health.current === 0 });
    w.dispose();
  }
  mkdirSync('test-results/balance', { recursive: true }); writeFileSync('test-results/balance/ttk.json', JSON.stringify({ protocol: 'Rear shield exposure, no upgrades, 1.2m initial range, chase knockback, serial aimed grenades, default assist', rows }, null, 2));
  expect(rows).toHaveLength(Object.keys(actions).length * Object.keys(combatArchetypes).length);
  for (const row of rows) { expect(row.killed, `${row.weapon} × ${row.archetype}`).toBe(true); expect(row.seconds, JSON.stringify(row)).toBeGreaterThanOrEqual(row.band[0]); expect(row.seconds, JSON.stringify(row)).toBeLessThanOrEqual(row.band[1]); }
});

test('S-05-combat @E05 @smoke 1800 combat ticks match a pinned golden gameplay hash', async () => {
  const hashes = [];
  for (let run = 0; run < 2; run++) {
    const w = await arena(); equip(w, ['weapon.pistol', 'weapon.bat']); dummy(w, 5, 0, 10000);
    for (let tick = 0; tick < 1800; tick++) {
      const frame = emptyInput(); frame.aim = { x: Math.cos(tick / 180), z: Math.sin(tick / 180) }; frame.left.held = tick % 120 < 60; frame.right.down = tick % 240 === 0; frame.selector = tick % 300 === 0 ? 1 : 0;
      w.applyInput(frame, 'keyboard'); w.update();
    }
    hashes.push(stateHash(w.getState()));
  }
  expect(hashes[0]).toBe(hashes[1]); // Combo chains and reaction intent are now serialized; pin the new deterministic state.
  // Stage1 serializes bounded motion state and uses stable capsule support clearance.
  expect(hashes[0]).toBe('94887072'); // + E19 §5.6 combat numbers (lane G)
});

test('T-E05-perf @E05 @perf 200 combat dummies and sustained fire below 4ms sim p95', async () => {
  const w = await arena(); equip(w, ['weapon.machine-gun']);
  for (let i = 0; i < 200; i++) dummy(w, 2 + i % 10, Math.floor(i / 10) - 10, 100000);
  w.setInput({ aim: { x: 1, z: 0 }, left: { held: true, down: false, up: false } }); step(w, 120);
  const times = [];
  for (let i = 0; i < 3600; i++) { const start = performance.now(); w.update(); times.push(performance.now() - start); }
  times.sort((a, b) => a - b); const data = { ticks: 3600, dummies: 200, simMsP95: times[Math.floor(times.length * 0.95)], budgetMs: 4 };
  mkdirSync('test-results/epics/E05', { recursive: true }); writeFileSync('test-results/epics/E05/sim-perf.json', JSON.stringify(data, null, 2));
  expect(data.simMsP95).toBeLessThan(data.budgetMs);
});
