import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { action } from '../../../src/data/actions/catalog';
import { alphaDamageMultiplier, humanInfected, infectedDefinitions } from '../../../src/data/infected';
import { damageAmount, downed } from '../../../src/sim/combat/Damage';
import { loadL5 } from '../../../tools/sim-runner/l5Bots';
import { arena, dummy, equip, fire, health, step } from './helpers';

async function gun(id: string) {
  const w = await arena();
  w.scenario = 'L5';
  w.combat!.actionDefinitions = { 'weapon.shotgun': { ...action('weapon.shotgun'), magazine: 0, reloadTime: 0 } };
  w.combat!.assist.setting = 'Off'; equip(w, [id]);
  return w;
}

test('T-E23-12-role @E23 @E23-AC12 close shell, distance falloff and 600 shells without reload', async () => {
  const w = await gun('weapon.shotgun');
  const target = dummy(w, 2, 0, 1000000); w.entities.get(target)!.combat!.radius = 2;
  fire(w); expect(1000000 - health(w, target)).toBe(240);
  w.entities.get(target)!.transform.x = 12; w.spatial.set(target, 12, 0);
  step(w, 30); fire(w); expect(1000000 - 240 - health(w, target)).toBeCloseTo(24);
  let shotCount = 0; w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.actionId === 'weapon.shotgun') shotCount++; });
  w.setInput({ aim: { x: 1, z: 0 }, left: { down: false, held: true, up: false } }); step(w, 600 * 30);
  expect(shotCount).toBeGreaterThanOrEqual(600);
  expect(w.combat!.runner.loadout.current('LEFT')).toMatchObject({ magazine: 0, reloadUntil: 0 });
});

test('T-E23-12-stand @E23 @E23-AC12 standing over the shotgun for 0.6 seconds collects it without E', async () => {
  const w = await arena(), pickup = w.combat!.pickups.spawn('weapon.shotgun', { x: .4, z: 0 }, false, { retain: true, interactTicks: 36 });
  const before = w.combat!.runner.loadout.activeEntries().map(e => e.id);
  step(w, 35); expect(w.entities.get(pickup)).toBeDefined();
  step(w, 1); expect(w.entities.get(pickup)).toBeUndefined();
  expect(w.combat!.runner.loadout.current('RIGHT').id).toBe('weapon.shotgun');
  expect(w.combat!.runner.loadout.activeEntries().map(e => e.id)).toEqual(expect.arrayContaining(before));
});

test('T-E23-12-kill PO #37 @E23 @E23-AC12 @E07-AC14 one shell kills regular infected through 8 m permanently; two close shells stop an Alpha', async () => {
  const l = await loadL5(1, 'high', false);
  try {
    const w = l.world, p = w.entities.get(1)!;
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    w.combat!.damage.god = true; w.combat!.assist.setting = 'Off';
    // Campaign ammunition policy without progression upgrades.
    w.combat!.actionDefinitions = { 'weapon.shotgun': { ...action('weapon.shotgun'), magazine: 0, reloadTime: 0 } };
    equip(w, ['weapon.shotgun']);
    const placePlayer = () => {
      Object.assign(p.transform, { x: -14, z: -39.8 });
      w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setNextKinematicTranslation(p.transform); w.spatial.set(1, -14, -39.8);
    };
    // Ordinary roles (25–140 base HP), using the current 1.5x campaign toughness.
    for (const level of ['L5', 'L10']) for (const distance of [2, 8]) for (const role of humanInfected.filter(d => d.hp <= 140)) {
      w.scenario = level; placePlayer(); step(w, 31);
      const e = w.entities.get(w.infected!.spawn(role.id, { x: -14 + distance, z: -39.8 }))!;
      e.infected!.until = Number.MAX_SAFE_INTEGER; e.combat!.staggerUntil = Number.MAX_SAFE_INTEGER;
      fire(w);
      expect(e.health.current, `${level} ${role.id} at ${distance}m`).toBe(0);
      expect(downed(e)).toBe(false);
      step(w, 21 * 60);
      expect(w.entities.get(e.id)).toMatchObject({ corpse: true, health: { current: 0 } });
      w.infected!.release(e);
    }
    w.scenario = 'L5'; placePlayer(); step(w, 31);
    const alpha = w.entities.get(w.infected!.spawn('infected.alpha', { x: -12, z: -39.8 }))!;
    alpha.infected!.until = Number.MAX_SAFE_INTEGER;
    expect(alpha.health.max).toBe(300);
    fire(w);
    expect(alpha.health.current).toBe(108);
    expect(alpha.transform.x).toBeGreaterThan(-11);
    expect(alpha.combat!.staggerUntil).toBeGreaterThan(w.tick);
    expect(alpha.combat!.reaction!.until).toBeGreaterThan(w.tick);
    step(w, 30); fire(w);
    expect(alpha.health.current).toBe(0);
    w.infected!.release(alpha);
    // Other player guns still use recoverable downing.
    placePlayer(); equip(w, ['weapon.army-mg']);
    const e = w.entities.get(w.infected!.spawn('infected.runner', { x: -12, z: -39.8 }))!;
    e.combat!.staggerUntil = Number.MAX_SAFE_INTEGER;
    w.setInput({ aim: { x: 1, z: 0 }, left: { down: false, held: true, up: false } });
    for (let i = 0; i < 100 && e.health.current > 0; i++) step(w, 1);
    w.clearInput(); expect(downed(e)).toBe(true);
  } finally { l.world.dispose(); }
});

test('T-E23-12-group @E23 @E23-AC12 machine gun clears ten spread targets at least 1.5 times faster', async () => {
  const clear = async (weapon: string) => {
    const w = await gun(weapon), targets = Array.from({ length: 10 }, (_, i) => dummy(w, 10, -5 + i * 10 / 9, 60));
    for (let tick = 0; tick < 3600; tick++) {
      const id = targets.find(id => health(w, id) > 0); if (id === undefined) return tick;
      const e = w.entities.get(id)!, d = Math.hypot(e.transform.x, e.transform.z);
      w.setInput({ aim: { x: e.transform.x / d, z: e.transform.z / d }, left: { down: false, held: true, up: false } }); step(w, 1);
    }
    throw new Error(`${weapon} did not clear the front`);
  };
  const mg = await clear('weapon.army-mg'), shotgun = await clear('weapon.shotgun');
  mkdirSync('test-results/epics/E23', { recursive: true });
  writeFileSync('test-results/epics/E23/shotgun-roles.json', JSON.stringify({ machineGunSeconds: mg / 60, shotgunSeconds: shotgun / 60, ratio: shotgun / mg }, null, 2));
  expect(shotgun / mg).toBeGreaterThanOrEqual(1.5);
});

test('T-E23-12-alpha-data @E23 @E23-AC12 shared E07 resistance applies once after falloff', async () => {
  const w = await gun('weapon.shotgun'), id = dummy(w, 2, 0, 300), e = w.entities.get(id)!;
  e.archetype = 'infected.alpha'; e.combat!.armor = .9;
  const hit = { attackId: 1, actionId: 'weapon.shotgun', sourceId: 1, targetId: id, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 150, multiplier: 1, type: 'bullet' as const, knockback: 0, stagger: 0 };
  expect(alphaDamageMultiplier('weapon.shotgun', 'bullet')).toBe(.8); expect(damageAmount(hit, e)).toBe(120);
  expect(damageAmount({ ...hit, base: 15 }, e)).toBe(12);
  expect(damageAmount({ ...hit, actionId: 'weapon.army-mg', base: 14 }, e)).toBe(7);
});

test.skipIf(!infectedDefinitions.some(d => d.id === 'infected.alpha'))('T-E23-12-alpha @E23 @E23-AC12 real Alpha: two close shells versus 43 army MG rounds', async () => {
  const l = await loadL5(1, 'high', false);
  try {
    const w = l.world, p = w.entities.get(1)!;
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    for (const [weapon, shots, minimum, maximum] of [['weapon.shotgun', 2, 0, 1.1], ['weapon.army-mg', 43, 4, 5]] as const) {
      Object.assign(p.transform, { x: -16, z: 8 }); w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setNextKinematicTranslation(p.transform);
      const e = w.entities.get(w.infected!.spawn('infected.alpha', { x: -14, z: 8 }))!;
      expect(e.health.max).toBe(300);
      // Freeze locomotion while retaining the real archetype and damage/down lifecycle.
      e.infected!.until = Number.MAX_SAFE_INTEGER; e.combat!.staggerUntil = Number.MAX_SAFE_INTEGER;
      equip(w, [weapon]); w.combat!.assist.setting = 'Off'; w.combat!.damage.god = true;
      const start = w.tick; w.setInput({ aim: { x: 1, z: 0 }, left: { down: false, held: true, up: false } });
      for (let i = 0; i < 600 && e.health.current > 0; i++) step(w, 1);
      const hits = w.events.events().filter(h => h.type === 'combat.hit' && h.targetId === e.id && h.actionId === weapon);
      expect(hits).toHaveLength(shots); expect((hits.at(-1)!.tick - hits[0].tick) / 60).toBeGreaterThanOrEqual(minimum); expect((hits.at(-1)!.tick - hits[0].tick) / 60).toBeLessThanOrEqual(maximum);
      expect(w.tick - start).toBeLessThan(600); expect(downed(e)).toBe(true);
      w.clearInput(); w.infected!.release(e);
    }
  } finally { l.world.dispose(); }
});
