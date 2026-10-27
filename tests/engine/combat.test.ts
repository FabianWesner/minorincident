// Combat core: one attack pipeline (loadout → runner → hit query → damage/status) serves every weapon in every level.
import { afterEach, expect, onTestFinished, test } from 'vitest';
import { ColliderDesc } from '@dimforge/rapier3d-compat';
import { action as rosterAction, catalog } from '../../src/data/actions/catalog';
import { action } from '../../src/data/actions/fixtures';
import type { ActionDef, Side } from '../../src/data/actions/schema';
import { comboDefinition } from '../../src/data/meleeCombos';
import { Status } from '../../src/sim/combat/Status';
import { SimWorld } from '../../src/sim/world/SimWorld';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function arena(): Promise<SimWorld> { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('combat-arena', 1); return w; }
const step = (w: SimWorld, count: number) => { for (let i = 0; i < count; i++) w.update(); };
const equip = (w: SimWorld, left = ['weapon.bat'], right = ['weapon.grenade']) => w.combat!.setLoadout(left, right);
function fire(w: SimWorld, side: Side = 'LEFT', aim = { x: 1, z: 0 }, aimPoint?: { x: number; z: number }): void {
  w.clearInput(); w.setInput({ aim, aimPoint, [side === 'LEFT' ? 'left' : 'right']: { down: true, held: true, up: false } }); step(w, 1); w.clearInput();
  const attack = w.combat!.runner.running[side];
  if (attack?.def.category === 'ranged' && w.tick < attack.activeAt) step(w, attack.activeAt - w.tick);
}
const dummy = (w: SimWorld, x: number, z = 0, hp = 100) => w.spawnDummy('infected.dummy', { x, z }, { hp });
const health = (w: SimWorld, id: number) => w.entities.get(id)!.health.current;
const walls = (w: SimWorld) => w.combat!.query.walls as { x: number; y: number; z: number; halfX: number; halfY: number; halfZ: number }[];
const attacks = (w: SimWorld) => w.events.events().filter(e => e.type === 'combat.attack');
const forehand = () => comboDefinition(rosterAction('weapon.bat'), 0);

test('loadout: both sides keep independent aims, racks wrap both ways with a switch lock, a cooling gun does not steal selection', async () => {
  const w = await arena(); equip(w, ['weapon.machine-gun']);
  fire(w); expect(w.getState().player!.weapons!.selectedSide).toBe('LEFT');
  w.setInput({ aim: { x: 0, z: 1 } }); step(w, 1);
  const state = w.entities.get(1)!.weapons!;
  expect(state.LEFT.aim).toEqual({ x: 0, z: 1 }); expect(state.RIGHT.aim).toEqual({ x: 1, z: 0 });
  fire(w, 'RIGHT', { x: 0, z: 1 }, { x: 0, z: 8 }); expect(state.selectedSide).toBe('RIGHT');
  w.setInput({ aim: { x: -1, z: 0 } }); step(w, 1);
  expect(state.LEFT.aim).toEqual({ x: 0, z: 1 }); expect(state.RIGHT.aim).toEqual({ x: -1, z: 0 });

  const r = await arena(); equip(r, ['weapon.bat', 'weapon.pistol', 'weapon.machine-gun'], ['weapon.grenade', 'ability.ground-slam']);
  r.setInput({ selector: -1 }); step(r, 1); r.clearInput();
  const rack = r.combat!.runner.loadout;
  expect(rack.state.LEFT.index).toBe(2); expect(rack.state.RIGHT.index).toBe(0);
  r.setInput({ left: { down: false, held: true, up: false } }); step(r, 14);
  expect(attacks(r)).toHaveLength(0); // switch lock
  step(r, 1); r.clearInput(); step(r, 6);
  expect(attacks(r)).toHaveLength(1);
  expect(r.events.events()).toContainEqual({ tick: 16, type: 'loadout.switched', sourceId: 1, side: 'LEFT', actionId: 'weapon.machine-gun' });
  r.setInput({ selector: 1 }); step(r, 1); r.clearInput(); expect(rack.state.LEFT.index).toBe(0);

  const h = await arena(); equip(h, ['weapon.machine-gun']);
  h.setInput({ aim: { x: 1, z: 0 }, left: { down: true, held: true, up: false } }); step(h, 1);
  h.setInput({ left: { down: false, held: true, up: false }, right: { down: true, held: false, up: true } }); step(h, 1);
  h.setInput({ aim: { x: 0, z: 1 }, right: { down: false, held: false, up: false } }); step(h, 1);
  expect(h.entities.get(1)!.weapons!.selectedSide).toBe('RIGHT');
});

test('melee: the swing hits inside its arc/range once per target and respects maxTargets', async () => {
  const bat = catalog['weapon.bat'] as ActionDef, sweep = bat.roundhouse; delete bat.roundhouse; // the crowd roundhouse would take over with seven in reach
  onTestFinished(() => { bat.roundhouse = sweep; });
  const w = await arena(); equip(w);
  const rad = (d: number) => d * Math.PI / 180;
  const inside = [dummy(w, 1), dummy(w, 1.9 * Math.cos(rad(49)), 1.9 * Math.sin(rad(49))), dummy(w, 1.9 * Math.cos(rad(-50)), 1.9 * Math.sin(rad(-50)))];
  const outside = [dummy(w, 1.91), dummy(w, Math.cos(rad(51)), Math.sin(rad(51))), dummy(w, -1)];
  const capped = dummy(w, 1.1);
  fire(w); step(w, 29);
  for (const id of inside) expect(health(w, id)).toBe(100 - forehand().damage);
  for (const id of [...outside, capped]) expect(health(w, id)).toBe(100);
  const hits = w.events.events().filter(e => e.type === 'combat.hit');
  expect(hits).toHaveLength(3);
  for (const id of inside) expect(hits.filter(e => e.type === 'combat.hit' && e.targetId === id)).toHaveLength(1);
});

test('guns: held fire cadence, reload timing, infinite reserve and seeded, bounded, serialized spread', async () => {
  const w = await arena(); equip(w, ['weapon.pistol']); dummy(w, 5, 0, 10000);
  w.setInput({ aim: { x: 1, z: 0 }, left: { down: false, held: true, up: false } }); step(w, 82);
  const slot = w.combat!.runner.loadout.current('LEFT');
  expect(attacks(w).map(e => e.tick)).toEqual([7, 22, 37, 52, 67, 82]);
  expect(slot.magazine).toBe(0); expect(slot.reloadUntil).toBe(142); expect(slot.reserve).toBe('infinite');
  step(w, 60); expect(slot.magazine).toBe(5);

  const pistol = action('weapon.pistol'), previous = pistol.spread, directions = [];
  try {
    pistol.spread = 10;
    for (let run = 0; run < 2; run++) {
      const s = await arena(); equip(s, ['weapon.pistol']); s.combat!.assist.setting = 'Off'; fire(s);
      const attack = attacks(s)[0];
      if (attack.type === 'combat.attack') { expect(Math.abs(Math.atan2(attack.direction.z, attack.direction.x))).toBeLessThanOrEqual(5 * Math.PI / 180); directions.push(attack.direction); }
      expect(s.getState().combat!.rng.cursor).toBe(1);
    }
    expect(directions[0]).toEqual(directions[1]);
  } finally { pistol.spread = previous; }
});

test('explosives: landing clamps to range, fuse, distance falloff, cover line of sight, self 30 % and escort 100 %', async () => {
  const w = await arena(); equip(w); w.combat!.damage.god = true;
  const wall = { x: 5, y: 1, z: 1, halfX: 0.5, halfY: 1, halfZ: 0.1 };
  walls(w).push(wall);
  w.physics.world!.createCollider(ColliderDesc.cuboid(wall.halfX, wall.halfY, wall.halfZ).setTranslation(wall.x, wall.y, wall.z));
  const center = dummy(w, 5), near = dummy(w, 6), far = dummy(w, 8), blocked = dummy(w, 5, 2), outside = dummy(w, 9.1);
  fire(w, 'RIGHT', { x: 1, z: 0 }, { x: 5, z: 0 }); step(w, 89);
  expect(w.events.events().filter(e => e.type === 'combat.exploded')).toHaveLength(0);
  step(w, 1);
  expect(w.events.events()).toContainEqual({ type: 'combat.exploded', tick: 91, sourceId: 1, attackId: 1, radius: 4, position: { x: 5, y: 0, z: 0 } });
  expect(health(w, center)).toBe(0); expect(health(w, near)).toBeCloseTo(25); expect(health(w, far)).toBeCloseTo(75);
  expect(health(w, blocked)).toBe(100); expect(health(w, outside)).toBe(100);
  fire(w, 'RIGHT', { x: 0, z: -1 }, { x: 0, z: -20 }); step(w, 50);
  const last = w.events.events().filter(e => e.type === 'combat.landed').at(-1)!;
  if (last.type === 'combat.landed') expect(Math.hypot(last.position.x, last.position.z + 10)).toBeLessThan(0.3);

  const f = await arena(); equip(f); const escort = f.spawnDummy('escort.dummy', { x: 0, z: 0 }, { faction: 'escort' });
  fire(f, 'RIGHT', { x: 1, z: 0 }, { x: 0, z: 0 }); step(f, 90);
  expect(health(f, escort)).toBe(0); expect(health(f, 1)).toBeCloseTo(70, 1);
});

test('damage modifiers: front shield ±60°, armor and multipliers, stun/slow/toxic, capped burning stacks and water', async () => {
  for (const degrees of [-60, 0, 60, 61, 180]) {
    const w = await arena(); equip(w, ['weapon.pistol']);
    const id = w.spawnDummy('infected.riot', { x: 3, z: 0 }, { yaw: Math.PI + degrees * Math.PI / 180 });
    fire(w); expect(health(w, id), `${degrees}°`).toBe(Math.abs(degrees) <= 60 ? 100 : 80);
  }
  const w = await arena(); equip(w, ['weapon.pistol']); const id = dummy(w, 5), target = w.entities.get(id)!;
  target.combat!.armor = 0.5; w.entities.get(1)!.combat!.damageMultiplier = 2;
  fire(w); expect(health(w, id)).toBe(80);
  const player = w.entities.get(1)!;
  w.combat!.status.apply(player, { kind: 'stunned', duration: 1, maxStacks: 1, dps: 0, slow: 0 }, id, 'test.stun');
  w.setInput({ move: { x: 1, z: 0 }, left: { down: false, held: true, up: false } }); step(w, 59);
  expect(player.transform.x).toBeCloseTo(0, 4); expect(attacks(w)).toHaveLength(1);
  step(w, 1); expect(player.transform.x).toBeGreaterThan(0);
  w.combat!.status.apply(target, { kind: 'toxic', duration: 1, maxStacks: 1, dps: 5, slow: 0.25 }, 1, 'test.toxic');
  expect(Status.speed(target)).toBe(0.75);

  const b = await arena(), bid = dummy(b, 5), burning = b.entities.get(bid)!;
  const def = { kind: 'burning' as const, duration: 2.5, maxStacks: 2, dps: 10, slow: 0 };
  for (let i = 0; i < 4; i++) b.combat!.status.apply(burning, def, 1, 'test.fire');
  expect(burning.combat!.statuses[0].stacks).toBe(2);
  step(b, 60); expect(health(b, bid)).toBe(80);
  step(b, 390); expect(health(b, bid)).toBe(50); expect(burning.combat!.statuses).toHaveLength(0);
  b.combat!.status.apply(burning, def, 1, 'test.fire'); b.combat!.status.water.push({ x: 5, z: 0, radius: 1 });
  step(b, 180); expect(health(b, bid)).toBe(50);
});

test('every weapon category fires and hits; swept projectiles never tunnel; full cover stops melee, hitscan and projectiles', async () => {
  for (const weapon of ['weapon.bat', 'weapon.pistol', 'weapon.grenade', 'ability.ground-slam', 'weapon.test-projectile']) {
    const w = await arena(); equip(w, [weapon]); w.combat!.damage.god = true; const id = dummy(w, 1);
    fire(w, 'LEFT', { x: 1, z: 0 }, { x: 1, z: 0 }); step(w, 91);
    expect(health(w, id), weapon).toBeLessThan(100);
    expect(w.events.events().some(e => e.type === 'combat.hit'), weapon).toBe(true);
  }
  for (const weapon of ['weapon.bat', 'weapon.pistol', 'weapon.test-projectile']) {
    const w = await arena(); equip(w, [weapon]); const id = dummy(w, 1.5);
    walls(w).push({ x: 0.75, y: 1, z: 0, halfX: 0.1, halfY: 1, halfZ: 2 });
    fire(w); step(w, 30); expect(health(w, id), `${weapon} through cover`).toBe(100);
  }
});

test('attack lifetime: ids survive re-equipping, dead sources cannot attack, snapshots cannot mutate live attacks', async () => {
  const w = await arena(); equip(w, ['weapon.pistol']); dummy(w, 5);
  fire(w); equip(w, ['weapon.pistol']); fire(w);
  expect(attacks(w).map(e => e.type === 'combat.attack' ? e.attackId : 0)).toEqual([1, 2]);
  w.player!.damage(100, w.tick); fire(w); step(w, 30);
  expect(attacks(w)).toHaveLength(2);

  const s = await arena(); equip(s); fire(s, 'RIGHT'); s.combat!.status.water.push({ x: 1, z: 1, radius: 2 });
  const snapshot = s.getState(); snapshot.combat!.projectiles[0].landing!.x = 999; snapshot.combat!.water[0].radius = 999;
  expect(s.getState().combat!.projectiles[0].landing!.x).toBeCloseTo(10); expect(s.getState().combat!.water[0].radius).toBe(2);
});
