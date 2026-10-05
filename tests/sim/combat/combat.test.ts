import { expect, test } from 'vitest';
import { arena, dummy, equip, fire, health, step } from './helpers';
import { action } from '../../../src/data/actions/fixtures';
import { Status } from '../../../src/sim/combat/Status';

test('T-E05-01 @E05 @E05-AC01 MG, rotate, grenade, rotate retain independent side aims', async () => {
  const w = await arena(); equip(w, ['weapon.machine-gun']);
  fire(w); expect(w.getState().player!.weapons!.selectedSide).toBe('LEFT');
  w.setInput({ aim: { x: 0, z: 1 } }); step(w, 1);
  const state = w.entities.get(1)!.weapons!;
  expect(state.LEFT.aim).toEqual({ x: 0, z: 1 }); expect(state.RIGHT.aim).toEqual({ x: 1, z: 0 });
  fire(w, 'RIGHT', { x: 0, z: 1 }, { x: 0, z: 8 });
  expect(state.selectedSide).toBe('RIGHT');
  w.setInput({ aim: { x: -1, z: 0 } }); step(w, 1);
  expect(state.LEFT.aim).toEqual({ x: 0, z: 1 }); expect(state.RIGHT.aim).toEqual({ x: -1, z: 0 });
  fire(w, 'LEFT', { x: -1, z: 0 }); expect(state.selectedSide).toBe('LEFT');
});

test('T-E05-02 @E05 @E05-AC02 selected rack wraps both ways, locks for 15 ticks and emits switched', async () => {
  const w = await arena(); equip(w, ['weapon.bat', 'weapon.pistol', 'weapon.machine-gun'], ['weapon.grenade', 'ability.ground-slam']);
  w.setInput({ selector: -1 }); step(w, 1); w.clearInput();
  const rack = w.combat!.runner.loadout;
  expect(rack.state.LEFT.index).toBe(2); expect(rack.state.RIGHT.index).toBe(0);
  w.setInput({ left: { down: false, held: true, up: false } }); step(w, 14);
  expect(w.events.events().filter((e) => e.type === 'combat.attack')).toHaveLength(0);
  step(w, 1); w.clearInput();
  expect(w.events.events().filter((e) => e.type === 'combat.attack')).toHaveLength(1);
  expect(w.events.events()).toContainEqual({ tick: 16, type: 'loadout.switched', sourceId: 1, side: 'LEFT', actionId: 'weapon.machine-gun' });
  w.setInput({ selector: 1 }); step(w, 1); w.clearInput(); expect(rack.state.LEFT.index).toBe(0);
  fire(w, 'RIGHT'); w.setInput({ selector: 1 }); step(w, 1); w.clearInput();
  expect(rack.state.LEFT.index).toBe(0); expect(rack.state.RIGHT.index).toBe(1);
});

test('T-E05-03 @E05 @E05-AC03 bat arc/range/maxTargets boundaries, once per swing', async () => {
  const w = await arena(); equip(w);
  const inside = [dummy(w, 1), dummy(w, 1.9 * Math.cos(49 * Math.PI / 180), 1.9 * Math.sin(49 * Math.PI / 180)), dummy(w, 1.9 * Math.cos(-50 * Math.PI / 180), 1.9 * Math.sin(-50 * Math.PI / 180))];
  const outside = [dummy(w, 1.91), dummy(w, Math.cos(51 * Math.PI / 180), Math.sin(51 * Math.PI / 180)), dummy(w, -1)];
  const capped = dummy(w, 1.1);
  fire(w); step(w, 29);
  for (const id of inside) expect(health(w, id)).toBe(75);
  for (const id of [...outside, capped]) expect(health(w, id)).toBe(100);
  const hits = w.events.events().filter((e) => e.type === 'combat.hit'); expect(hits).toHaveLength(3);
  for (const id of inside) expect(hits.filter((e) => e.type === 'combat.hit' && e.targetId === id)).toHaveLength(1);
});

test('T-E05-04 @E05 @E05-AC04 held pistol fires every 15 ticks, reloads empty at 60 ticks with infinite reserve', async () => {
  const w = await arena(); equip(w, ['weapon.pistol']); dummy(w, 5, 0, 10000);
  w.setInput({ aim: { x: 1, z: 0 }, left: { down: false, held: true, up: false } }); step(w, 76);
  const slot = w.combat!.runner.loadout.current('LEFT');
  expect(w.events.events().filter((e) => e.type === 'combat.attack').map((e) => e.tick)).toEqual([1, 16, 31, 46, 61, 76]);
  expect(slot.magazine).toBe(0); expect(slot.reloadUntil).toBe(136); expect(slot.reserve).toBe('infinite');
  step(w, 59); expect(slot.magazine).toBe(0); step(w, 1); expect(slot.magazine).toBe(5); expect(slot.reserve).toBe('infinite');
  expect(w.events.events().filter((e) => e.type === 'combat.attack').map((e) => e.tick)).toEqual([1, 16, 31, 46, 61, 76, 136]);
});

test('T-E05-05 @E05 @E05-AC05 grenade landing clamps to range, fuse/falloff and cover LOS', async () => {
  const w = await arena(); equip(w); w.combat!.damage.god = true;
  // Put a full-cover collider and query wall between blast and one dummy.
  const wall = { x: 5, y: 1, z: 1, halfX: 0.5, halfY: 1, halfZ: 0.1 };
  (w.combat!.query.walls as typeof wall[]).push(wall);
  w.physics.world!.createCollider((await import('@dimforge/rapier3d-compat')).ColliderDesc.cuboid(wall.halfX, wall.halfY, wall.halfZ).setTranslation(wall.x, wall.y, wall.z));
  const center = dummy(w, 5), near = dummy(w, 6), far = dummy(w, 8), blocked = dummy(w, 5, 2), outside = dummy(w, 9.1);
  fire(w, 'RIGHT', { x: 1, z: 0 }, { x: 5, z: 0 }); step(w, 25);
  const landing = w.events.events().find((e) => e.type === 'combat.landed');
  expect(landing).toMatchObject({ position: { x: 5, y: 0, z: 0 } }); expect(health(w, center)).toBe(100);
  step(w, 64); expect(w.events.events().filter((e) => e.type === 'combat.exploded')).toHaveLength(0);
  step(w, 1);
  expect(w.events.events()).toContainEqual({ type: 'combat.exploded', tick: 91, sourceId: 1, attackId: 1, position: { x: 5, y: 0, z: 0 } });
  expect(health(w, center)).toBe(0); expect(health(w, near)).toBeCloseTo(25); expect(health(w, far)).toBeCloseTo(75);
  expect(health(w, blocked)).toBe(100); expect(health(w, outside)).toBe(100);
  fire(w, 'RIGHT', { x: 0, z: -1 }, { x: 0, z: -20 }); step(w, 50);
  const last = w.events.events().filter((e) => e.type === 'combat.landed').at(-1)!;
  if (last.type === 'combat.landed') expect(Math.hypot(last.position.x, last.position.z + 10)).toBeLessThan(0.3);
});

test('T-E05-06 @E05 @E05-AC06 two charges, reject third, first recharges at 720 ticks exactly', async () => {
  const w = await arena(); equip(w); w.combat!.damage.god = true;
  fire(w, 'RIGHT'); step(w, 14); fire(w, 'RIGHT'); step(w, 14); fire(w, 'RIGHT');
  const slot = w.combat!.runner.loadout.current('RIGHT');
  expect(slot.charges).toBe(0); expect(w.events.events().filter((e) => e.type === 'combat.attack')).toHaveLength(2);
  step(w, 720 - w.tick); expect(slot.charges).toBe(0); step(w, 1); expect(slot.charges).toBe(1);
  fire(w, 'RIGHT'); expect(slot.charges).toBe(0); expect(w.events.events().filter((e) => e.type === 'combat.attack')).toHaveLength(3);
});

test('T-E05-07 @E05 @E05-AC07 authored displacement along hit direction; stagger cancels infected attack', async () => {
  const w = await arena(); equip(w); const id = dummy(w, 1), target = w.entities.get(id)!;
  target.combat!.attacking = true;
  fire(w); step(w, 6);
  expect(target.transform.x - 1).toBeCloseTo(action('weapon.bat').knockback); expect(target.transform.z).toBeCloseTo(0, 6);
  expect(target.combat!.attacking).toBe(false); expect(target.combat!.staggerUntil).toBe(25);
  expect(Status.stunned(target, 24)).toBe(true); expect(Status.stunned(target, 25)).toBe(false);
});

test('T-E05-08 @E05 @E05-AC08 front shield ±60°, rear full bullets and explosives ignore shield', async () => {
  for (const degrees of [-60, 0, 60, 61, 180]) {
    const w = await arena(); equip(w, ['weapon.pistol']);
    const id = w.spawnDummy('infected.riot', { x: 3, z: 0 }, { yaw: Math.PI + degrees * Math.PI / 180 });
    fire(w); expect(health(w, id)).toBe(Math.abs(degrees) <= 60 ? 100 : 80);
  }
  const w = await arena(); equip(w); w.combat!.damage.god = true;
  const id = w.spawnDummy('infected.riot', { x: 3, z: 0 }, { yaw: Math.PI });
  fire(w, 'RIGHT', { x: 1, z: 0 }, { x: 3, z: 0 }); step(w, 90); expect(health(w, id)).toBe(0);
});

test('T-E05-09 @E05 @E05-AC09 burning integrates 10 DPS over duration with capped stacks; water extinguishes', async () => {
  const w = await arena(), id = dummy(w, 5), target = w.entities.get(id)!;
  const def = { kind: 'burning' as const, duration: 2.5, maxStacks: 2, dps: 10, slow: 0 };
  for (let i = 0; i < 4; i++) w.combat!.status.apply(target, def, 1, 'test.fire');
  expect(target.combat!.statuses[0].stacks).toBe(2);
  step(w, 59); expect(health(w, id)).toBe(100); step(w, 1); expect(health(w, id)).toBe(80);
  step(w, 60); expect(health(w, id)).toBe(60); step(w, 30); expect(health(w, id)).toBe(50);
  step(w, 300); expect(health(w, id)).toBe(50); expect(target.combat!.statuses).toHaveLength(0);
  w.combat!.status.apply(target, def, 1, 'test.fire'); w.combat!.status.water.push({ x: 5, z: 0, radius: 1 });
  step(w, 180); expect(health(w, id)).toBe(50); expect(target.combat!.statuses).toHaveLength(0);
});

test('T-E05-10 @E05 @E05-AC10 own explosive gives player 30% and escort 100%', async () => {
  const w = await arena(); equip(w); const escort = w.spawnDummy('escort.dummy', { x: 0, z: 0 }, { faction: 'escort' });
  fire(w, 'RIGHT', { x: 1, z: 0 }, { x: 0, z: 0 }); step(w, 90);
  expect(health(w, escort)).toBe(0); expect(health(w, 1)).toBeCloseTo(70, 1);
  const hits = w.events.events().filter((e) => e.type === 'combat.hit');
  const own = hits.find((e) => e.type === 'combat.hit' && e.targetId === 1)!;
  if (own.type === 'combat.hit') expect(own.amount).toBeCloseTo(30, 1);
  expect(hits.find((e) => e.type === 'combat.hit' && e.targetId === escort)).toMatchObject({ amount: 100 });
});

test('T-E05-11 @E05 @E05-AC11 Default snaps 8°, not 15°; Off never snaps; nearest visible valid target', async () => {
  for (const [angle, setting, hit] of [[8, 'Default', true], [15, 'Default', false], [8, 'Off', false]] as const) {
    const w = await arena(); equip(w, ['weapon.pistol']); w.combat!.assist.setting = setting;
    const id = dummy(w, 8 * Math.cos(angle * Math.PI / 180), 8 * Math.sin(angle * Math.PI / 180));
    fire(w); expect(health(w, id)).toBe(hit ? 80 : 100);
    const attack = w.events.events().find((e) => e.type === 'combat.attack');
    expect(attack).toMatchObject({ direction: hit ? { x: Math.cos(angle * Math.PI / 180), z: Math.sin(angle * Math.PI / 180) } : { x: 1, z: 0 } });
    expect(w.entities.get(1)!.weapons!.LEFT.aim).toEqual({ x: 1, z: 0 });
  }
});

test('T-E05-assist-filter @E05 nearest living infected in range and LOS beats a nearer-angle distant target', async () => {
  const w = await arena(); equip(w, ['weapon.pistol']);
  const near = dummy(w, 5 * Math.cos(8 * Math.PI / 180), 5 * Math.sin(8 * Math.PI / 180));
  const far = dummy(w, 9 * Math.cos(4 * Math.PI / 180), 9 * Math.sin(4 * Math.PI / 180));
  const dead = dummy(w, 1); w.entities.get(dead)!.health.current = 0;
  w.spawnDummy('escort.dummy', { x: 2, z: 0 }, { faction: 'escort' });
  const blocked = dummy(w, 3, -0.3);
  (w.combat!.query.walls as { x: number; y: number; z: number; halfX: number; halfY: number; halfZ: number }[]).push({ x: 2, y: 1, z: -0.2, halfX: 0.1, halfY: 1, halfZ: 0.05 });
  fire(w); expect(health(w, near)).toBe(80); expect(health(w, far)).toBe(100); expect(health(w, blocked)).toBe(100);
  const outside = dummy(w, 21); const aim = { x: 1, z: 0 }; w.combat!.assist.apply(1, { x: 0, z: 0 }, aim, 2.5);
  expect(aim).toEqual({ x: 1, z: 0 }); expect(health(w, outside)).toBe(100);
});

test('S-06 @E05 @smoke each category fires/hits; swept projectile cannot tunnel through a dummy', async () => {
  for (const weapon of ['weapon.bat', 'weapon.pistol', 'weapon.grenade', 'ability.ground-slam', 'weapon.test-projectile']) {
    const w = await arena(); equip(w, [weapon]); w.combat!.damage.god = true; const id = dummy(w, 1);
    fire(w, 'LEFT', { x: 1, z: 0 }, { x: 1, z: 0 }); step(w, 91);
    expect(health(w, id), weapon).toBeLessThan(100);
    expect(w.events.events().some((e) => e.type === 'combat.attack')).toBe(true);
    expect(w.events.events().some((e) => e.type === 'combat.hit')).toBe(true);
  }
});

test('T-E05-statuses @E05 stunned gates attacks/movement, slowed/toxic reduce speed; armor/modifiers precede HP', async () => {
  const w = await arena(); equip(w, ['weapon.pistol']); const id = dummy(w, 5), target = w.entities.get(id)!;
  target.combat!.armor = 0.5; w.entities.get(1)!.combat!.damageMultiplier = 2;
  fire(w); expect(health(w, id)).toBe(80);
  const player = w.entities.get(1)!;
  w.combat!.status.apply(player, { kind: 'stunned', duration: 1, maxStacks: 1, dps: 0, slow: 0 }, id, 'test.stun');
  w.setInput({ move: { x: 1, z: 0 }, left: { down: false, held: true, up: false } }); step(w, 59);
  expect(player.transform.x).toBeCloseTo(0, 4); expect(w.events.events().filter((e) => e.type === 'combat.attack')).toHaveLength(1);
  step(w, 1); expect(player.transform.x).toBeGreaterThan(0);
  w.combat!.status.apply(player, { kind: 'slowed', duration: 2, maxStacks: 1, dps: 0, slow: 0.5 }, id, 'test.slow');
  step(w, 20); expect(w.player!.locomotion.velocity.x).toBeCloseTo(2.25);
  w.combat!.status.apply(target, { kind: 'toxic', duration: 1, maxStacks: 1, dps: 5, slow: 0.25 }, 1, 'test.toxic');
  expect(Status.speed(target)).toBe(0.75); w.clearInput(); step(w, 60); expect(health(w, id)).toBe(35);
});

test('T-E05-lifetime @E05 re-equipping preserves attack IDs and dead/stunned sources cannot resolve new attacks', async () => {
  const w = await arena(); equip(w, ['weapon.pistol']); dummy(w, 5);
  fire(w); equip(w, ['weapon.pistol']); fire(w);
  expect(w.events.events().filter((e) => e.type === 'combat.attack').map((e) => e.type === 'combat.attack' ? e.attackId : 0)).toEqual([1, 2]);
  w.player!.damage(100, w.tick); fire(w); step(w, 30);
  expect(w.events.events().filter((e) => e.type === 'combat.attack')).toHaveLength(2);
});

test('T-E05-cover @E05 melee/hitscan and swept projectiles stop at full-cover walls', async () => {
  for (const weapon of ['weapon.bat', 'weapon.pistol', 'weapon.test-projectile']) {
    const w = await arena(); equip(w, [weapon]); const id = dummy(w, 1.5);
    (w.combat!.query.walls as { x: number; y: number; z: number; halfX: number; halfY: number; halfZ: number }[]).push({ x: 0.75, y: 1, z: 0, halfX: 0.1, halfY: 1, halfZ: 2 });
    fire(w); step(w, 30); expect(health(w, id), weapon).toBe(100);
  }
});

test('T-E05-spread @E05 seeded spread is repeatable, bounded, and serialized in gameplay state', async () => {
  const pistol = action('weapon.pistol'), previous = pistol.spread, directions = [];
  try {
    pistol.spread = 10;
    for (let run = 0; run < 2; run++) {
      const w = await arena(); equip(w, ['weapon.pistol']); w.combat!.assist.setting = 'Off'; fire(w);
      const attack = w.events.events().find((e) => e.type === 'combat.attack')!;
      if (attack.type === 'combat.attack') {
        const angle = Math.atan2(attack.direction.z, attack.direction.x); expect(Math.abs(angle)).toBeLessThanOrEqual(5 * Math.PI / 180); directions.push(attack.direction);
      }
      expect(w.getState().combat!.rng.cursor).toBe(1);
    }
    expect(directions[0]).toEqual(directions[1]);
  } finally { pistol.spread = previous; }
});
