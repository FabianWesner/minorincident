import { expect, test } from 'vitest';
import { INFECTED_TOUGHNESS, infectedDef, validateInfected, infectedSpecialMoves, type InfectedSpecialMove } from '../../../src/data/infected';
import { emptyInput } from '../../../src/input/InputFrame';
import { catalog } from '../../../src/data/actions/catalog';
import { damageAmount, type DamageEvent } from '../../../src/sim/combat/Damage';
import { allyState, updateAlly } from '../../../src/sim/outbreak/Allies';
import type { MissionDef } from '../../../src/sim/missions/types';
import { arena, spawn, step } from './helpers';

const shot = (targetId: number, actionId: string, base: number, type: DamageEvent['type'] = 'bullet'): DamageEvent => ({ sourceId: 1, targetId, attackId: 1, actionId, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base, multiplier: 1, type, knockback: 0, stagger: 0 });
const target = { id: 1, x: 0, z: 0 }, area = { x: 0, z: 0, radius: 4, dx: -1, dz: 0 };

test('T-E07-01-alpha @E07-AC01 Alpha has 300 effective HP and authored ordinary contact tuning', async () => {
  const w = await arena(), e = spawn(w, 'alpha', 6, 0, 'idle'), def = infectedDef(e.archetype);
  expect(def).toMatchObject({ hp: 200, speed: 3.8, radius: .55, windup: .5, range: 1.5, damage: 25, attackInterval: 1 });
  expect(e.health).toEqual({ current: def.hp * INFECTED_TOUGHNESS, max: 300 });
  expect(() => validateInfected([{ ...def, attackInterval: .1 }])).toThrow();
});
for (const [weapon, hits, type] of [['handgun', 30, 'bullet'], ['army-mg', 43, 'bullet'], ['shotgun', 3, 'bullet'], ['rocket-launcher', 2, 'explosive']] as const) {
  test(`T-E07-06-alpha-${weapon} @E07-AC06 resistance landed hits and permanence`, async () => {
    const w = await arena(), e = spawn(w, 'alpha', 6, 0, 'idle'), def = catalog[`weapon.${weapon}`];
    e.combat!.armor = .9; // Alpha's table replaces generic armor.
    const interval = 60 / def.fireRate!;
    for (let i = 0; i < hits; i++) {
      const hit = shot(e.id, def.id, def.damage, type); hit.attackId = i + 1;
      if (weapon === 'shotgun') {
        hit.base /= def.pellets!;
        for (let pellet = 0; pellet < def.pellets!; pellet++) w.combat!.damage.apply(hit);
      } else w.combat!.damage.apply(hit);
      expect(e.health.current > 0).toBe(i < hits - 1);
      if (i < hits - 1) w.tick += interval;
    }
    expect((hits - 1) / def.fireRate!).toBeCloseTo(weapon === 'handgun' ? 29 / 3 : weapon === 'army-mg' ? 4.2 : weapon === 'shotgun' ? 1 : 1.25);
    expect(e.infected!.recoverAt >= 0).toBe(type !== 'explosive');
    if (weapon === 'shotgun') expect(damageAmount(shot(e.id, def.id, def.damage * .1), e)).toBe(12);
    if (weapon === 'rocket-launcher') expect(damageAmount(shot(e.id, def.id, def.damage * .4, type), e)).toBe(72);
  });
}
test('T-E07-06-alpha-melee @E07-AC06 kick preserves Alpha HP and upright reaction; ordinary contact knocks a soldier down for 72 ticks', async () => {
  const w = await arena(), e = spawn(w, 'alpha', 6, 0, 'idle');
  w.combat!.damage.apply({ ...shot(e.id, 'weapon.kick', 20, 'melee'), knockdown: true, stagger: .5 });
  expect(e.health.current).toBe(280); expect(e.combat!.reaction!.heavy).toBe(false); expect(e.infected!.recoverAt).toBe(-1);
  const soldier = w.entities.get(w.npcs!.civilians.spawn('officer', { x: 6.8, z: 0 }))!;
  soldier.civilian!.ally = allyState('soldier');
  e.combat!.staggerUntil = 0; e.infected!.heardTargetId = soldier.id; e.infected!.state = 'chase';
  step(w, 1); const active = e.infected!.until;
  step(w, active - w.tick - 1); expect(soldier.health.current).toBe(100);
  step(w, 1); expect(soldier.health.current).toBe(75); expect(soldier.civilian!.knockedUntil - w.tick).toBe(72);
  const saved = { ...soldier.transform };
  expect(updateAlly(w, soldier, () => true)).toBe(true); expect(soldier.transform).toEqual(saved);
  expect(e.infected!.cooldown).toBe(active + 30);
  step(w, 60); expect(soldier.health.current).toBe(50);
});
for (const move of Object.keys(infectedSpecialMoves) as InfectedSpecialMove[]) {
  test(`T-E07-05-scheduler-${move} @E07-AC05 locked telegraph, independent cooldown, recovery and serialized state`, async () => {
    const w = await arena(), ai = w.infected!, e = spawn(w, 'alpha', 6, 0, 'idle'), timing = infectedSpecialMoves[move];
    // The scheduler also serves the later zoo lanes; no animal effects are claimed here.
    e.archetype = timing.archetype;
    const locked = { ...target }; expect(ai.startSpecial(e.id, move, locked, area)).toBe(true); locked.x = 90;
    expect(ai.startSpecial(e.id, move, target, area)).toBe(false); expect(ai.specialHit(e.id, 1)).toBe(false);
    const attack = e.infected!.specialAttack!, hp = w.entities.get(1)!.health.current;
    expect(attack.target.x).toBe(0); expect(attack.activeTick - attack.startTick).toBe(timing.windup);
    expect(w.events.events().find(ev => ev.type === 'telegraph')).toMatchObject({ sourceId: e.id, move, attackId: attack.attackId, startTick: 0, activeTick: timing.windup, cooldownExpiry: timing.windup + timing.cooldown, target, area });
    step(w, timing.windup - 1); expect(attack.stage).toBe('telegraph'); expect(w.entities.get(1)!.health.current).toBe(hp);
    // A paused sim runs no updates: snapshots do not consume timers.
    const paused = JSON.stringify(e.infected); ai.snapshot(); expect(JSON.stringify(e.infected)).toBe(paused);
    step(w, 1); expect(attack.stage).toBe('active'); expect(ai.specialHit(e.id, 1)).toBe(true); expect(ai.specialHit(e.id, 1)).toBe(false);
    expect(ai.finishSpecial(e.id)).toBe(true); expect(ai.finishSpecial(e.id)).toBe(false);
    step(w, 35); expect(ai.startSpecial(e.id, move, target, area)).toBe(false);
    const restored = JSON.parse(JSON.stringify(e.infected)); e.infected = restored;
    const expiry = restored.specialCooldowns[move]; w.tick += 100; ai.restoreSpecialTimers(restored, 100);
    expect(restored.specialCooldowns[move]).toBe(expiry + 100); expect(restored.specialAttack.hitIds).toEqual([1]);
    // Starting a windup exactly one windup before expiry yields the next activation at expiry.
    // Finish recovery without calling unrelated animal brains.
    ai.cancelSpecial(e.id);
    w.tick = restored.specialCooldowns[move] - timing.windup - 1;
    expect(ai.startSpecial(e.id, move, target, area)).toBe(false); w.tick++;
    expect(ai.startSpecial(e.id, move, target, area)).toBe(true); expect(restored.specialAttack!.attackId).toBeGreaterThan(attack.attackId);
    step(w, timing.windup); expect(restored.specialAttack!.activeTick - (attack.activeTick + 100)).toBe(timing.cooldown);
  });
}
for (const withNpcs of [false, true]) test(`T-E07-05-alpha-checkpoint-${withNpcs} @E07-AC05 checkpoint rebases pending specials and cooldowns`, async () => {
  const w = await arena();
  if (!withNpcs) { w.npcs = null; }
  const def: MissionDef = { id: 'alpha-checkpoint', briefing: 'Alpha scheduler', anchors: { spawn: { x: 0, z: 0, radius: 2 } }, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: ['C'], cinematics: {}, steps: [{ id: 'wait', type: 'custom', text: 'Wait', anchor: 'spawn', start: { kind: 'start' }, complete: { kind: 'timer', seconds: 1000 }, fail: [] }], finish: ['wait'], onStart: [], onComplete: [] };
  const m = w.loadMission(def); m.begin(); const e = spawn(w, 'alpha', 6, 0, 'idle');
  expect(w.infected!.startSpecial(e.id, 'alpha.roar', target, area)).toBe(true); step(w, 10); m.checkpoint('C');
  const before = e.infected!.specialAttack!.activeTick - w.tick; step(w, 20); m.restore('C');
  const restored = w.entities.get(e.id)!; expect(restored.infected!.specialAttack!.activeTick - w.tick).toBe(before);
  step(w, before); expect(restored.infected!.specialAttack!.stage).toBe('active'); expect(restored.infected!.specialCooldowns!['alpha.roar']! - w.tick).toBe(900);
});

test('T-E07-05-alpha-independent @E07-AC05 another move has its own cooldown and retargeting never resets the first', async () => {
  const w = await arena(), ai = w.infected!, e = spawn(w, 'alpha', 6, 0, 'idle');
  expect(ai.startSpecial(e.id, 'alpha.charge', target, area)).toBe(true); step(w, 48);
  const expiry = e.infected!.specialCooldowns!['alpha.charge'];
  expect(ai.finishSpecial(e.id)).toBe(true); step(w, 36);
  e.infected!.heardTargetId = 1;
  expect(ai.startSpecial(e.id, 'alpha.ground-slam', { ...target, x: 3 }, area)).toBe(true);
  expect(e.infected!.specialCooldowns!['alpha.charge']).toBe(expiry);
  const pending = e.infected!.specialAttack!; ai.cancelSpecial(e.id); step(w, 60);
  expect(e.infected!.specialCooldowns!['alpha.ground-slam']).toBeUndefined();
  expect(w.events.events().filter(ev => ev.type === 'infected.special' && ev.attackId === pending.attackId && ev.stage === 'active')).toHaveLength(0);
  expect(ai.specialHit(e.id, 1)).toBe(false);
});

for (const [weapon, hits, maxSpan] of [['handgun', 30, 9.7], ['army-mg', 43, 4.3], ['shotgun', 3, 1.1]] as const) test(`T-E07-06-alpha-live-${weapon} @E07-AC06 real sustained firing reaches the authored resistance fixture`, async () => {
  const w = await arena(), e = spawn(w, 'alpha', 1.2, 0, 'idle');
  w.combat!.setLoadout([`weapon.${weapon}`], ['weapon.fists']); w.combat!.damage.god = true;
  e.combat!.staggerUntil = 10000;
  const frame = emptyInput(); frame.aim = { x: 1, z: 0 }; frame.aimPoint = { x: 1.2, z: 0 }; frame.left.held = true;
  w.applyInput(frame, 'keyboard');
  for (let i = 0; i < 660 && e.health.current > 0; i++) w.update();
  const impacts = w.events.events().filter(ev => ev.type === 'combat.hit' && ev.targetId === e.id && ev.amount > 0);
  expect(e.health.current).toBe(0); expect(impacts).toHaveLength(hits);
  const span = (impacts.at(-1)!.tick - impacts[0].tick) / 60;
  expect(span).toBeGreaterThanOrEqual((hits - 1) / catalog[`weapon.${weapon}`].fireRate!);
  expect(span).toBeLessThanOrEqual(maxSpan);
});
