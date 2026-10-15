import { expect, test } from 'vitest';
import { megaAlpha } from '../../../src/data/megaAlpha';
import type { DamageEvent } from '../../../src/sim/combat/Damage';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { fire } from '../combat/helpers';
import { arena, spawn, step } from './helpers';

async function setup(x = 0, playerX = 6) {
  const w = await arena();
  const player = w.entities.get(1)!;
  Object.assign(player.transform, { x: playerX, z: 0, y: .705 });
  w.physics.playerBody!.setTranslation(player.transform, true); w.player!.locomotion.reset(); w.spatial.set(1, playerX, 0);
  // Establish the observer first: admission must not move a boss spawned on her.
  const e = spawn(w, 'alpha', x, 0, 'idle');
  e.infected!.pursuit = true; e.infected!.variant = megaAlpha.asset;
  e.combat!.radius = megaAlpha.radius; e.health = { current: megaAlpha.hp, max: megaAlpha.hp };
  return { w, e, player };
}
const area = { x: 0, z: 0, radius: 1, dx: 1, dz: 0 };
function shot(e: EntitySnapshot, attackId: number, extra: Partial<DamageEvent> = {}): DamageEvent {
  return { sourceId: 1, targetId: e.id, attackId, actionId: 'weapon.rocket-launcher', origin: e.transform, direction: { x: 1, z: 0 }, base: 1000, multiplier: 5, type: 'explosive', knockback: 2, stagger: 2, direct: true, ...extra };
}

test('T-E32-12a @E32-AC12 nine direct rockets survive, tenth kills permanently, once per projectile', async () => {
  const { w, e } = await setup();
  for (let id = 1; id <= 9; id++) {
    expect(w.combat!.damage.apply(shot(e, id))).toBe(300);
    expect(w.combat!.damage.apply(shot(e, id))).toBe(0);
  }
  expect(e.health.current).toBe(300);
  w.combat!.damage.apply(shot(e, 10));
  expect(e.health.current).toBe(0); expect(e.infected!.recoverAt).toBe(-1);
});

test('T-E32-12b @E32-AC12 1000 MG/minigun rounds, melee, statuses and props never cross 90% floor or finish a wounded boss', async () => {
  const { w, e } = await setup();
  for (let i = 0; i < 1000; i++) w.combat!.damage.apply(shot(e, i, { actionId: i % 2 ? 'weapon.army-mg' : 'weapon.rotary-minigun', type: 'bullet' }));
  expect(e.health.current).toBe(2700);
  for (const type of ['melee', 'status', 'prop', 'vehicle', 'explosive'] as const) w.combat!.damage.apply(shot(e, 2000, { type, actionId: 'weapon.test', permanent: true }));
  expect(e.health.current).toBe(2700);
  for (let i = 1; i <= 8; i++) w.combat!.damage.apply(shot(e, i));
  expect(e.health.current).toBe(300);
  w.combat!.damage.apply(shot(e, 3000, { type: 'melee', actionId: 'weapon.fire-axe' })); expect(e.health.current).toBe(300);
  w.combat!.damage.apply(shot(e, 9)); expect(e.health.current).toBe(0);
});

test('T-E32-12c @E32-AC12 splash is 2.5% max and cannot also apply as direct damage', async () => {
  const { w, e } = await setup();
  expect(w.combat!.damage.apply(shot(e, 1, { direct: false }))).toBe(75);
  expect(w.combat!.damage.apply(shot(e, 1))).toBe(0);
  expect(e.health.current).toBe(2925);
});

test('T-E32-12d @E32-AC12 shared stagger cooldown survives floor hits and checkpoint timer rebasing; no heavy blast knockdown', async () => {
  const { w, e } = await setup();
  w.combat!.damage.apply(shot(e, 1)); expect(e.combat!.staggerUntil).toBe(w.tick + 30);
  expect(e.combat!.reaction?.heavy).toBe(false);
  w.tick += 20; w.combat!.damage.apply(shot(e, 2, { actionId: 'weapon.rotary-minigun', type: 'bullet' }));
  expect(e.combat!.staggerUntil).toBe(w.tick + 10);
  w.tick += 100; w.combat!.damage.apply(shot(e, 3, { actionId: 'weapon.fire-axe', type: 'melee' }));
  expect(e.combat!.staggerUntil).toBe(w.tick + 30);
  const ready = e.infected!.megaStaggerReady!;
  e.infected = structuredClone(e.infected); w.infected!.restoreSpecialTimers(e.infected!, 123);
  expect(e.infected!.megaStaggerReady).toBe(ready + 123);
  w.combat!.status.apply(e, { kind: 'stunned', duration: 10, dps: 0, slow: 0, maxStacks: 1 }, 1, 'ability.test');
  expect(e.combat!.statuses.some(s => s.kind === 'stunned')).toBe(false);
});

for (const move of Object.keys(megaAlpha.moves) as (keyof typeof megaAlpha.moves)[]) {
  test(`T-E32-11-${move} @E32-AC11 windup, damage, recovery, nonoverlap and activation cooldown`, async () => {
    const { w, e, player } = await setup(0, move === 'alpha.charge' ? 6 : 1.2), tune = megaAlpha.moves[move];
    expect(w.infected!.startSpecial(e.id, move, { id: 1, ...player.transform }, area)).toBe(true);
    const a = e.infected!.specialAttack!;
    expect(a.activeTick - a.startTick).toBe(tune.windup); expect(a.cooldownExpiry - a.activeTick).toBe(tune.cooldown);
    expect(w.infected!.startSpecial(e.id, 'alpha.charge', { id: 1, ...player.transform }, area)).toBe(false);
    step(w, tune.windup - 1); expect(player.health.current).toBe(100);
    step(w, 1); if (move === 'alpha.charge') step(w, 59);
    expect(player.health.current).toBe(100 - tune.damage);
    if (move === 'alpha.grab-throw') { expect(player.survivor!.knockdown!.until - w.tick).toBe(60); step(w, 60); expect(player.survivor!.knockdown).toBeUndefined(); }
    expect(a.stage).toBe('recovery'); expect(a.recoveryUntil - w.tick).toBe(72);
    if (move === 'alpha.charge') expect(e.transform.x).toBeCloseTo(megaAlpha.moves[move].speed);
    expect(w.events.events().filter(ev => ev.type === 'combat.hit' && ev.targetId === 1 && ev.attackId === a.attackId)).toHaveLength(1);
    e.infected!.state = 'idle'; step(w, 72);
    expect(w.infected!.startSpecial(e.id, move, { id: 1, ...player.transform }, area)).toBe(false);
  });
  test(`T-E32-11-dodge-${move} @E32-AC11 move only inside 12m, windup allows a safe dodge`, async () => {
    const { w, e, player } = await setup(0, 13);
    expect(w.infected!.startSpecial(e.id, move, { id: 1, ...player.transform }, area)).toBe(false);
    player.transform.x = move === 'alpha.charge' ? 6 : move === 'alpha.ground-slam' ? 3.5 : 1.8;
    w.physics.playerBody!.setTranslation(player.transform, true); w.player!.locomotion.reset(); w.spatial.set(1, player.transform.x, 0);
    expect(w.infected!.startSpecial(e.id, move, { id: 1, ...player.transform }, area)).toBe(true);
    w.setInput({ move: { x: 0, z: 1 } });
    step(w, 120); expect(player.health.current).toBe(100);
  });
}

for (const death of [false, true]) test(`T-E32-11-grab-release-${death} @E32-AC11 stagger/death always releases grab`, async () => {
  const { w, e, player } = await setup(0, 1.2);
  w.infected!.startSpecial(e.id, 'alpha.grab-throw', { id: 1, ...player.transform }, area); step(w, 48);
  expect(player.survivor!.knockdown).toBeDefined();
  if (death) e.health.current = 300;
  w.combat!.damage.apply(shot(e, 1));
  expect(e.infected!.specialAttack).toBeUndefined(); expect(player.survivor!.knockdown).toBeUndefined(); expect(player.combat!.staggerUntil).toBe(w.tick);
});

test('T-E32-11-walls @E32-AC11 oversized arm envelope stops charge and refuses specials near side/back cover', async () => {
  const { w, e, player } = await setup(0, 11);
  (w.combat!.query.walls as { x: number; z: number; y: number; halfX: number; halfY: number; halfZ: number }[]).push({ x: 7, z: 0, y: 2, halfX: .2, halfY: 2, halfZ: 5 });
  expect(w.infected!.startSpecial(e.id, 'alpha.charge', { id: 1, ...player.transform }, area)).toBe(true);
  step(w, 108); expect(e.transform.x).toBeLessThanOrEqual(7 - .2 - megaAlpha.specialClearance); expect(player.health.current).toBe(100);
  const second = spawn(w, 'alpha', 0, 8, 'idle'); second.infected!.pursuit = true;
  (w.combat!.query.walls as { x: number; z: number; y: number; halfX: number; halfY: number; halfZ: number }[]).push({ x: 0, z: 10, y: 2, halfX: 4, halfY: 2, halfZ: .2 });
  for (const move of Object.keys(megaAlpha.moves) as (keyof typeof megaAlpha.moves)[]) expect(w.infected!.startSpecial(second.id, move, { id: 1, x: 2, z: 8 }, area)).toBe(false);
});


test('T-E32-12-projectile @E32-AC12 real stock rocket ray contact attributes direct damage once through Explosions', async () => {
  const { w, e } = await setup(12, 0);
  // Keep the authored target stationary so this tests projectile contact, not boss steering.
  w.infected!.active.splice(w.infected!.active.indexOf(e), 1);
  w.combat!.setLoadout(['weapon.rocket-launcher'], ['weapon.fists']); w.combat!.assist.setting = 'Off'; w.combat!.damage.god = true;
  for (let i = 0; i < 10; i++) {
    fire(w); step(w, 120);
    expect(e.health.current).toBe(megaAlpha.hp - (i + 1) * 300);
  }
  expect(e.infected!.recoverAt).toBe(-1);
});

test('T-E32-12-pressure @E32-AC12 sustained minigun fire at the damage floor cannot extend a stagger or pin movement', async () => {
  const { w, e } = await setup(0, 20); e.infected!.state = 'chase'; e.health.current = 2700;
  const at = e.transform.x;
  const untils = new Set<number>();
  for (let tick = 0; tick < 180; tick++) {
    if (tick % 3 === 0) w.combat!.damage.apply(shot(e, tick + 1, { actionId: 'weapon.rotary-minigun', type: 'bullet', stagger: 5, knockback: 0 }));
    untils.add(e.combat!.staggerUntil); step(w, 1);
  }
  expect(e.health.current).toBe(2700); expect(untils.size).toBe(2);
  expect(e.transform.x - at).toBeGreaterThan(2);
});

test('T-E32-12-crowd-impact @E32-AC12 kicked infected cannot bypass the shared Mega stagger cooldown', async () => {
  const { w, e } = await setup(2, -6); e.health.current = 2700;
  const kicked = spawn(w, 'runner', 0, 0, 'idle');
  const kick = () => w.combat!.damage.apply({ ...shot(kicked, w.tick), actionId: 'weapon.kick', type: 'melee', base: 1, multiplier: 1, knockback: 2, knockdown: true, stagger: 1 });
  kick();
  expect(e.combat!.staggerUntil).toBe(w.tick + 30);
  expect(e.combat!.reaction?.heavy).toBe(false);
  const until = e.combat!.staggerUntil;
  w.tick += 10; kicked.transform.x = 0; kicked.transform.z = 0; kick();
  expect(e.combat!.staggerUntil).toBe(until);
  expect(e.health.current).toBe(2700);
});
