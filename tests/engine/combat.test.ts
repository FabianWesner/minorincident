// Combat core: one attack pipeline (loadout → runner → hit query → damage/status) serves every weapon in every level.
import { afterEach, expect, onTestFinished, test } from 'vitest';
import { ColliderDesc } from '@dimforge/rapier3d-compat';
import { action as rosterAction, catalog } from '../../src/data/actions/catalog';
import { action } from '../../src/data/actions/fixtures';
import type { ActionDef, Side } from '../../src/data/actions/schema';
import { comboDefinition } from '../../src/data/meleeCombos';
import { riotShieldResponse } from '../../src/data/infected';
import { Status } from '../../src/sim/combat/Status';
import type { CoverWall } from '../../src/sim/combat/HitQuery';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { checkRocketCadence, checkRocketEndpoints } from '../helpers/l7Uat';

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
const walls = (w: SimWorld) => w.combat!.query.walls as CoverWall[];
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

  // Mouse taps wait through recovery; keyboard/touch keep the existing 200 ms window.
  for (const mouseAttack of [true, false]) {
    const w = await arena(); equip(w);
    const tap = () => {
      w.setInput({ aim: { x: 1, z: 0 }, aimSource: 'pointer', mouseAttack, left: { down: true, held: false, up: true } });
      step(w, 1); w.clearInput();
    };
    const start = { ...w.entities.get(1)!.transform };
    tap();
    const first = w.combat!.runner.running.LEFT!;
    const ready = Math.max(first.endsAt, w.combat!.runner.loadout.current('LEFT').readyAt);
    expect(ready - w.tick).toBeGreaterThan(12);
    tap(); step(w, ready - w.tick + 1);
    expect(attacks(w).map(e => e.tick)).toEqual(mouseAttack ? [1, ready] : [1]);
    expect(w.entities.get(1)!.transform.x).toBe(start.x); expect(w.entities.get(1)!.transform.z).toBe(start.z);
  }
});

test('guns: held fire cadence, reload timing, infinite reserve and seeded, bounded, serialized spread', async () => {
  await checkRocketCadence();
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
  // An angled wreck's broad-phase corners are empty for movement and blasts alike.
  const rotated = await arena(); equip(rotated); rotated.combat!.damage.god = true;
  walls(rotated).push({ x: 0, y: 1, z: 0, halfX: 2.5, halfY: 1, halfZ: 2.5,
    navFootprint: { x: 0, z: 0, halfX: 3, halfZ: .4, yaw: Math.PI / 4 } });
  const clearCorner = dummy(rotated, 1, 2), solid = dummy(rotated, 0, 0);
  fire(rotated, 'RIGHT', { x: 3 / Math.sqrt(13), z: 2 / Math.sqrt(13) }, { x: 3, z: 2 }); step(rotated, 90);
  expect(health(rotated, clearCorner), 'no phantom blast cover in a free corner').toBeLessThan(100);
  expect(health(rotated, solid), 'the actual rotated hull still blocks the blast').toBe(100);

});

test('damage modifiers: front shield ±60°, armor and multipliers, stun/slow/toxic, capped burning stacks and water', async () => {
  for (const degrees of [-60, 0, 60, 61, 90, 180]) {
    const w = await arena(); equip(w, ['weapon.pistol']);
    const id = w.spawnDummy('infected.riot', { x: 3, z: 0 }, { yaw: Math.PI + degrees * Math.PI / 180 });
    fire(w); expect(health(w, id), `${degrees}°`).toBe(Math.abs(degrees) <= 60 ? 100 : 80);
    expect(w.events.events().some(event => event.type === 'combat.hit' && event.targetId === id && event.blocked), `${degrees}° block feedback`).toBe(Math.abs(degrees) <= 60);
  }
  const mg = await arena(); mg.loadScenario('horde-arena', 1); equip(mg, ['weapon.army-mg']);
  mg.scenario = 'L4';
  const riot = mg.infected!.spawn('infected.riot', { x: 3, z: 0 }, { yaw: Math.PI });
  const mgPlayer = mg.entities.get(1)!;
  // Place behind the shield, then land the campaign MG's 14-damage rounds at
  // its authored 10 rounds/s cadence: 17 rounds, 1.6 s first-to-last.
  Object.assign(mgPlayer.transform, { x: 5, z: 0 });
  for (let shot = 0; shot < 17; shot++) {
    mg.tick += 6;
    mg.combat!.damage.apply({ attackId: shot + 1, actionId: 'weapon.army-mg', sourceId: 1, targetId: riot,
      origin: mgPlayer.transform, direction: { x: -1, z: 0 }, base: 14, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
  }
  expect(health(mg, riot)).toBe(0);
  expect(mg.events.events().filter(event => event.type === 'combat.hit' && event.targetId === riot && event.amount > 0)).toHaveLength(17);
  expect(mg.events.events().some(event => event.type === 'combat.kill' && event.targetId === riot && event.downed === undefined)).toBe(true);
  expect(mg.entities.get(riot)!.infected!.recoverAt).toBe(-1);
  const front = await arena(); front.loadScenario('horde-arena', 1); equip(front, ['weapon.army-mg']); front.scenario = 'L4';
  const frontRiot = front.infected!.spawn('infected.riot', { x: 3, z: 0 }, { yaw: Math.PI });
  const frontPlayer = front.entities.get(1)!; Object.assign(frontPlayer.transform, { x: 0, z: 0 });
  const breakShot = Math.ceil(riotShieldResponse.breakStress / 14) - 1;
  const expectedFrontShots = breakShot + Math.ceil((front.entities.get(frontRiot)!.health.max - breakShot * 14 * .18) / 14);
  let frontKillTick = 0;
  for (let shot = 0; shot < 50 && health(front, frontRiot) > 0; shot++) {
    front.tick += 6;
    const amount = front.combat!.damage.apply({ attackId: shot + 1, actionId: 'weapon.army-mg', sourceId: 1, targetId: frontRiot,
      origin: frontPlayer.transform, shotOrigin: frontPlayer.transform, direction: { x: 1, z: 0 }, base: 14, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
    const hit = front.events.events().filter(event => event.type === 'combat.hit' && event.targetId === frontRiot).at(-1);
    if (shot < breakShot) { expect(amount, `front chip ${shot + 1}`).toBeCloseTo(14 * .18); expect(hit?.type === 'combat.hit' && hit.shieldGlance).toBe(true); }
    if (shot === breakShot) {
      expect(hit?.type === 'combat.hit' && hit.shieldBreak).toBe(true);
      expect(amount).toBe(14);
      expect(front.entities.get(frontRiot)!.combat!.shieldBrokenUntil).toBe(front.tick + 90);
    }
    if (health(front, frontRiot) === 0) frontKillTick = front.tick;
  }
  expect(health(front, frontRiot)).toBe(0);
  const frontSeconds = (frontKillTick - 6) / 60;
  // Exact damage accounting follows the authored shield strain; the acceptance
  // limit is <=6s, with no minimum duration or frontal/flank ratio requirement.
  expect(frontSeconds).toBeCloseTo((expectedFrontShots - 1) * .1);
  expect(frontSeconds).toBeLessThanOrEqual(6);
  const retired = front.entities.get(frontRiot)!;
  retired.combat!.shieldStress = 200; retired.combat!.shieldBrokenUntil = front.tick + 90;
  front.infected!.release(retired);
  const replacement = front.entities.get(front.infected!.spawn('infected.riot', { x: 3, z: 0 }))!;
  expect(replacement.combat!.shieldStress).toBeUndefined();
  expect(replacement.combat!.shieldBrokenUntil).toBeUndefined();
  const close = await arena(); close.loadScenario('horde-arena', 1); close.scenario = 'L4';
  const closeCases = [0.5, 1, 2, 5].flatMap(distance => ['front', 'side', 'back'].map(side => ({ distance, side })));
  for (const [index, probe] of closeCases.entries()) {
    const x = index * 10, id = close.spawnDummy('infected.riot', { x, z: 0 }, { yaw: 0 });
    const origin = probe.side === 'front' ? { x: x + probe.distance, z: 0 } : probe.side === 'side' ? { x, z: probe.distance } : { x: x - probe.distance, z: 0 };
    const amount = close.combat!.damage.apply({ attackId: index + 1, actionId: 'weapon.army-mg', sourceId: 1, targetId: id,
      origin, shotOrigin: origin, direction: { x: Math.sign(x - origin.x) || 0, z: Math.sign(-origin.z) || 0 }, base: 14, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
    const expected = probe.side !== 'front' || probe.distance <= 1.2 ? 14 : 14 * .18;
    expect(amount, `${probe.side} shot at ${probe.distance} m`).toBeCloseTo(expected);
    expect(health(close, id), `${probe.side} shot at ${probe.distance} m moves the bar`).toBeLessThan(100);
  }
  for (const distance of [.5, 1, 2, 5]) {
    const id = close.spawnDummy('infected.riot', { x: 0, z: distance * 10 }, { yaw: 0 });
    const origin = { x: 0, z: distance * 10 + distance };
    expect(close.combat!.damage.apply({ attackId: 50 + distance, actionId: 'weapon.bat', sourceId: 1, targetId: id,
      origin, direction: { x: 0, z: -1 }, base: 20, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 }), `melee at ${distance} m`).toBe(20);
  }
  for (const distance of [2, 5, 10]) for (const degrees of [0, 30, 60, 90, 135, 180]) {
    const x = 100 + distance * (degrees + 180), id = close.spawnDummy('infected.riot', { x, z: 0 }, { yaw: 0 });
    const radians = degrees * Math.PI / 180, origin = { x: x + distance * Math.cos(radians), z: -distance * Math.sin(radians) };
    const amount = close.combat!.damage.apply({ attackId: 1000 + x, actionId: 'weapon.army-mg', sourceId: 1, targetId: id,
      origin, shotOrigin: origin, direction: { x: -Math.cos(radians), z: Math.sin(radians) }, base: 14, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
    expect(amount, `${degrees}° off facing at ${distance} m`).toBeCloseTo(degrees <= 30 ? 14 * .18 : 14);
    const flight = await arena(); flight.scenario = 'L4'; equip(flight, ['weapon.army-mg']);
    const target = flight.spawnDummy('infected.riot', { x: distance, z: 0 }, { yaw: Math.PI + radians });
    fire(flight, 'LEFT', { x: 1, z: 0 }); step(flight, Math.ceil(distance / 95 * 60) + 5);
    expect(100 - health(flight, target), `actual projectile ${degrees}° at ${distance} m`).toBeCloseTo(degrees <= 30 ? 14 * .18 : 14);
  }
  const melee = await arena(); melee.loadScenario('horde-arena', 1); melee.scenario = 'L4'; equip(melee, ['weapon.bat']);
  const meleeRiot = melee.infected!.spawn('infected.riot', { x: 1, z: 0 });
  const meleeDamage = forehand().damage;
  for (let hit = 0; hit < 20 && health(melee, meleeRiot) > 0; hit++) {
    melee.tick += 30;
    melee.combat!.damage.apply({ attackId: hit + 1, actionId: 'weapon.bat', sourceId: 1, targetId: meleeRiot,
      origin: melee.entities.get(1)!.transform, direction: { x: 1, z: 0 }, base: meleeDamage, multiplier: 1, type: 'melee', knockback: 0, stagger: .2 });
  }
  expect(health(melee, meleeRiot)).toBe(0);
  expect(melee.entities.get(meleeRiot)!.infected!.recoverAt).toBe(-1);
  // The barrel can pass the shield at physical contact; a melee flinch opens
  // a frontal firing window until stagger expires. L5 retains its old shield.
  for (const level of ['L4', 'L5']) {
    const counter = await arena(); counter.scenario = level;
    const id = counter.spawnDummy('infected.riot', { x: 0, z: 0 }, { hp: 500, yaw: 0 });
    const target = counter.entities.get(id)!;
    const bullet = { attackId: 1, actionId: 'weapon.army-mg', sourceId: 1, targetId: id,
      origin: { x: 1.05, z: 0 }, direction: { x: -1, z: 0 }, base: 14, multiplier: 1, type: 'bullet' as const, knockback: 0, stagger: 0 };
    expect(counter.combat!.damage.apply(bullet), `${level} point blank`).toBe(level === 'L4' ? 14 : 0);
    bullet.origin.x = 3;
    expect(counter.combat!.damage.apply({ ...bullet, type: 'melee', actionId: 'weapon.bat', stagger: .5 })).toBe(14);
    expect(counter.combat!.damage.apply(bullet), `${level} stagger window`).toBe(level === 'L4' ? 14 : 0);
    counter.tick += 31;
    expect(counter.combat!.damage.apply(bullet), `${level} raised shield`).toBe(level === 'L4' ? 14 * .18 : 0);
    expect(counter.combat!.damage.apply({ ...bullet, type: 'explosive' })).toBe(14);
    expect(counter.combat!.damage.apply({ ...bullet, type: 'status', permanent: true })).toBe(14);
    expect(counter.combat!.damage.apply({ ...bullet, shotOrigin: { x: -3, z: 0 } }), `${level} launch-origin correction stays L4-only`).toBe(level === 'L4' ? 14 : 0);
    expect(target.combat!.shield).toBe(true);
    for (const distance of [3, 2.5, 1.5, 1.05, 1, .5]) {
      const flight = await arena(); flight.scenario = level; equip(flight, ['weapon.army-mg']);
      Object.assign(flight.entities.get(1)!.transform, { x: distance, z: 0 });
      const id = flight.spawnDummy('infected.riot', { x: 0, z: 0 });
      fire(flight, 'LEFT', { x: -1, z: 0 }); step(flight, 5);
      expect(health(flight, id), `${level} actual projectile from ${distance} m`).toBe(level === 'L4' ? distance < 1.15 ? 86 : 97.48 : 100);
    }
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
  await checkRocketEndpoints();
  await checkRocketSafety();
  {
    const w = await arena(), query = w.combat!.query;
    const wall: CoverWall = { x: 0, y: 1, z: 0, halfX: 2.5, halfY: 1, halfZ: 2.5,
      navFootprint: { x: 0, z: 0, halfX: 3, halfZ: .4, yaw: Math.PI / 4 } };
    for (const indexed of [false, true]) {
      walls(w).splice(0, walls(w).length, wall);
      if (indexed) for (let i = 0; i < 65; i++) walls(w).push({ x: 50 + i, y: 1, z: 50, halfX: .1, halfY: 1, halfZ: .1 });
      query.invalidate();
      expect(query.visible({ x: 3, z: 2 }, { x: 1, z: 2 }), `rotated free corner, indexed=${indexed}`).toBe(true);
      expect(query.visible({ x: -3, z: 0 }, { x: 3, z: 0 }), `rotated solid, indexed=${indexed}`).toBe(false);
      expect(query.wallDistance(wall, { x: 3, z: 2 }, { x: -1, z: 0 }, 2)).toBe(2);
    }
  }

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
  // The subway floor is raised: rifle projectiles must use their muzzle
  // height for every cover query, just as hitscan weapons do.
  for (const top of [1.2, 3]) {
    const w = await arena(); equip(w, ['weapon.army-mg']); const id = dummy(w, 5);
    w.physics.world!.createCollider(ColliderDesc.cuboid(1, .3, 1).setTranslation(0, .3, 0));
    w.physics.playerBody!.setTranslation({ x: 0, y: 1.32, z: 0 }, true);
    Object.assign(w.entities.get(1)!.transform, { x: 0, y: 1.32, z: 0 });
    walls(w).push({ x: 2, y: top / 2, z: 0, halfX: .1, halfY: top / 2, halfZ: 2 });
    fire(w); step(w, 15);
    expect(health(w, id), `raised-floor MG over ${top} m cover`).toBe(top === 1.2 ? 86 : 100);
  }
});

/** Shared launcher safety, exercised by the existing weapons battery. */
async function checkRocketSafety() {
  for (const reason of ['aim-point', 'enemy-cone'] as const) {
    const w = await arena(); equip(w, ['weapon.rocket-launcher']);
    if (reason === 'enemy-cone') dummy(w, 4, .5);
    fire(w, 'LEFT', { x: 1, z: 0 }, { x: reason === 'aim-point' ? 4 : 10, z: 0 });
    expect(attacks(w), reason).toHaveLength(0);
    expect(w.combat!.projectiles, reason).toHaveLength(0);
    expect(w.events.events()).toContainEqual(expect.objectContaining({ type: 'combat.empty', reason: 'too-close' }));
    expect(w.combat!.runner.loadout.current('LEFT').readyAt).toBeLessThan(w.tick + 50);
  }
  // A close enemy behind the courier does not block a distant forward shot.
  const armed = await arena(); equip(armed, ['weapon.rocket-launcher']); dummy(armed, -3);
  const far = dummy(armed, 7);
  fire(armed, 'LEFT', { x: 1, z: 0 }, { x: 10, z: 0 }); step(armed, 40);
  expect(health(armed, far)).toBeLessThan(100);
  const blasts = armed.events.events().filter(e => e.type === 'combat.exploded' && e.sourceId === 1);
  expect(blasts).toHaveLength(1);
  if (blasts[0].type === 'combat.exploded') expect(blasts[0].position.x).toBeGreaterThanOrEqual(5);
  // Cover and a zombie entering an already-fired rocket's path before arming
  // stop it without any blast or damage.
  for (const obstacle of ['wall', 'infected'] as const) {
    const w = await arena(); equip(w, ['weapon.rocket-launcher']);
    fire(w, 'LEFT', { x: 1, z: 0 }, { x: 10, z: 0 });
    const near = obstacle === 'infected' ? dummy(w, 3) : null;
    if (obstacle === 'wall') walls(w).push({ x: 3, y: 1, z: 0, halfX: .1, halfY: 1, halfZ: 1 });
    step(w, 40);
    expect(w.combat!.projectiles).toHaveLength(0);
    expect(w.events.events().some(e => e.type === 'combat.exploded')).toBe(false);
    if (near) expect(health(w, near)).toBe(100);
  }
}

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
