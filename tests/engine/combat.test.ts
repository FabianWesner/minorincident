// Combat core: one attack pipeline (loadout → runner → hit query → damage/status) serves every weapon in every level.
import { afterEach, expect, onTestFinished, test } from 'vitest';
import { ColliderDesc } from '@dimforge/rapier3d-compat';
import { action as rosterAction, catalog } from '../../src/data/actions/catalog';
import { action } from '../../src/data/actions/fixtures';
import type { ActionDef, Side } from '../../src/data/actions/schema';
import { comboDefinition } from '../../src/data/meleeCombos';
import { combatArchetypes } from '../../src/data/balance';
import { infectedDef, INFECTED_TOUGHNESS, riotShieldResponse } from '../../src/data/infected';
import { Status } from '../../src/sim/combat/Status';
import { moveAgent } from '../../src/sim/locomotion/AgentMotion';
import { motionResponse } from '../../src/sim/locomotion/MotionResponse';
import { Loadout } from '../../src/sim/combat/Loadout';
import { weaponKey } from '../../src/data/weaponKeys';
import { Explosions } from '../../src/sim/combat/Explosions';
import type { CoverWall } from '../../src/sim/combat/HitQuery';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { missionControls } from '../../src/sim/missions/controls';
import { loadLevel } from '../qa/invariants/world';
import { checkRocketCadence, checkRocketEndpoints } from '../helpers/l7Uat';
import { emptyInput } from '../../src/input/InputFrame';
import { weaponRoles } from '../../src/data/weaponRoles';
import { weaponName } from '../../src/data/weaponNames';

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
const soldierAlly = { role: 'soldier' as const, engaged: false, run: null, runSpeed: 2, post: null, hold: false, targetId: 0, nextAttack: 0, hits: 0, forceUntil: 0 };
/** s178: a living human (Civilians' component shape), optionally an allied fighter, for friendly-fire checks. */
function humanAt(w: SimWorld, x: number, z: number, extra: Partial<import('../../src/sim/npc/types').Civilian> = {}): number {
  const e = w.entities.create({
    kind: 'civilian', archetype: 'npc.adult', faction: 'civilian', transform: { x, y: .7, z, yaw: 0 }, health: { current: 100, max: 100 },
    civilian: { state: 'calm', ambient: true, adult: true, pet: null, owner: null, variant: 'a', routine: '', waypoints: [], waypoint: 0, pauseUntil: 0, entered: 0, until: 0, downTicks: 0, eyesGlow: false, veins: 0, attacker: 0, threat: { x, z }, path: [], goal: -1, pathIndex: 0, gore: false, knockedUntil: 0, ...extra },
  });
  w.spatial.set(e.id, x, z); return e.id;
}

function checkArsenalRoles(): void {
  const handgun = rosterAction('weapon.handgun'), assault = rosterAction('weapon.assault-rifle');
  // PO 2026-11-19 axe parity: one machete cut kills a design-table 40 HP ordinary infected
  // and its single-cut DPS equals the axe swing (45/0.4 s = 112.5 vs 56/0.5 s = 112).
  expect(rosterAction('weapon.machete').damage).toBeGreaterThanOrEqual(combatArchetypes.runner.hp);
  expect(Math.abs(rosterAction('weapon.machete').damage / rosterAction('weapon.machete').cooldown
    - rosterAction('weapon.fire-axe').damage / rosterAction('weapon.fire-axe').cooldown)).toBeLessThanOrEqual(1);
  expect(rosterAction('weapon.machete').cooldown).toBeLessThan(rosterAction('weapon.fire-axe').cooldown);
  const machete = rosterAction('weapon.machete'), axe = rosterAction('weapon.fire-axe');
  expect((machete.damage / machete.cooldown) / (axe.damage / axe.cooldown)).toBeCloseTo(1, 2);
  expect(rosterAction('weapon.nail-gun').damage * 3).toBeGreaterThanOrEqual(40);
  expect(rosterAction('weapon.nail-gun').damage * rosterAction('weapon.nail-gun').fireRate).toBeGreaterThan(handgun.damage * handgun.fireRate);
  expect(rosterAction('weapon.hunting-rifle').damage).toBeGreaterThanOrEqual(300);
  expect(rosterAction('weapon.hunting-rifle').range).toBe(40);
  expect(rosterAction('weapon.hunting-rifle').projectile?.pierce).toBe(2);
  expect(assault.damage * assault.fireRate).toBeGreaterThan(handgun.damage * handgun.fireRate);
  expect(rosterAction('weapon.molotov').effect?.duration).toBeGreaterThanOrEqual(6);
  expect(rosterAction('weapon.molotov').status?.dps).toBeGreaterThanOrEqual(20);
  const molotov = rosterAction('weapon.molotov'), rocket = rosterAction('weapon.rocket-launcher');
  expect(molotov.damage).toBe(rocket.damage * 0.75);
  expect(molotov.splash).toEqual({ radius: rocket.splash!.radius * 0.75, falloff: rocket.splash!.falloff });
  expect(rosterAction('weapon.pipe-bomb').damage).toBeGreaterThan(0);
  expect(rosterAction('weapon.flashbang').status?.kind).toBe('stunned');
  expect(rosterAction('weapon.flashbang').splash?.radius).toBe(7);
  expect(rosterAction('weapon.rocket-launcher').knockdown).toBe(true);
  expect(rosterAction('weapon.nail-gun').damage).toBe(14);
  expect(rosterAction('weapon.flamethrower')).toMatchObject({ range: 8, fireRate: 15, magazine: 90, reloadTime: 5, status: { duration: 4, dps: 35 } });
  expect(weaponRoles['weapon.flamethrower']).toBe('Melt crowds up close');
  expect(rosterAction('weapon.flamethrower').status?.kind).toBe('burning');
}

async function checkMolotovCluster(): Promise<void> {
  const w = await arena(); equip(w, ['weapon.fire-axe'], ['weapon.molotov']);
  const ids = [-1.2, -0.6, 0, 0.6, 1.2].map(z => dummy(w, 2, z, infectedDef('infected.runner').hp * INFECTED_TOUGHNESS));
  fire(w, 'RIGHT', { x: 1, z: 0 }, { x: 2, z: 0 });
  for (let i = 0; i < 60 && !w.combat!.effects.zones.some(z => z.kind === 'fire'); i++) step(w, 1);
  const zone = w.combat!.effects.zones.find(z => z.kind === 'fire');
  expect(zone).toBeDefined(); if (!zone) throw new Error('Molotov fire patch did not land'); step(w, 120);
  expect(ids.map(id => health(w, id))).toEqual([0, 0, 0, 0, 0]);
  expect(zone.expires - zone.created).toBeGreaterThanOrEqual(8 * 60);
}

async function checkFlameCluster(): Promise<void> {
  const w = await arena(); equip(w, ['weapon.flamethrower']);
  const ids = [-0.3, -0.15, 0, 0.15, 0.3].map(z => dummy(w, 2, z, infectedDef('infected.runner').hp * INFECTED_TOUGHNESS));
  fire(w); step(w, 180);
  expect(ids.map(id => health(w, id))).toEqual([0, 0, 0, 0, 0]);
  const stream = await arena(); equip(stream, ['weapon.flamethrower']);
  const near = dummy(stream, 3, 0, 40), behind = dummy(stream, 5, 0, 40);
  stream.setInput({ aim: { x: 1, z: 0 }, left: { down: true, held: true, up: false } });
  step(stream, 45);
  expect([health(stream, near), health(stream, behind)], 'the held stream melts both exposed bodies in about 0.6 s plus the gun raise').toEqual([0, 0]);
  const spread = await arena(), burning = spread.entities.get(dummy(spread, 5, 0, 200))!, touching = spread.entities.get(dummy(spread, 5.5, 0, 200))!;
  spread.combat!.status.apply(burning, rosterAction('weapon.flamethrower').status!, 1, 'weapon.flamethrower');
  step(spread, 30);
  expect(touching.combat!.statuses.some(status => status.kind === 'burning')).toBe(true);
}

async function checkFireAshPersistence(): Promise<void> {
  const flash = await arena(); equip(flash, ['weapon.fire-axe'], ['weapon.flashbang']);
  fire(flash, 'RIGHT', { x: 1, z: 0 }, { x: 2, z: 0 }); step(flash, 150);
  expect(flash.events.events().some(event => event.type === 'combat.exploded' && event.actionId === 'weapon.flashbang')).toBe(true);
  const w = await loadLevel('L1', 1); worlds.push(w);
  const id = w.infected!.spawn('infected.runner', { x: 4, z: 4 }), target = w.entities.get(id)!;
  w.combat!.damage.apply({ attackId: 1, actionId: 'weapon.flamethrower', sourceId: 1, targetId: id, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: target.health.current, multiplier: 1, type: 'bullet', permanent: true, knockback: 0, stagger: 0 });
  step(w, 1);
  expect(target.ashDeath).toEqual({ at: w.tick - 1 }); expect(target.infected!.recoverAt).toBe(-1); expect(target.infected!.state).toBe('dead');
  const other = w.infected!.spawn('infected.runner', { x: 6, z: 4 }), body = w.entities.get(other)!;
  w.combat!.damage.apply({ attackId: 2, actionId: 'weapon.handgun', sourceId: 1, targetId: other, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: body.health.current, multiplier: 1, type: 'bullet', permanent: true, knockback: 0, stagger: 0 });
  expect(body.ashDeath).toBeUndefined();
  const grabberId = w.infected!.spawn('infected.lion', { x: 8, z: 4 }), grabber = w.entities.get(grabberId)!;
  const player = w.entities.get(1)!, releaseAt = w.tick + 120, hp = grabber.health.current;
  grabber.infected!.grabUntil = releaseAt; grabber.infected!.heardTargetId = player.id;
  player.combat!.staggerUntil = releaseAt; w.npcs!.civilians.hold(grabberId);
  w.combat!.status.apply(grabber, rosterAction('weapon.flashbang').status!, 1, 'weapon.flashbang');
  expect(grabber.infected!.grabUntil).toBe(0); expect(player.combat!.staggerUntil).toBe(w.tick);
  expect(w.npcs!.civilians.holds(grabberId)).toBe(false); expect(grabber.health.current).toBe(hp);
  expect(Status.stunned(grabber, w.tick)).toBe(true);
}

async function checkWeaponControlRoles(): Promise<void> {
  const w = await arena(); equip(w, ['weapon.nail-gun']);
  const pinned = dummy(w, 2, 0, 100); fire(w); step(w, 4);
  expect(w.entities.get(pinned)?.combat?.statuses.find(status => status.kind === 'pinned')?.expires).toBeGreaterThan(w.tick);
  expect(Status.speed(w.entities.get(pinned)!)).toBe(0);
  const target = w.entities.get(pinned)!;
  target.locomotion = motionResponse(); target.locomotion.vx = 5;
  const before = target.transform.x;
  moveAgent(target, 5, 0, w.combat!.query as never, w.tick, .4, true);
  expect(target.transform.x).toBe(before); expect(target.locomotion.vx).toBe(0);
  w.knockback(target, { x: 1, z: 0 }, 2);
  expect(target.transform.x).toBe(before);
  w.entities.delete(pinned); w.spatial.delete(pinned);
  w.entities.get(1)!.transform.x = -10; w.spatial.set(1, -10, 0);
  const mgTarget = dummy(w, 11, 0, 100); w.entities.get(mgTarget)!.combat!.radius = 2; equip(w, ['weapon.army-mg']); fire(w); step(w, 20);
  expect(w.entities.get(mgTarget)!.health.current).toBeLessThan(100);
  expect(w.entities.get(mgTarget)?.combat?.statuses.find(status => status.kind === 'slowed')).toBeUndefined();
}

async function checkPinnedVault(): Promise<void> {
  const w = await loadLevel('L1', 1, 'low'); worlds.push(w);
  const climber = w.entities.get(w.infected!.spawn('infected.runner', { x: 2, z: 0 }))!;
  climber.infected!.vault = { started: w.tick, from: { x: 2, z: 0 }, to: { x: 4, z: 0 }, height: 1 };
  w.tick += 25; w.barricades!.vault(climber);
  const before = { ...climber.transform }, started = climber.infected!.vault!.started;
  w.combat!.status.apply(climber, { kind: 'pinned', duration: 2, maxStacks: 1, dps: 0, slow: 1 }, 1, 'weapon.nail-gun', 1);
  w.barricades!.vault(climber); w.barricades!.vault(climber); // Multiple callers in one tick must not extend the pause.
  w.tick += 120; w.barricades!.vault(climber);
  expect(climber.infected!.vault!.started).toBe(started + 120);
  expect(climber.transform.x).toBeCloseTo(before.x);
  expect(climber.transform.y).toBeCloseTo(before.y);
  w.tick += 35; w.barricades!.vault(climber);
  expect(climber.infected!.vault).toBeUndefined();
  expect(climber.transform.x).toBeCloseTo(4);
}

async function checkBlastClusters(): Promise<void> {
  // Compare the actual splash resolvers at equal distances inside the smaller blast.
  for (const distance of [0, 1, 3, 4.4, 4.6]) {
    const losses: number[] = [];
    for (const id of ['weapon.rocket-launcher', 'weapon.molotov']) {
      const w = await arena(), def = rosterAction(id);
      walls(w).length = 0;
      const target = dummy(w, 10 + distance, 0, 1000);
      const tick = w.tick;
      w.combat!['splash']({ id: 1, sourceId: 1, side: 'RIGHT', def, combo: 0, inPlace: false, aim: { x: 1, z: 0 }, aimPoint: null, started: tick, activeAt: tick, recoveryAt: tick, endsAt: tick, resolved: true, hit: new Set() }, { x: 10, z: 0 });
      losses.push(1000 - health(w, target));
    }
    if (distance > 4.5) { expect(losses[0]).toBeGreaterThan(0); expect(losses[1]).toBe(0); }
    else expect(losses[1]).toBeCloseTo(losses[0] * .75, 5);
  }
  for (const id of ['weapon.pipe-bomb', 'weapon.rocket-launcher']) {
    const w = await arena(); equip(w, ['weapon.fire-axe'], [id]);
    const ids = [-1.2, -0.6, 0, 0.6, 1.2].map(z => dummy(w, 2, z, infectedDef('infected.runner').hp * INFECTED_TOUGHNESS));
    if (id === 'weapon.rocket-launcher') w.explosions!.blast('explosion.rocket', { x: 2, z: 0 }, { sourceId: 1, actionId: id, radius: 6 });
    else fire(w, 'RIGHT', { x: 1, z: 0 }, { x: 2, z: 0 });
    step(w, 180);
    expect(ids.map(target => health(w, target)), id).toEqual([0, 0, 0, 0, 0]);
  }
}

/** Broad-phase cover must agree with the exact wall tests, including rotated padding and mutable doors. */
async function checkDynamicCover(): Promise<void> {
  const w = await arena(), q = w.combat!.query, devices = w.interactables!;
  for (let i = 0; i < 100; i++) {
    const x = Math.sin(i * 2.4) * 40, z = Math.cos(i * 1.7) * 40, yaw = i * .37;
    const hx = .3 + i % 4, hz = .2 + i % 3, c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    devices.block(-9000 - i, { x, z, y: 1, halfX: c * hx + s * hz, halfZ: s * hx + c * hz, halfY: 1,
      navFootprint: { x, z, halfX: hx, halfZ: hz, yaw } });
  }
  const compare = () => {
    for (let i = 0; i < 512; i++) {
      const origin = { x: Math.sin(i * 1.23) * 48, z: Math.cos(i * 2.17) * 48, y: .7 + i % 3 };
      const direction = { x: Math.cos(i * .83), z: Math.sin(i * .83), y: (i % 5 - 2) * .03 }, range = 1 + i % 80;
      const padding = i % 2 ? .6 : 0, ignoreId = i % 3 ? undefined : -9000 - i % 100;
      const exact = [...q.walls, ...q.dynamicWalls].reduce((distance, wall) => wall.entityId !== undefined && wall.entityId === ignoreId ? distance : Math.min(distance, q.wallDistance(wall, origin, direction, range, padding)), range);
      expect(q.clearDistance(origin, direction, range, ignoreId, padding), `dynamic ray ${i}`).toBeCloseTo(exact, 8);
    }
  };
  compare();
  // Same-length replacement with unchanged first/last entries must still retire the old buckets.
  devices.unblock(-9050); devices.block(-9100, { x: 8, z: 0, y: 1, halfX: .1, halfZ: 2, halfY: 1 });
  compare();
  devices.rebuildBlockers(); compare();
}

/** Fuel is a real, cover-clipped hazard that persists after trigger release. */
async function checkFlamethrowerFuel(): Promise<void> {
  const w = await arena(); equip(w, ['weapon.flamethrower']);
  walls(w).push({ x: 3, y: 1, z: 0, halfX: .1, halfY: 1, halfZ: 4 });
  fire(w);
  const patch = [...w.entities.iterate()].find(e => e.hazard?.fuelPatch)!;
  expect(attacks(w)).toHaveLength(1);
  expect(patch).toBeDefined();
  expect(patch.transform.x).toBeGreaterThan(2.6);
  expect(patch.transform.x).toBeLessThan(2.9);
  const enemy = dummy(w, patch.transform.x, patch.transform.z);
  step(w, 60);
  expect(health(w, enemy)).toBeLessThan(100);
  expect(patch.hazard!.activeUntil).toBeGreaterThan(w.tick);
  step(w, 180);
  expect(patch.hazard!.activeUntil).toBeLessThanOrEqual(w.tick);
}

async function checkFuelPool(): Promise<void> {
  const w = await arena(), hazards = w.hazards!;
  const first = hazards.ignitePatch({ x: 10, z: 0 }, .65, 3)!;
  step(w, 60);
  expect(hazards.ignitePatch({ x: 10.1, z: 0 }, .65, 3)).toBe(first);
  expect(w.entities.get(first)!.hazard!.activeUntil).toBe(w.tick + 180);
  step(w, 181);
  expect(hazards.ignitePatch({ x: 12, z: 0 }, .65, 3)).toBe(first);
  for (let i = 1; i < Explosions.maxFires; i++) hazards.spawn('fire', { x: 30 + i * 3, z: 30 });
  expect(hazards.ignitePatch({ x: -12, z: 0 }, .65, 3)).toBeNull();
}

async function checkRaisedMountedGun(): Promise<void> {
  for (const covered of [false, true]) {
    const w = await arena(), p = w.entities.get(1)!;
    p.transform.y = 3.7;
    const target = dummy(w, 10), gun = w.installMountedGun({ x: 0, y: 3, z: 0, yaw: 0 });
    if (covered) walls(w).push({ x: 5, y: 2.5, z: 0, halfX: .5, halfY: 2.5, halfZ: 2 });
    const input = emptyInput(); input.interact = true; input.aim = { x: 1, z: 0 }; input.right.held = true;
    gun.intent(input, input);
    expect(gun.mounted).toBe(true);
    for (let tick = 0; tick < 90; tick++) gun.update();
    expect(health(w, target), covered ? 'wall blocks the downhill shot' : 'gunner can defend the street below').toBe(covered ? 100 : 0);
    expect(attacks(w).some(event => event.type === 'combat.attack' && (event.direction.y ?? 0) < 0), 'shot presentation carries the barrel pitch').toBe(!covered);
  }
}

test('loadout: both sides keep independent aims, racks wrap both ways with a switch lock, a cooling gun does not steal selection', async () => {
  expect(['weapon.army-mg', 'weapon.hunting-rifle', 'weapon.nail-gun', 'weapon.molotov', 'weapon.pipe-bomb'].map(weaponName))
    .toEqual(['Army MG', 'Hunting Rifle', 'Nail Gun', 'Molotov Cocktail', 'Pipe Bomb']);
  expect(rosterAction('ability.corgi-lure')).toMatchObject({ range: 15, cooldown: 12, effect: { kind: 'lure', duration: 5, radius: 15 } });
  expect(weaponRoles['ability.corgi-lure']).toContain('5 seconds');
  await checkCorgiLure();
  checkArsenalRoles(); await checkPinnedVault(); await checkMolotovCluster(); await checkFlameCluster(); await checkFireAshPersistence(); await checkWeaponControlRoles(); await checkBlastClusters();
  const rifle = await arena(); equip(rifle, ['weapon.hunting-rifle']);
  const rifleHp = infectedDef('infected.runner').hp * INFECTED_TOUGHNESS;
  const pierced = [dummy(rifle, 2, 0, rifleHp), dummy(rifle, 4, 0, rifleHp)];
  fire(rifle); step(rifle, 60);
  expect(pierced.map(id => health(rifle, id)), 'one rifle projectile pierces one infected and kills both ordinary targets').toEqual([0, 0]);
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

  for (const previousWeapon of ['weapon.fire-axe', 'weapon.handgun', 'weapon.machete', 'weapon.hunting-rifle']) {
    const throwable = await arena(); equip(throwable, [previousWeapon], ['weapon.molotov']);
    throwable.setInput({ selectorSide: 'RIGHT', aim: { x: 1, z: 0 }, right: { down: true, held: false, up: true } }); step(throwable, 1); throwable.clearInput();
    const loadout = throwable.combat!.runner.loadout, molotov = loadout.state.RIGHT.rack[0];
    expect(molotov.charges).toBe(1);
    expect(loadout.current(loadout.state.selectedSide).id).toBe('weapon.molotov');
    step(throwable, 20);
    throwable.setInput({ aim: { x: 1, z: 0 }, right: { down: true, held: false, up: true } }); step(throwable, 1); throwable.clearInput();
    expect(molotov.charges).toBe(0);
    // PO 2026-11-19/20: a recharging throwable stays selected after its last charge (no switch back to melee).
    expect(loadout.current(loadout.state.selectedSide).id, `not back to ${previousWeapon}`).toBe('weapon.molotov');
  }
  const sameRack = await arena(); equip(sameRack, ['weapon.fire-axe'], ['weapon.hunting-rifle', 'weapon.molotov']);
  const sameLoadout = sameRack.combat!.runner.loadout;
  const choose = (id: string) => weaponKey(id)!;
  sameRack.setInput({ selectedWeaponKey: choose('weapon.hunting-rifle') }); step(sameRack, 1); sameRack.clearInput(); step(sameRack, 15);
  sameRack.setInput({ selectedWeaponKey: choose('weapon.molotov') }); step(sameRack, 1); sameRack.clearInput(); step(sameRack, 15);
  fire(sameRack, 'RIGHT'); step(sameRack, 20); fire(sameRack, 'RIGHT');
  expect(sameLoadout.current(sameLoadout.state.selectedSide).id).toBe('weapon.molotov');
  const prior = new Loadout(['weapon.fire-axe'], ['weapon.molotov', 'weapon.pipe-bomb']);
  prior.input({ ...emptyInput(), selectedActiveSlot: prior.activeEntries().findIndex(e => e.id === 'weapon.molotov') }, 30);
  prior.state.RIGHT.rack[0].charges = 0;
  prior.input({ ...emptyInput(), selectedActiveSlot: prior.activeEntries().findIndex(e => e.id === 'weapon.pipe-bomb') }, 60);
  const snapshot = structuredClone(prior.state);
  const restored = new Loadout(['weapon.fire-axe'], ['weapon.molotov', 'weapon.pipe-bomb']);
  Object.assign(restored.state, snapshot);
  restored.state.RIGHT.rack[1].charges = 1;
  restored.spend('RIGHT', 90, restored.definition('weapon.pipe-bomb'), false);
  expect(restored.current(restored.state.selectedSide).id).toBe(restored.definition('weapon.pipe-bomb').recharge ? 'weapon.pipe-bomb' : 'weapon.fire-axe');
});

test('melee: the swing hits inside its arc/range once per target and respects maxTargets', async () => {
  const bat = catalog['weapon.bat'] as ActionDef, sweep = bat.roundhouse; delete bat.roundhouse; // the crowd roundhouse would take over with seven in reach
  onTestFinished(() => { bat.roundhouse = sweep; });
  const w = await arena(); equip(w);
  const rad = (d: number) => d * Math.PI / 180;
  const inside = [dummy(w, 1), dummy(w, 1.9 * Math.cos(rad(49)), 1.9 * Math.sin(rad(49))), dummy(w, 1.9 * Math.cos(rad(-50)), 1.9 * Math.sin(rad(-50)))];
  const outside = [dummy(w, 1.91), dummy(w, Math.cos(rad(51)), Math.sin(rad(51))), dummy(w, -1)];
  const raised = dummy(w, 1.2); w.entities.get(raised)!.transform.y += 1.2;
  const capped = dummy(w, 1.1);
  fire(w); step(w, 29);
  for (const id of inside) expect(health(w, id)).toBe(100 - forehand().damage);
  for (const id of [...outside, capped]) expect(health(w, id)).toBe(100);
  expect(health(w, raised), 'a nearby enemy on a raised support is outside reach').toBe(100);
  const hits = w.events.events().filter(e => e.type === 'combat.hit');
  expect(hits).toHaveLength(3);
  for (const id of inside) expect(hits.filter(e => e.type === 'combat.hit' && e.targetId === id)).toHaveLength(1);

  // The displayed swing must retain this committed direction when the live
  // pointer reverses during windup (ActionView consumes runner.running aim).
  const turning = await arena(); equip(turning, ['weapon.fire-axe']);
  const east = dummy(turning, 1.1, 0, 1000), west = dummy(turning, -1.1, 0, 1000);
  turning.setInput({ aim: { x: 1, z: 0 }, left: { down: true, held: true, up: false } }); step(turning, 1);
  const committed = turning.combat!.runner.running.LEFT!;
  turning.setInput({ aim: { x: -1, z: 0 }, left: { down: false, held: false, up: false } });
  step(turning, committed.activeAt - turning.tick);
  expect(turning.combat!.runner.loadout.state.LEFT.aim.x).toBe(-1);
  expect(committed.aim.x).toBe(1);
  expect(health(turning, east)).toBeLessThan(1000);
  expect(health(turning, west)).toBe(1000);

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

  // s178 Hard (PO 2026-11-19 "friendly fire hurts them and me"): the courier's bat and bullets hit living
  // humans (allied soldiers, civilians, escorts; never the corgi, pets or zoo animals). Simple never targets them.
  for (const difficulty of ['simple', 'hard'] as const) {
    const fireWorld = await arena(); fireWorld.difficulty = difficulty;
    const ally = humanAt(fireWorld, 1.4, 0, { ally: soldierAlly }), civilian = humanAt(fireWorld, 2, 3);
    equip(fireWorld, ['weapon.bat'], ['weapon.pistol']);
    fire(fireWorld, 'RIGHT', { x: 2 / Math.hypot(2, 3), z: 3 / Math.hypot(2, 3) });
    fire(fireWorld); step(fireWorld, 30);
    expect(health(fireWorld, ally), `${difficulty}: the bat and an allied soldier`).toBe(difficulty === 'hard' ? 78 : 100);
    expect(health(fireWorld, civilian), `${difficulty}: the pistol and a civilian`).toBe(difficulty === 'hard' ? 80 : 100);
  }
});

test('guns: held fire cadence, reload timing, infinite reserve and seeded, bounded, serialized spread', async () => {
  await checkPointBlankCombat();
  await checkRocketCadence();
  const w = await arena(); equip(w, ['weapon.pistol']); dummy(w, 5, 0, 10000);
  w.setInput({ aim: { x: 1, z: 0 }, left: { down: false, held: true, up: false } }); step(w, 82);
  const slot = w.combat!.runner.loadout.state.LEFT.rack[0];
  // PO 2026-11-20: an empty magazine reloads in hand (no switch back to fists while it reloads).
  expect(w.combat!.runner.loadout.current('LEFT').id).toBe('weapon.pistol');
  expect(attacks(w).map(e => e.tick)).toEqual([7, 22, 37, 52, 67, 82]);
  expect(slot.magazine).toBe(0); expect(slot.reloadUntil).toBe(142); expect(slot.reserve).toBe('infinite');
  w.clearInput(); step(w, 60); expect(slot.magazine).toBe(6);

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
// Loads the authored L3 bridge natively; a shared 2-vCPU runner needs more than the 30 s default.
}, 90_000);

async function checkPointBlankCombat() {
  // An infected can overlap the courier in a crowd. Neither a gun muzzle at
  // the target nor a melee strike at body-contact distance has a minimum range.
  for (const weapon of ['weapon.handgun', 'weapon.fire-axe']) {
    const w = await arena(); equip(w, [weapon]);
    const id = dummy(w, 0.1, 0, 1000);
    w.setInput({ aim: { x: 1, z: 0 }, aimPoint: { x: 0.1, z: 0 }, left: { down: true, held: true, up: false } });
    step(w, 480); w.clearInput();
    const events = w.events.events(), shots = events.filter(event => event.type === 'combat.attack' && event.sourceId === 1 && event.actionId === weapon);
    const hits = events.filter(event => event.type === 'combat.hit' && event.sourceId === 1 && 'targetId' in event);
    const trace = shots.map(shot => shot.type === 'combat.attack' ? {
      tick: shot.tick, weapon: shot.actionId, aim: shot.direction,
      targetChosen: weapon === 'weapon.handgun'
        ? w.combat!.query.ray(1, { ...shot.position, y: shot.position.y + .45 }, shot.direction, rosterAction(weapon).range)?.id ?? null
        : w.combat!.query.melee(1, shot.position, shot.direction, rosterAction(weapon).range, rosterAction(weapon).arc, rosterAction(weapon).maxTargets).map(target => target.id),
      hitIds: hits.filter(hit => hit.type === 'combat.hit' && hit.attackId === shot.attackId && 'targetId' in hit).map(hit => 'targetId' in hit ? hit.targetId : null),
    } : null);
    expect(shots.length, `${weapon} attack trace`).toBeGreaterThan(0);
    expect(health(w, id), `${weapon} 8s trace: ${JSON.stringify(trace)}`).toBeLessThan(1000);
    expect(hits.some(hit => hit.type === 'combat.hit' && 'targetId' in hit && hit.targetId === id), `${weapon} attack trace`).toBe(true);
  }
  // Repeat the handgun case with the authored L3 bridge, its rail cover and
  // campaign mission composition loaded natively (no renderer or browser).
  const bridge = await loadLevel('L3', 1, 'high'); worlds.push(bridge);
  missionControls(bridge).teleport('player', { x: 169.548, z: -0.942 });
  equip(bridge, ['weapon.handgun']);
  const bridgeTarget = bridge.infected!.spawn('infected.runner', { x: 169.648, z: -0.942 });
  const bridgeHp = health(bridge, bridgeTarget);
  expect(bridge.entities.get(bridgeTarget)!.transform.y, 'real infected spawns on bridge deck').toBeCloseTo(6.4);
  const bridgeTrace: { attackId: number; tick: number; weapon: string; aim: { x: number; z: number }; targetChosen: number | null; hitIds: number[]; noDamageReason: string | null }[] = [];
  bridge.events.on('combat.attack', event => {
    if (event.type !== 'combat.attack' || event.sourceId !== 1 || event.actionId !== 'weapon.handgun') return;
    const origin = { ...event.position, y: event.position.y + .45 }, def = rosterAction('weapon.handgun');
    const chosen = bridge.combat!.query.ray(1, origin, event.direction, def.range);
    const wall = bridge.combat!.query.clearDistance(origin, event.direction, def.range);
    bridgeTrace.push({ attackId: event.attackId, tick: event.tick, weapon: event.actionId, aim: event.direction, targetChosen: chosen?.id ?? null, hitIds: [],
      noDamageReason: chosen ? chosen.id === bridgeTarget ? 'damage-rejected-after-hit-test' : 'another-body-intercepted-ray' : wall < def.range ? 'bridge-cover-blocked-ray' : 'aim-ray-missed-all-targets' });
  });
  bridge.events.on('combat.hit', event => {
    if (event.type !== 'combat.hit' || event.sourceId !== 1 || !('targetId' in event)) return;
    const shot = bridgeTrace.find(row => row.attackId === event.attackId);
    if (shot) { shot.hitIds.push(event.targetId); shot.noDamageReason = null; }
  });
  bridge.setInput({ aim: { x: 1, z: 0 }, aimPoint: { x: 169.648, z: -0.942 }, left: { down: true, held: true, up: false } });
  step(bridge, 480); bridge.clearInput();
  const bridgeEvents = bridge.events.events(), bridgeShots = bridgeEvents.filter(event => event.type === 'combat.attack' && event.sourceId === 1 && event.actionId === 'weapon.handgun');
  expect(bridgeTrace.length, 'each native bridge handgun discharge was traced at its attack tick').toBe(bridgeShots.length);
  expect(health(bridge, bridgeTarget), `native L3 bridge handgun trace; player=${JSON.stringify(bridge.entities.get(1)!.transform)} target=${JSON.stringify(bridge.entities.get(bridgeTarget)!.transform)} shots=${bridgeShots.length} trace=${JSON.stringify(bridgeTrace)}`).toBeLessThan(bridgeHp);

  // The hit path is shared campaign-wide. Run the same three-second native
  // point-blank probe at each other on-foot level's player start. L9 starts
  // inside its APC and has no carried-weapon attack until the forced crash.
  for (const level of ['L1', 'L2', 'L4', 'L5', 'L6', 'L7', 'L8', 'L10'] as const) {
    const w = await loadLevel(level, 1, 'high'); worlds.push(w);
    const p = w.entities.get(1)!;
    missionControls(w).teleport('player', { x: p.transform.x, z: p.transform.z });
    const at = { x: p.transform.x + .1, z: p.transform.z };
    equip(w, ['weapon.handgun']);
    const target = w.infected!.spawn('infected.runner', at);
    const initialHp = health(w, target);
    w.storyLock = null; w.missions!.state.phase = 'playing'; w.missions!.state.cinematic = null;
    w.setInput({ aim: { x: 1, z: 0 }, aimPoint: at, left: { down: true, held: true, up: false } });
    for (let tick = 0; tick < 180; tick++) {
      const e = w.entities.get(target)!, dx = e.transform.x - p.transform.x, dz = e.transform.z - p.transform.z, distance = Math.hypot(dx, dz) || 1;
      w.setInput({ aim: { x: dx / distance, z: dz / distance }, aimPoint: { x: e.transform.x, z: e.transform.z }, left: { down: tick === 0, held: true, up: false } });
      w.update();
    }
    w.clearInput();
    const shots = w.events.events().filter(event => event.type === 'combat.attack' && event.sourceId === 1 && event.actionId === 'weapon.handgun');
    const first = shots.find(event => event.type === 'combat.attack');
    const ray = first?.type === 'combat.attack' ? w.combat!.query.ray(1, { ...first.position, y: first.position.y + .45 }, first.direction, rosterAction('weapon.handgun').range) : null;
    expect(health(w, target), `${level} native 3s point-blank handgun aim=${JSON.stringify(at)} player=${JSON.stringify(p.transform)} target=${JSON.stringify(w.entities.get(target)!.transform)} attacks=${shots.length} ray=${ray?.id ?? null}`).toBeLessThan(initialHp);
  }
  // Controlled contact probes cover L5, L6 and L8. At the L7 start, allied
  // soldiers kill the spawned runner before the axe's first active tick; that
  // window is recorded as intercepted, not misreported as courier damage.
  // L9 is vehicle-only before its scripted crash/crawl; L10's farm is below.
  for (const level of ['L5', 'L6', 'L8'] as const) {
    const w = await loadLevel(level, 1, 'high'); worlds.push(w);
    const p = w.entities.get(1)!, start = { x: p.transform.x, z: p.transform.z };
    let at: { x: number; z: number } | undefined;
    for (let radius = 1; radius <= 8 && !at; radius++) for (let side = -1; side <= 1 && !at; side += 2) {
      const candidate = { x: start.x + radius * 1.1, z: start.z + side * radius * .1 };
      if (w.infected!.nav.cell(candidate.x, candidate.z) >= 0) at = candidate;
    }
    expect(at, `${level} has a resident start contact cell`).toBeDefined();
    if (!at) throw new Error(`${level} has no start contact cell`);
    missionControls(w).teleport('player', { x: at.x - 1.1, z: at.z });
    if (w.chunks) w.chunks.update([at.x, at.z]);
    equip(w, ['weapon.fire-axe']);
    const target = w.infected!.spawn('infected.runner', at), hp = health(w, target);
    w.combat!.status.apply(w.entities.get(target)!, { kind: 'stunned', duration: 9, maxStacks: 1, dps: 0, slow: 0 }, 1, 'qa.melee-contact');
    let courierHit = false;
    w.events.on('combat.hit', event => { if (event.type === 'combat.hit' && event.sourceId === 1 && event.targetId === target) courierHit = true; });
    for (let tick = 0; tick < 480; tick++) {
      const source = w.entities.get(1)!, enemy = w.entities.get(target)!;
      const dx = enemy.transform.x - source.transform.x, dz = enemy.transform.z - source.transform.z, distance = Math.hypot(dx, dz) || 1;
      w.setInput({ aim: { x: dx / distance, z: dz / distance }, aimPoint: { x: enemy.transform.x, z: enemy.transform.z }, left: { down: tick === 0, held: true, up: false } });
      w.update();
    }
    w.clearInput();
    expect(courierHit, `${level} courier melee hit event`).toBe(true);
    expect(health(w, target), `${level} native 8s fire-axe contact probe`).toBeLessThan(hp);
  }

  // The batch-113 symptom is melee at the farm shed, so exercise the authored
  // L10 surface and real infected spawn with normal eight-second attack input.
  const farm = await loadLevel('L10', 1, 'high'); worlds.push(farm);
  missionControls(farm).teleport('player', { x: 1170, z: -26 }); farm.chunks!.update([1170, -26]);
  let farmAt: { x: number; z: number } | undefined, bestFarmDistance = Infinity;
  for (let x = 1120; x <= 1220; x++) for (let z = -60; z <= 10; z++) if (farm.infected!.nav.clear(x, z, .35)) {
    const distance = (x - 1170) ** 2 + (z + 26) ** 2;
    if (distance < bestFarmDistance) { bestFarmDistance = distance; farmAt = { x, z }; }
  }
  expect(farmAt, 'an open L10 farm walk surface').toBeDefined();
  if (!farmAt) throw new Error('No clear farm test position');
  missionControls(farm).teleport('player', { x: farmAt.x - 1.1, z: farmAt.z }); farm.chunks!.update([farmAt.x, farmAt.z]);
  equip(farm, ['weapon.fire-axe']);
  const farmTarget = farm.infected!.spawn('infected.runner', farmAt);
  const farmHp = health(farm, farmTarget);
  farm.combat!.status.apply(farm.entities.get(farmTarget)!, { kind: 'stunned', duration: 9, maxStacks: 1, dps: 0, slow: 0 }, 1, 'qa.melee-contact');
  farm.setInput({ aim: { x: 1, z: 0 }, aimPoint: farmAt, left: { down: true, held: true, up: false } });
  const farmTrace: { attackId: number; tick: number; weapon: string; facing: number; targetChosen: number[]; hitIds: number[]; noDamageReason: string | null; y: number[] }[] = [];
  farm.events.on('combat.attack', event => {
    if (event.type !== 'combat.attack' || event.sourceId !== 1 || event.actionId !== 'weapon.fire-axe') return;
    const def = rosterAction('weapon.fire-axe'), chosen = farm.combat!.query.melee(1, event.position, event.direction, def.range, def.arc, def.maxTargets);
    farmTrace.push({ attackId: event.attackId, tick: event.tick, weapon: event.actionId, facing: Math.atan2(event.direction.z, event.direction.x), targetChosen: chosen.map(e => e.id), hitIds: [],
      noDamageReason: chosen.some(e => e.id === farmTarget) ? 'damage-rejected-after-hit-test' : !chosen.length && Math.abs(farm.entities.get(1)!.transform.y - farm.entities.get(farmTarget)!.transform.y) > .9 ? 'height-mismatch' : !chosen.length && farm.combat!.query.clearDistance(event.position, event.direction, def.range) < Math.hypot(farm.entities.get(farmTarget)!.transform.x - event.position.x, farm.entities.get(farmTarget)!.transform.z - event.position.z) ? 'blocked-by-solid' : !chosen.length ? 'out-of-arc-or-range' : 'another-target-intercepted',
      y: [event.position.y, farm.entities.get(farmTarget)!.transform.y] });
  });
  farm.events.on('combat.hit', event => {
    if (event.type !== 'combat.hit' || event.sourceId !== 1 || !('targetId' in event)) return;
    const shot = farmTrace.find(row => row.attackId === event.attackId);
    if (shot) { shot.hitIds.push(event.targetId); if (event.targetId === farmTarget) shot.noDamageReason = null; }
  });
  for (let tick = 0; tick < 480; tick++) {
    const p = farm.entities.get(1)!, target = farm.entities.get(farmTarget)!;
    const dx = target.transform.x - p.transform.x, dz = target.transform.z - p.transform.z, distance = Math.hypot(dx, dz) || 1;
    farm.setInput({ aim: { x: dx / distance, z: dz / distance }, aimPoint: { x: target.transform.x, z: target.transform.z }, left: { down: tick === 0, held: true, up: false } });
    farm.update();
  }
  farm.clearInput();
  expect(farmTrace.length, `native L10 farm melee trace: ${JSON.stringify(farmTrace)}`).toBeGreaterThan(0);
  expect(farmTrace.some(row => row.hitIds.includes(farmTarget)), `native L10 farm courier hit trace: ${JSON.stringify(farmTrace)}`).toBe(true);
  expect(health(farm, farmTarget), `native L10 farm melee trace player=${JSON.stringify(farm.entities.get(1)!.transform)} target=${JSON.stringify(farm.entities.get(farmTarget)!.transform)} attacks=${JSON.stringify(farmTrace)}`).toBeLessThan(farmHp);
}

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
  // s178 Hard (PO 2026-11-19 "friendly fire hurts them and me"): the courier's own grenade deals its normal
  // damage to her (Simple keeps the authored 30% asserted above), the corgi stays safe, and allied fire
  // damages the courier and other humans. Simple keeps every pre-s178 guard (allies hold fire through
  // humans, so such hits never occur; the pre-existing E11 30% allied/environmental blast rule stays).
  const selfHard = await arena(); selfHard.difficulty = 'hard'; equip(selfHard);
  const corgi = selfHard.entities.create({ kind: 'companion', archetype: 'char.corgi', faction: 'survivor', transform: { x: .8, y: .3, z: 0, yaw: 0 }, health: { current: 100, max: 100 }, companion: { state: 'follow', courage: 100, until: 0, barkAt: 0, hurtAt: 0, pickup: null, path: [], goal: -1, pathIndex: 0 } });
  selfHard.spatial.set(corgi.id, .8, 0);
  fire(selfHard, 'RIGHT', { x: 1, z: 0 }, { x: 0, z: 0 }); step(selfHard, 91);
  expect(health(selfHard, 1), 'hard: full self-damage (the same feet-offset falloff that leaves 70 in Simple)').toBeCloseTo(0.125, 6);
  expect(health(selfHard, corgi.id), 'campaign rule "corgi safe"').toBe(100);
  const bullet = { attackId: 0, actionId: 'weapon.pistol', base: 20, multiplier: 1, type: 'bullet' as const, knockback: 0, stagger: 0 };
  const blast = { attackId: 0, actionId: 'explosion.shell', base: 60, multiplier: 1, type: 'explosive' as const, knockback: 0, stagger: 0 };
  for (const difficulty of ['simple', 'hard'] as const) {
    const fireWorld = await arena(); fireWorld.difficulty = difficulty;
    const soldier = humanAt(fireWorld, 0, -3, { ally: soldierAlly });
    fireWorld.combat!.damage.apply({ ...bullet, sourceId: soldier, targetId: 1, origin: { x: 0, z: -3 }, direction: { x: 0, z: 1 } });
    expect(health(fireWorld, 1), `${difficulty}: an allied bullet and the courier`).toBe(difficulty === 'hard' ? 80 : 100);
    const other = humanAt(fireWorld, 2, 0);
    fireWorld.combat!.damage.apply({ ...bullet, sourceId: soldier, targetId: other, origin: { x: 0, z: -3 }, direction: { x: 0, z: 1 } });
    expect(health(fireWorld, other), `${difficulty}: an allied bullet and another human`).toBe(difficulty === 'hard' ? 80 : 100);
    step(fireWorld, 40);
    fireWorld.combat!.damage.apply({ ...blast, sourceId: soldier, targetId: 1, origin: { x: 0, z: -3 }, direction: { x: 0, z: 1 } });
    expect(health(fireWorld, 1), `${difficulty}: an allied blast and the courier`).toBeCloseTo(difficulty === 'hard' ? 20 : 100 - 60 * 0.3, 6);
    fireWorld.combat!.damage.apply({ ...blast, sourceId: soldier, targetId: other, origin: { x: 0, z: -3 }, direction: { x: 0, z: 1 } });
    expect(health(fireWorld, other), `${difficulty}: an allied blast and another human`).toBe(difficulty === 'hard' ? 20 : 100);
  }
  // An angled wreck's broad-phase corners are empty for movement and blasts alike.
  const rotated = await arena(); equip(rotated); rotated.combat!.damage.god = true;
  walls(rotated).push({ x: 0, y: 1, z: 0, halfX: 2.5, halfY: 1, halfZ: 2.5,
    navFootprint: { x: 0, z: 0, halfX: 3, halfZ: .4, yaw: Math.PI / 4 } });
  const clearCorner = dummy(rotated, 1, 2), solid = dummy(rotated, 0, 0);
  fire(rotated, 'RIGHT', { x: 3 / Math.sqrt(13), z: 2 / Math.sqrt(13) }, { x: 3, z: 2 }); step(rotated, 90);
  expect(health(rotated, clearCorner), 'no phantom blast cover in a free corner').toBeLessThan(100);
  expect(health(rotated, solid), 'the actual rotated hull still blocks the blast').toBe(100);

});

test('damage modifiers: shared riot shield ±35°, armor and multipliers, stun/slow/toxic, capped burning stacks and water', async () => {
  for (const degrees of [-65, -60, -20, 0, 20, 60, 65, 90, 180]) {
    const w = await arena(); equip(w, ['weapon.pistol']);
    const id = w.spawnDummy('infected.riot', { x: 3, z: 0 }, { yaw: Math.PI + degrees * Math.PI / 180 });
    fire(w); expect(health(w, id), `${degrees}°`).toBeCloseTo(Math.abs(degrees) <= riotShieldResponse.faceHalfAngleDeg ? 100 - 20 * riotShieldResponse.chipFraction : 80);
    expect(w.events.events().some(event => event.type === 'combat.hit' && event.targetId === id && event.shieldGlance), `${degrees}° shield feedback`).toBe(Math.abs(degrees) <= riotShieldResponse.faceHalfAngleDeg);
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
  expect(mg.events.events().some(event => event.type === 'combat.kill' && event.targetId === riot && event.downed !== undefined)).toBe(true);
  expect(mg.entities.get(riot)!.infected!.recoverAt).toBeGreaterThan(mg.tick);
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
  expect(melee.entities.get(meleeRiot)!.infected!.recoverAt).toBeGreaterThan(melee.tick);
  // The barrel can pass the shield at physical contact; a melee flinch opens
  // a frontal firing window until stagger expires in every level.
  for (const level of Array.from({ length: 10 }, (_, i) => `L${i + 1}`)) {
    const counter = await arena(); counter.scenario = level;
    const id = counter.spawnDummy('infected.riot', { x: 0, z: 0 }, { hp: 500, yaw: 0 });
    const target = counter.entities.get(id)!;
    const bullet = { attackId: 1, actionId: 'weapon.army-mg', sourceId: 1, targetId: id,
      origin: { x: 1.05, z: 0 }, direction: { x: -1, z: 0 }, base: 14, multiplier: 1, type: 'bullet' as const, knockback: 0, stagger: 0 };
    expect(counter.combat!.damage.apply(bullet), `${level} point blank`).toBe(14);
    bullet.origin.x = 3;
    expect(counter.combat!.damage.apply({ ...bullet, type: 'melee', actionId: 'weapon.fire-axe', stagger: .5 })).toBe(14);
    expect(counter.combat!.damage.apply(bullet), `${level} stagger window`).toBe(14);
    counter.tick += 31;
    expect(counter.combat!.damage.apply(bullet), `${level} raised shield`).toBe(14 * .18);
    expect(counter.combat!.damage.apply({ ...bullet, type: 'explosive' })).toBe(14);
    expect(counter.combat!.damage.apply({ ...bullet, type: 'status', permanent: true })).toBe(14);
    expect(counter.combat!.damage.apply({ ...bullet, shotOrigin: { x: -3, z: 0 } }), `${level} shared launch-origin correction`).toBe(14);
    expect(target.combat!.shield).toBe(true);
    for (const distance of [3, 2.5, 1.5, 1.05, 1, .5]) {
      const flight = await arena(); flight.scenario = level; equip(flight, ['weapon.army-mg']);
      Object.assign(flight.entities.get(1)!.transform, { x: distance, z: 0 });
      const id = flight.spawnDummy('infected.riot', { x: 0, z: 0 });
      fire(flight, 'LEFT', { x: -1, z: 0 }); step(flight, 5);
      expect(health(flight, id), `${level} actual projectile from ${distance} m`).toBe(distance < 1.15 ? 86 : 97.48);
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
  await checkDynamicCover();
  await checkFlamethrowerFuel();
  await checkFuelPool();
  await checkRaisedMountedGun();
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

async function checkCorgiLure(): Promise<void> {
  const w = await arena(); equip(w, ['weapon.fire-axe'], ['ability.corgi-lure', 'weapon.handgun']);
  const loadout = w.combat!.runner.loadout;
  w.setInput({ corgiLure: true }); step(w, 1); w.clearInput();
  expect(w.combat!.effects.zones.filter(zone => zone.kind === 'lure')).toHaveLength(1);
  expect(loadout.current(loadout.state.selectedSide).id).toBe('weapon.fire-axe');
  w.setInput({ corgiLure: true }); step(w, 1); w.clearInput();
  expect(w.combat!.effects.zones.filter(zone => zone.kind === 'lure')).toHaveLength(1);
  expect(loadout.state.corgiReady).toBeGreaterThan(w.tick);
  const ready = loadout.state.corgiReady;
  equip(w, ['weapon.fire-axe'], ['weapon.handgun']);
  expect(w.combat!.runner.loadout.state.corgiReady).toBe(ready);
}
