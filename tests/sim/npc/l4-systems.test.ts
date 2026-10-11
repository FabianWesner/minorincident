import { expect, test } from 'vitest';
import { l4 } from '../../../src/data/l4';
import { allyState, updateAlly } from '../../../src/sim/outbreak/Allies';
import { Outbreak } from '../../../src/sim/outbreak/Outbreak';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { arena, spawn, step } from '../ai/helpers';

function soldier(w: Awaited<ReturnType<typeof arena>>, x: number, z: number) {
  const e = w.entities.get(w.npcs!.civilians.outbreak?.spawnPedestrian({ x, z }, { role: 'soldier' }) ?? w.npcs!.civilians.spawn('officer', { x, z }))!;
  e.health = { current: 120, max: 120 };
  e.civilian!.ally = { ...allyState('soldier', { x, z }, true), engaged: true, gun: { ...l4.soldiers.rifle }, weapon: 'rifle' };
  return e;
}
function move(w: Awaited<ReturnType<typeof arena>>, e: EntitySnapshot, x: number, z: number) {
  Object.assign(e.transform, { x, z }); w.spatial.set(e.id, x, z);
}
function fire(w: Awaited<ReturnType<typeof arena>>, soldiers: EntitySnapshot[], frames: number) {
  for (let i = 0; i < frames; i++) { w.tick++; for (const e of soldiers) updateAlly(w, e, () => true); }
}

test('T-E22-12-focus @E22-AC12 two soldiers sustain visible Alpha fire for three seconds while closer runners are ignored', async () => {
  const w = await arena(), soldiers = [soldier(w, -10, -2), soldier(w, -10, 2)];
  const alpha = spawn(w, 'alpha', 5, 0, 'idle'), runner = spawn(w, 'runner', -3, 5, 'idle');
  fire(w, soldiers, 210);
  for (const e of soldiers) {
    const attacks = w.events.events().filter(ev => ev.type === 'ally.attack' && ev.sourceId === e.id);
    expect(attacks.length).toBeGreaterThanOrEqual(8);
    expect(attacks.every(ev => ev.type === 'ally.attack' && ev.targetId === alpha.id)).toBe(true);
    expect(attacks.at(-1)!.tick - attacks[0].tick).toBeGreaterThanOrEqual(180);
  }
  expect(alpha.health.current).toBeGreaterThan(0); expect(runner.health.current).toBe(runner.health.max);
});

for (const obstruction of ['range', 'hidden', 'wall'] as const) test(`T-E22-12-visible-${obstruction} @E22-AC12 soldiers cannot prioritize an unavailable Alpha`, async () => {
  const w = await arena(), e = soldier(w, -10, 0), runner = spawn(w, 'runner', -3, 4, 'idle');
  const alpha = spawn(w, 'alpha', obstruction === 'range' ? 30 : 5, 0, 'idle');
  if (obstruction === 'hidden') alpha.infected!.hidden = true;
  if (obstruction === 'wall') (w.combat!.query.walls as { x: number; z: number; y: number; halfX: number; halfZ: number; halfY: number }[]).push({ x: 0, z: 0, y: 1, halfX: .2, halfZ: 1, halfY: 1 });
  fire(w, [e], 30); expect(e.civilian!.ally!.targetId).toBe(runner.id);
  expect(w.events.events().some(ev => ev.type === 'ally.attack' && ev.targetId === alpha.id)).toBe(false);
});

for (const gun of ['rifle', 'hmg', 'pistol', 'legacy'] as const) test(`T-E22-09-shot-block-${gun} @E22-AC09 a panicking human suppresses allied shots, including a pending shot, until clear`, async () => {
  const w = await arena(), e = soldier(w, -10, 0), alpha = spawn(w, 'alpha', 8, 0, 'idle');
  move(w, w.entities.get(1)!, 0, -10);
  const human = w.entities.get(w.npcs!.civilians.spawn('cashier', { x: -1, z: 3 }))!;
  human.civilian!.state = 'flee';
  if (gun === 'hmg') e.civilian!.ally!.gun = { ...l4.soldiers.hmg };
  if (gun === 'pistol') { e.civilian!.ally!.role = 'civilian'; e.civilian!.ally!.gun = { ...l4.civilians.pistol }; }
  if (gun === 'legacy') { e.civilian!.ally!.gun = undefined; e.civilian!.ally!.range = 26; }
  // Acquire and raise the gun, then the civilian crosses before the next tick resolves it.
  fire(w, [e], 1); expect(e.civilian!.ally!.strikeAt).toBeGreaterThan(0);
  move(w, human, -1, 0); const hp = alpha.health.current, humanHp = human.health.current;
  fire(w, [e], 60);
  expect(alpha.health.current).toBe(hp); expect(human.health.current).toBe(humanHp);
  expect(w.events.events().filter(ev => ev.type === 'ally.attack' && ev.sourceId === e.id)).toHaveLength(0);
  move(w, human, -1, 3); fire(w, [e], 300);
  expect(w.events.events().some(ev => ev.type === 'combat.hit' && ev.sourceId === e.id && ev.targetId === alpha.id)).toBe(true);
  expect(human.health.current).toBe(humanHp);
});

test('T-E22-09-segment @E22-AC09 humans beyond or beside the shot, hidden/dead humans and infected do not obstruct it', async () => {
  const w = await arena(), e = soldier(w, -10, 0), alpha = spawn(w, 'alpha', 8, 0, 'idle');
  move(w, w.entities.get(1)!, 0, -10);
  const human = w.entities.get(w.npcs!.civilians.spawn('cashier', { x: -1, z: 0 }))!;
  const clear = () => w.combat!.query.alliedShotClear(e, alpha);
  expect(clear()).toBe(false);
  for (const [x, z] of [[-12, 0], [10, 0], [-1, .36]]) { move(w, human, x, z); expect(clear()).toBe(true); }
  move(w, human, -1, 0); human.hidden = true; expect(clear()).toBe(true);
  human.hidden = false; human.health.current = 0; expect(clear()).toBe(true);
  human.health.current = 100; human.faction = 'infected'; expect(clear()).toBe(true);
  human.faction = 'civilian'; human.transform.y = 5; expect(clear()).toBe(true);
});

test('T-E22-13-gap @E22-AC12 @E22-AC13 a real Alpha charge destroys E26 HP and three regular infected traverse its gap', async () => {
  const w = await arena(), alpha = spawn(w, 'alpha', -4, 0, 'idle');
  const player = w.entities.get(1)!; move(w, player, 8, 0);
  w.physics.playerBody!.setTranslation(player.transform, true); w.player!.locomotion.reset(); w.combat!.damage.god = true;
  const id = w.barricades!.spawn({ id: 'l4-line', groupId: 'l4-line', a: { x: 0, z: -5 }, b: { x: 0, z: 5 }, height: .85, depth: .7, initialHp: 300, sandbag: true });
  expect(w.infected!.nav.clear(0, 0, .4)).toBe(false);
  const runners = [-1.5, 0, 1.5].map(z => spawn(w, 'runner', -7, z, 'idle'));
  expect(w.infected!.startSpecial(alpha.id, 'alpha.charge', { id: 1, x: 8, z: 0 }, { x: -4, z: 0, radius: 1, dx: 1, dz: 0 })).toBe(true);
  step(w, 90);
  expect(w.entities.get(id)!.barricade!.intact).toBe(false);
  expect(w.events.events().find(ev => ev.type === 'barricade.damaged' && ev.id === id)).toMatchObject({ sourceId: alpha.id, previousHp: 300, hp: 0, amount: 300 });
  expect(w.events.events().some(ev => ev.type === 'barricade.broken' && ev.id === id)).toBe(true);
  expect(w.infected!.nav.clear(0, 0, .4)).toBe(true);
  for (const e of runners) { e.infected!.state = 'chase'; e.noiseTarget = { id: 1, until: 10000 }; }
  step(w, 360);
  expect(runners.filter(e => e.transform.x > 0)).toHaveLength(3);
});

test('T-E22-12-line-focus @E22-AC12 @E22-AC13 soldiers focus on the Alpha while three regular infected cross the line it breaks', async () => {
  const w = await arena(), player = w.entities.get(1)!;
  w.npcs!.civilians.outbreak = new Outbreak(w, { refuges: [] });
  move(w, player, -10, 0); w.physics.playerBody!.setTranslation(player.transform, true); w.player!.locomotion.reset(); w.combat!.damage.god = true;
  const soldiers = [soldier(w, -10, -4), soldier(w, -10, 4)], alpha = spawn(w, 'alpha', 4, 0, 'idle');
  w.barricades!.spawn({ id: 'focus-line', groupId: 'l4-line', a: { x: 0, z: -5 }, b: { x: 0, z: 5 }, height: .85, depth: .7, initialHp: 300, sandbag: true });
  const runners = [-1.5, 0, 1.5].map(z => spawn(w, 'runner', 7, z, 'idle'));
  expect(w.infected!.startSpecial(alpha.id, 'alpha.charge', { id: 1, x: -10, z: 0 }, { x: 4, z: 0, radius: 1, dx: -1, dz: 0 })).toBe(true);
  step(w, 90);
  expect(w.barricades!.barricadeIntact('focus-line')).toBe(false);
  for (const e of runners) { e.infected!.state = 'chase'; e.noiseTarget = { id: 1, until: 10000 }; }
  step(w, 360);
  expect(runners.filter(e => e.transform.x < 0)).toHaveLength(3);
  for (const e of soldiers) {
    const shots = w.events.events().filter(ev => ev.type === 'ally.attack' && ev.sourceId === e.id && ev.targetId === alpha.id);
    expect(shots.length).toBeGreaterThanOrEqual(8);
    expect(shots.at(-1)!.tick - shots[0].tick).toBeGreaterThanOrEqual(180);
  }
});
