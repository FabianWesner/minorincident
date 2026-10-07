import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { arena, equip } from './helpers';
import { emptyInput } from '../../../src/input/InputFrame';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

/** Tap the same live target at 5 Hz; releases have no held attack fallback. */
async function clickDuel(weapon: string, clicks = Infinity, brain = false) {
  const w = await arena(); if (brain) w.loadScenario('horde-arena', 1); equip(w, [weapon]);
  const id = brain ? w.infected!.spawn('infected.runner', { x: 1.2, z: 0 }, { state: 'chase' })
    : w.spawnDummy('infected.runner', { x: 1.2, z: 0 }, { hp: 40 });
  const target = w.entities.get(id)!, hits: number[] = [], distances: number[] = [];
  w.events.on('combat.hit', e => {
    if (e.type !== 'combat.hit' || e.targetId !== id || e.amount <= 0) return;
    hits.push(e.tick);
    const p = w.entities.get(1)!.transform;
    if (target.health.current > 0) distances.push(Math.hypot(target.transform.x - p.x, target.transform.z - p.z));
  });
  let sentClicks = 0;
  for (let tick = 0; tick < Math.min(600, clicks * 12) && (Number.isFinite(clicks) || target.health.current > 0); tick++) {
    const frame = emptyInput(); frame.aimSource = 'pointer'; frame.pointerTarget = true;
    if (tick % 12 === 0 && tick / 12 < clicks) {
      sentClicks++; frame.mouseAttack = true; frame.left = { down: true, held: false, up: true }; frame.attackTarget = { id, side: 'LEFT' };
    }
    w.applyInput(frame, 'mouse-only'); w.update();
    if (target.health.current > 0 && target.combat!.reaction) {
      const reaction = target.combat!.reaction;
      expect(reaction.heavy).toBe(false);
      expect(reaction.until - reaction.started).toBeLessThanOrEqual(15);
      expect(Math.hypot(reaction.to.x - reaction.from.x, reaction.to.z - reaction.from.z)).toBeLessThanOrEqual(.4);
    }
  }
  const hitStops = w.events.events().filter(e => e.type === 'combat.hit-stop' && e.sourceId === 1);
  expect(hitStops).toHaveLength(hits.length);
  for (const stop of hitStops) if (stop.type === 'combat.hit-stop') { expect(stop.durationMs).toBeGreaterThanOrEqual(40); expect(stop.durationMs).toBeLessThanOrEqual(70); }
  return { weapon, sentClicks, ticks: w.tick, seconds: w.tick / 60, killed: target.health.current === 0, hits, distances };
}

test('@E05 @E05-AC14 @E06 @E06-AC10 click TTK measurement', async () => {
  const rows = [];
  for (const weapon of ['weapon.fists', 'weapon.bat']) rows.push(await clickDuel(weapon));
  mkdirSync('test-results/epics/E05', { recursive: true });
  writeFileSync('test-results/epics/E05/click-ttk.json', JSON.stringify({ protocol: '40 HP stationary common infected, 1.2m start, 5Hz released target clicks, auto approach, no upgrades', rows }, null, 2));
  expect(rows.every(r => r.killed)).toBe(true);
});

// Shared ground reaction fixture used by the downed target regression below.
function knockDown(w: SimWorld, id: number) {
  w.combat!.damage.apply({ attackId: 0, actionId: 'weapon.kick', sourceId: 1, targetId: id,
    origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 1, multiplier: 1,
    type: 'melee', knockback: 0, stagger: .4 });
}

for (const [weapon, count] of [['weapon.fists', 5], ['weapon.bat', 2]] as const) {
  test(`@E05 @E05-AC03 @E05-AC07 @E06 ten rapid released clicks keep ${weapon} in reach and kill`, async () => {
    const row = await clickDuel(weapon, 10, true);
    expect(row.sentClicks).toBe(10); expect(row.killed).toBe(true); expect(row.hits).toHaveLength(count);
    for (let i = 1; i < row.hits.length; i++) expect((row.hits[i] - row.hits[i - 1]) / 60).toBeLessThanOrEqual(.6);
    expect(Math.max(...row.distances)).toBeLessThanOrEqual(weapon === 'weapon.fists' ? 1.6 : 1.9);
  });
}

test('@E05 @E05-AC03 downed and rising infected take click damage and die before getting up', async () => {
  for (const age of [12, 48]) {
    const w = await arena(); equip(w, ['weapon.bat']);
    const id = w.spawnDummy('infected.runner', { x: 1, z: 0 }, { hp: 40 });
    knockDown(w, id); const target = w.entities.get(id)!, until = target.combat!.reaction!.until;
    for (let i = 0; i < age; i++) w.update();
    const tap = () => {
      const frame = emptyInput(); frame.attackTarget = { id, side: 'LEFT' }; frame.pointerTarget = true;
      frame.left = { down: true, held: false, up: true }; w.applyInput(frame, 'mouse-only'); w.update(); w.applyInput(emptyInput(), 'mouse-only');
    };
    tap(); for (let i = 0; i < 9; i++) w.update();
    expect(target.health.current).toBe(17); expect(target.combat!.reaction!.heavy).toBe(true);
    expect(target.combat!.reaction!.until).toBe(until);
    tap(); for (let i = 0; i < 24; i++) w.update();
    expect(target.health.current).toBe(0); expect(target.combat!.reaction!.groundDeath).toBe(true);
    const kill = w.events.events().find(e => e.type === 'combat.kill' && e.targetId === id)!;
    expect(kill.tick).toBeLessThan(until);
  }
});

test('@E05 recovery tap buffers for 200ms, fires at first allowed tick and expires', async () => {
  for (const [tapAt, expected] of [[10, 2], [2, 1]] as const) {
    const w = await arena(); equip(w, ['weapon.bat']);
    const frame = emptyInput(); frame.left = { down: true, held: false, up: true }; frame.aim = { x: 1, z: 0 };
    w.applyInput(frame, 'keyboard'); w.update(); w.clearInput();
    while (w.tick < tapAt) w.update();
    w.applyInput(frame, 'keyboard'); w.update(); w.clearInput();
    for (let i = 0; i < 30; i++) w.update();
    const attacks = w.events.events().filter(e => e.type === 'combat.attack');
    expect(attacks).toHaveLength(expected); if (expected === 2) expect(attacks[1].tick).toBe(21);
  }
});

test('@E05 @E05-AC07 ordinary high damage and upgrades cannot cause a knockdown', async () => {
  const w = await arena(), id = w.spawnDummy('infected.brute', { x: 1, z: 0 }, { hp: 300 });
  const target = w.entities.get(id)!;
  w.combat!.damage.apply({ attackId: 1, actionId: 'weapon.fire-axe', sourceId: 1, targetId: id,
    origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 65, multiplier: 2,
    type: 'melee', knockback: 2, stagger: .5 });
  expect(target.health.current).toBe(170); expect(target.transform.x).toBeCloseTo(1.4);
  expect(target.combat!.reaction!.heavy).toBe(false); expect(target.combat!.staggerUntil).toBe(15);
});

test('@E05 released mouse target clicks on the kick side keep using the normal unarmed chain', async () => {
  const w = await arena(); equip(w, ['weapon.fists'], ['weapon.kick']);
  w.combat!.runner.loadout.state.selectedSide = 'RIGHT';
  const id = w.spawnDummy('infected.runner', { x: 1.7, z: 0 }, { hp: 40 }), target = w.entities.get(id)!;
  for (let tick = 0; tick < 180 && target.health.current > 0; tick++) {
    const frame = emptyInput(); frame.pointerTarget = true;
    if (tick % 12 === 0) { frame.mouseAttack = true; frame.attackTarget = { id, side: 'LEFT' }; frame.left = { down: true, held: false, up: true }; }
    w.applyInput(frame, 'mouse-only'); w.update();
    if (target.health.current > 0) expect(target.combat!.reaction?.heavy).not.toBe(true);
  }
  expect(target.health.current).toBe(0);
  const attacks = w.events.events().filter(e => e.type === 'combat.attack');
  expect(attacks.length).toBeGreaterThanOrEqual(5);
  for (const attack of attacks) expect(attack).toMatchObject({ actionId: 'weapon.fists', side: 'RIGHT' });
});
