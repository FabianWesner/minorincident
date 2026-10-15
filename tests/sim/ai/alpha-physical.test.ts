import { expect, test } from 'vitest';
import { emptyInput } from '../../../src/input/InputFrame';
import { allyState } from '../../../src/sim/outbreak/Allies';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { arena, spawn, step } from './helpers';

function start(w: Awaited<ReturnType<typeof arena>>, e: EntitySnapshot, move: 'alpha.charge' | 'alpha.ground-slam', x = 12, z = 0) {
  expect(w.infected!.startSpecial(e.id, move, { id: 1, x, z }, { x: 999, z: 999, radius: 99, dx: 0, dz: 1 })).toBe(true);
  return e.infected!.specialAttack!;
}
function teleport(w: Awaited<ReturnType<typeof arena>>, x: number, z = 0) {
  const player = w.entities.get(1)!; Object.assign(player.transform, { x, z, y: .705 });
  w.physics.playerBody!.setTranslation(player.transform, true); w.player!.locomotion.reset(); w.spatial.set(1, x, z);
}

function human(w: Awaited<ReturnType<typeof arena>>, x: number, z: number, soldier = false) {
  const e = w.entities.get(w.npcs!.civilians.spawn('officer', { x, z }))!;
  if (soldier) e.civilian!.ally = allyState('soldier');
  e.civilian!.state = 'annoyed'; e.civilian!.until = 10000; // Stationary human probes, outside infection/grab states.
  return e;
}

test('T-E07-06-charge @E07-AC05 @E07-AC06 locked 9m/s, 12m sweep, once per human, windup and 72 tick knockdown', async () => {
  const w = await arena(), e = spawn(w, 'alpha', 0, 0, 'idle');
  const player = w.entities.get(1)!; teleport(w, 5);
  const inside = human(w, 3, 1), outside = human(w, 6, 1.001), soldier = human(w, 7, -.9, true);
  const a = start(w, e, 'alpha.charge');
  expect(a.area).toEqual({ x: 0, z: 0, radius: 1, dx: 1, dz: 0 });
  step(w, 47); expect(e.transform.x).toBe(0); expect(inside.health.current).toBe(100);
  step(w, 1); expect(e.transform.x).toBeCloseTo(.15);
  // Retargeting/target motion cannot bend the locked direction.
  teleport(w, 5, .5);
  step(w, 40); expect(player.health.current).toBe(70); expect(player.combat!.staggerUntil).toBeGreaterThan(w.tick);
  const frame = emptyInput(); frame.move = { x: 0, z: 1 }; w.applyInput(frame, 'keyboard');
  const saved = { ...player.transform }; step(w, 1); expect(player.transform.x).toBe(saved.x); expect(player.transform.z).toBe(saved.z);
  step(w, 38); expect(e.transform.x).toBeCloseTo(12); expect(e.transform.z).toBe(0); expect(e.transform.yaw).toBe(0);
  expect(a.stage).toBe('recovery'); expect(a.recoveryUntil - w.tick).toBe(36);
  expect(inside.health.current).toBe(70); expect(outside.health.current).toBe(100); expect(soldier.health.current).toBe(70);
  for (const target of [inside, soldier, player]) {
    const hits = w.events.events().filter(ev => ev.type === 'combat.hit' && ev.targetId === target.id && ev.attackId === a.attackId);
    expect(hits).toHaveLength(1);
    expect(target.civilian?.knockedUntil ?? target.combat!.staggerUntil).toBe(hits[0].tick + 72);
  }
});

test('T-E07-06-charge-wall @E07-AC06 intact solid wall stops body and shields humans across sweep', async () => {
  const w = await arena(), e = spawn(w, 'alpha', 0, 0, 'idle');
  const wall = { x: 4, z: 0, y: 1, halfX: .2, halfZ: 5, halfY: 1 };
  (w.combat!.query.walls as typeof wall[]).push(wall);
  const behind = human(w, 5, 0); const a = start(w, e, 'alpha.charge');
  step(w, 100); expect(e.transform.x).toBeLessThanOrEqual(3.25); expect(e.transform.x).toBeGreaterThan(3.2);
  expect(a.stage).toBe('recovery'); expect(behind.health.current).toBe(100);
});

test('T-E07-06-ground-slam @E07-AC05 @E07-AC06 exact 4m boundary, wall occlusion, 25 damage and 72 ticks, no windup effects', async () => {
  const w = await arena(); teleport(w, 20);
  const e = spawn(w, 'alpha', 0, 0, 'idle');
  const inside = human(w, 0, 4), outside = human(w, 0, -4.001), soldier = human(w, -3, 0, true), behind = human(w, 3, 0);
  (w.combat!.query.walls as { x: number; z: number; y: number; halfX: number; halfY: number; halfZ: number }[]).push({ x: 1.5, z: 0, y: 1, halfX: .2, halfY: 1, halfZ: 1 });
  const a = start(w, e, 'alpha.ground-slam');
  expect(a.area.radius).toBe(4); step(w, 59);
  for (const t of [inside, outside, soldier, behind]) { expect(t.health.current).toBe(100); expect(t.civilian!.knockedUntil).toBe(0); }
  step(w, 1); expect(a.stage).toBe('recovery'); expect(inside.health.current).toBe(75); expect(soldier.health.current).toBe(75);
  expect(inside.civilian!.knockedUntil).toBe(w.tick + 72); expect(outside.health.current).toBe(100); expect(behind.health.current).toBe(100);
  step(w, 10); expect(inside.health.current).toBe(75);
});

for (const charge of [false, true]) test(`T-E07-19-alpha-line-${charge ? 'charge' : 'ordinary'} @E07-AC19 E26 HP, source/slot log, nav and debris lifecycle`, async () => {
  const w = await arena(), e = spawn(w, 'alpha', 0, 0, 'idle'), ai = w.infected!;
  const id = w.barricades!.spawn({ id: 'line', groupId: 'line', a: { x: 3, z: -3 }, b: { x: 3, z: 3 }, height: 1, initialHp: 300 });
  const rail = w.entities.get(id)!;
  expect(w.combat!.query.visible({ x: 0, z: 0 }, { x: 6, z: 0 })).toBe(false);
  if (charge) { start(w, e, 'alpha.charge'); step(w, 80); expect(e.transform.x).toBeGreaterThan(3); }
  else {
    teleport(w, 6);
    e.transform.x = 1.3; e.infected!.state = 'chase'; e.infected!.specialCooldowns = { 'alpha.charge': 10000, 'alpha.ground-slam': 10000 };
    step(w, 31); expect(rail.health.current).toBe(200); expect(rail.barricade!.intact).toBe(true);
    step(w, 60); expect(rail.health.current).toBe(100); expect(rail.barricade!.intact).toBe(true);
    step(w, 60);
  }
  expect(rail.health.current).toBe(0); expect(rail.barricade!.intact).toBe(false); expect(rail.barricade!.breaks).toBe(1);
  expect(w.combat!.query.visible({ x: 0, z: 0 }, { x: 6, z: 0 })).toBe(true);
  expect(ai.nav.walls.some(wall => wall.x === rail.transform.x && wall.z === rail.transform.z)).toBe(false);
  const hits = w.events.events().filter(ev => ev.type === 'combat.hit' && ev.targetId === id);
  expect(hits).toHaveLength(charge ? 1 : 3); expect(hits.every(ev => ev.type === 'combat.hit' && ev.sourceId === e.id && ev.amount === (charge ? 300 : 100))).toBe(true);
  expect(w.events.events().some(ev => ev.type === 'barricade.broken' && ev.slotId === 'line')).toBe(true);
});

for (const move of ['alpha.charge', 'alpha.ground-slam'] as const) test(`T-E07-05-${move}-cooldown @E07-AC05 activation interval survives serialized cooldown and recovery`, async () => {
  const w = await arena(), e = spawn(w, 'alpha', 6, 0, 'idle');
  const ai = w.infected!, first = start(w, e, move); step(w, move === 'alpha.charge' ? 164 : 96);
  const cooldown = first.cooldownExpiry; const serialized = JSON.parse(JSON.stringify(e.infected)); e.infected = serialized;
  w.tick += 123; ai.restoreSpecialTimers(serialized, 123);
  w.tick = cooldown + 123 - (move === 'alpha.charge' ? 48 : 60) - 1;
  expect(ai.startSpecial(e.id, move, { id: 1, x: 30, z: 0 }, first.area)).toBe(false);
  w.tick++; const second = start(w, e, move, 30); step(w, move === 'alpha.charge' ? 48 : 60);
  expect(second.activeTick - (first.activeTick + 123)).toBe(move === 'alpha.charge' ? 480 : 600);
  expect(second.attackId).toBeGreaterThan(first.attackId);
});

test('T-E07-19-alpha-charge-props @E07-AC19 braced E26 furniture retains identity and becomes physical debris at rail break', async () => {
  const w = await arena(); w.loadScenario('barricade-lab'); teleport(w, 0, 1.3); step(w, 90);
  const rail = w.entities.values().find(e => e.barricade?.slot.id === 'door')!;
  expect(rail.barricade!.intact).toBe(true); rail.health = { current: 300, max: 300 };
  const ids = [...rail.barricade!.props], prop = w.props!.items.find(p => ids.includes(p.id))!;
  expect(prop.braced).toBe(true); const entityId = prop.entityId; teleport(w, 0, 10);
  const e = spawn(w, 'alpha', 0, -4, 'idle'); start(w, e, 'alpha.charge', 0, 10); step(w, 70);
  expect(rail.barricade!.intact).toBe(false); expect(prop.braced).toBe(false); expect(prop.body.isDynamic()).toBe(true);
  expect(prop.body.isEnabled()).toBe(true); expect(prop.entityId).toBe(entityId); expect(w.entities.get(entityId)).toBeDefined();
  expect(w.events.events().find(ev => ev.type === 'barricade.damaged' && ev.id === rail.id)).toMatchObject({ sourceId: e.id, slotId: 'door', previousHp: 300, hp: 0, amount: 300, props: ids });
});

test('T-E07-06-ground-slam-protected @E07-AC06 protected child and companion never take physical special effects', async () => {
  const w = await arena(); teleport(w, 20);
  const child = w.entities.get(w.npcs!.escorts.spawn({ x: 2, z: 0 }, true))!;
  const corgi = w.entities.get(w.npcs!.companion.spawn())!;
  const e = spawn(w, 'alpha', 0, 0, 'idle'); const childHp = child.health.current, corgiHp = corgi.health.current;
  start(w, e, 'alpha.ground-slam'); step(w, 60);
  expect(child.health.current).toBe(childHp); expect(corgi.health.current).toBe(corgiHp);
  expect(w.events.events().filter(ev => ev.type === 'combat.hit' && (ev.targetId === child.id || ev.targetId === corgi.id))).toHaveLength(0);
});

test('T-E07-06-ground-slam-escort @E07-AC06 adult follower uses the existing fall pose and pauses for exactly 72 ticks', async () => {
  const w = await arena(); teleport(w, 20);
  const e = spawn(w, 'alpha', 0, 0, 'idle'); start(w, e, 'alpha.ground-slam'); step(w, 59);
  const adult = w.entities.get(w.npcs!.escorts.spawn({ x: 0, z: 2 }))!;
  step(w, 1); expect(adult.health.current).toBe(75); expect(adult.escort!.knockedUntil).toBe(w.tick + 72);
  expect(adult.escort!.state).not.toBe('downed');
  adult.escort = JSON.parse(JSON.stringify(adult.escort)); w.tick += 123; w.npcs!.restore(123);
  expect(adult.escort!.knockedUntil).toBe(w.tick + 72);
  const saved = { x: adult.transform.x, z: adult.transform.z };
  step(w, 71); expect({ x: adult.transform.x, z: adult.transform.z }).toEqual(saved);
  step(w, 1); expect({ x: adult.transform.x, z: adult.transform.z }).not.toEqual(saved);
});
