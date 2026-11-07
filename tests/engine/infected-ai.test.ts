// Infected AI core: the shared state machine (idle → chase → attack → down/dead), perception, telegraphs and body
// separation drive every enemy role in every level.
import { afterEach, expect, test } from 'vitest';
import { animalInfected, humanInfected, infectedDefinitions, infectedRecovery, INFECTED_TOUGHNESS, validateInfected } from '../../src/data/infected';
import { infectedContactDistance, meleeRing } from '../../src/sim/ai/CharacterSeparation';
import type { DamageEvent } from '../../src/sim/combat/Damage';
import type { EntitySnapshot, GameEvent } from '../../src/sim/world/types';
import { clickable } from '../../src/input/ClickPick';
import { l1v2 } from '../../src/data/l1v2';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { missionSandbox } from '../fixtures/scenarios/mission-sandbox';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function arena(seed = 1, god = true) { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('horde-arena', seed); w.combat!.damage.god = god; return w; }
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
const spawn = (w: SimWorld, role: string, x: number, z = 0, state: 'chase' | 'idle' = 'chase') => w.entities.get(w.infected!.spawn(`infected.${role}`, { x, z }, { state }))!;
function hit(w: SimWorld, e: EntitySnapshot, type: DamageEvent['type'] = 'melee', base = 999, origin = { x: 0, z: 0 }): number {
  return w.combat!.damage.apply({ attackId: 1, actionId: type === 'explosive' ? 'weapon.grenade' : 'weapon.bat', sourceId: 1, targetId: e.id, origin, direction: { x: 1, z: 0 }, base, multiplier: 1, type, knockback: 0, stagger: 0 });
}
const [lowS, highS] = infectedRecovery.downS;

test('every human and animal role validates and spawns with its catalog health and speed; every attack is telegraphed', async () => {
  for (const tier of ['low', 'high'] as const) {
    const w = await arena(); w.scenario = 'L3'; w.infected!.configureL1v2(); w.infected!.director.setTier(tier);
    // Isolate the retreat AI from the level's population and objective graph.
    const definition = missionSandbox(); definition.onStart = [];
    const mission = w.loadMission(definition); mission.begin(); Object.assign(mission.state, { l3: { fallbackAt: 1 } });
    const e = spawn(w, 'runner', 2), brain = e.infected!.l1!;
    brain.mode = 'chase'; brain.targetId = 1; brain.pauseUntil = 0;
    const warnings: number[] = [];
    w.events.on('telegraph', event => {
      if (event.type === 'telegraph' && event.sourceId === e.id) warnings.push(Math.hypot(e.transform.x, e.transform.z));
    });
    step(w, 1);
    expect(warnings, `${tier}: pursuing at two metres must not repeatedly wind up out of contact`).toEqual([]);
    e.transform.x = .9001; e.transform.z = 0;
    step(w, 1);
    expect(warnings, `${tier}: contact reached during steering must commit before separation`).toHaveLength(1);
    expect(warnings[0]).toBeLessThanOrEqual(.9);
  }
  {
    const w = await arena(); w.scenario = 'L3'; w.infected!.configureL1v2();
    const e = spawn(w, 'runner', 1.8), b = e.infected!, brain = b.l1!;
    brain.mode = 'chase'; brain.targetId = 1; brain.pauseUntil = 0;
    step(w, 1);
    const first = w.events.events().find(event => event.type === 'telegraph' && event.sourceId === e.id)!;
    expect(first).toBeDefined();
    // Interrupt a real windup with a nonlethal hit. The original attack cycle
    // still owns recovery; a short flinch must not grant an immediate retry.
    w.combat!.damage.apply({ attackId: 999, actionId: 'weapon.handgun', sourceId: 1, targetId: e.id, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: .01, multiplier: 1, type: 'bullet', knockback: 0, stagger: .25 });
    step(w, Math.round(l1v2.infected.attackCycleS * 60) - 1);
    expect(w.events.events().filter(event => event.type === 'telegraph' && event.sourceId === e.id)).toHaveLength(1);
    step(w, 1);
    expect(w.events.events().filter(event => event.type === 'telegraph' && event.sourceId === e.id)).toHaveLength(2);
  }
  {
    for (const moving of [false, true]) {
      const w = await arena(1, false); w.scenario = 'L6';
      const e = spawn(w, 'runner', 4.3);
      if (moving) w.setInput({ move: { x: -1, z: 0 } });
      step(w, 1);
      const cue = w.events.events().find(event => event.type === 'telegraph' && event.sourceId === e.id);
      expect(cue).toMatchObject({ target: { id: 1 }, duration: .35 });
      step(w, 59);
      const damage = w.events.events().filter(event => event.type === 'combat.hit' && event.targetId === 1 && event.amount > 0);
      expect(damage.length > 0).toBe(!moving);
    }
  }

  {
    const w = await arena(); w.scenario = 'L6'; w.infected!.configureL1v2();
    const e = spawn(w, 'runner', 1.8), decoy = w.spawnDummy('human.decoy', { x: 24, z: 0 }, { faction: 'civilian' });
    const b = e.infected!, brain = b.l1!;
    brain.mode = 'chase'; brain.targetId = 1; brain.pauseUntil = 0; b.heardTargetId = decoy;
    step(w, 1);
    expect(w.events.events().find(event => event.type === 'telegraph' && event.sourceId === e.id)).toMatchObject({ target: { id: 1 } });
  }

  validateInfected(); expect(infectedDefinitions.every(def => def.bar)).toBe(true); expect(() => validateInfected([{ ...humanInfected[0], windup: 0.1 }])).toThrow();
  const w = await arena();
  for (const [i, def] of [...humanInfected, ...animalInfected].entries()) {
    const e = w.entities.get(w.infected!.spawn(def.id, { x: i * 2 - 12, z: 10 }, { perched: false }))!;
    expect(e.health.max, def.id).toBe(def.hp * INFECTED_TOUGHNESS); expect(e.infected!.speed, def.id).toBe(def.speed);
    if (e.infected!.hidden) { w.solids.relocate(e, { x: 2, y: .7, z: 0 }, 'scripted.teleport'); step(w, 6); }
    expect(e.combat!.radius, def.id).toBe(def.radius); expect(clickable(e), def.id).toBe(true);
    expect(w.combat!.query.nearby(e.transform, .001), def.id).toContain(e.id);
    expect(w.combat!.query.melee(1, e.transform, { x: 1, z: 0 }, .001, 360, 100).map(t => t.id), def.id).toContain(e.id);
    expect(w.combat!.query.ray(1, e.transform, { x: 1, z: 0 }, .001)?.id, def.id).toBe(e.id);
    expect(hit(w, e, 'melee', .01, e.transform), def.id).toBeGreaterThan(0);

  }
  for (const def of infectedDefinitions) {
    const t = await arena(1, false), e = spawn(t, def.id.slice(9), 0.9); if (def.special === 'explode') e.health.current = 0;
    step(t, 130);
    const log = t.events.events(), hits = log.filter(event => event.type === 'combat.hit' && event.actionId.startsWith('infected.') && event.amount > 0);
    if (def.special !== 'scream') expect(hits.length, def.id).toBeGreaterThan(0);
    for (const event of hits) {
      if (event.type !== 'combat.hit') continue;
      const telegraph = log.find(entry => entry.type === 'telegraph' && entry.sourceId === event.sourceId && entry.attackId === event.attackId);
      expect(telegraph, def.id).toBeDefined(); expect(event.tick - telegraph!.tick, def.id).toBeGreaterThanOrEqual(def.special === 'charge' ? 48 : 21);
    }
  }
  // An approach windup must represent a real reachable attack, rather than
  // increasing the threat ledger with a leap that cannot reach its victim.
  const approach = await arena(1, false); approach.scenario = 'L10';
  const courier = approach.entities.get(1)!; courier.health.current = courier.health.max = 1000;
  const dog = spawn(approach, 'dog', 7), contacts: { tick: number; distance: number; amount: number }[] = [];
  approach.events.on('infected.attack', event => {
    if (event.type === 'infected.attack' && event.sourceId === dog.id && event.targetId === 1)
      contacts.push({ tick: event.tick, amount: event.amount, distance: Math.hypot(dog.transform.x - courier.transform.x, dog.transform.z - courier.transform.z) });
  });
  step(approach, 420);
  const warning = approach.events.events().find(e => e.type === 'telegraph' && e.sourceId === dog.id);
  expect(warning?.type === 'telegraph' && 'duration' in warning && warning.duration).toBeGreaterThanOrEqual(.6);
  expect(contacts.length, 'the telegraphed approach reaches a stationary courier').toBeGreaterThan(1);
  for (let i = 0; i < contacts.length; i++) {
    expect(contacts[i].distance, 'actual bite reach').toBeLessThanOrEqual(2);
    expect(contacts[i].amount, 'unarmored bite damage').toBe(10);
    if (i) expect(contacts[i].tick - contacts[i - 1].tick, 'bite cooldown').toBeGreaterThanOrEqual(120);
  }
});

test('perception: sight cone, facing-independent gunshots, silent melee misses, bounded kill noise, screamer radius', async () => {
  const w = await arena();
  const inside = w.infected!.spawn('infected.runner', { x: -10, z: 0 }), outside = w.infected!.spawn('infected.runner', { x: 10, z: 0 });
  const far = w.infected!.spawn('infected.runner', { x: -15, z: 0 }), angle = w.infected!.spawn('infected.runner', { x: -5, z: 10 });
  step(w, 18);
  expect(w.entities.get(inside)!.infected!.state).toBe('chase');
  for (const id of [outside, far, angle]) expect(w.entities.get(id)!.infected!.state).toBe('idle');
  w.combat!.setLoadout(['weapon.pistol'], ['weapon.grenade']); w.setInput({ left: { down: true, held: true, up: false }, aim: { x: 1, z: 0 } }); step(w, 1); w.clearInput(); step(w, 17);
  for (const id of [outside, far, angle]) expect(w.entities.get(id)!.infected!.state).toBe('chase');

  const n = await arena();
  const near = n.entities.get(n.infected!.spawn('infected.runner', { x: 0, z: 5 }))!, beyond = n.entities.get(n.infected!.spawn('infected.runner', { x: 0, z: 7 }))!;
  const swing = () => { n.setInput({ left: { down: true, held: true, up: false }, aim: { x: 1, z: 0 } }); step(n, 1); n.clearInput(); step(n, 30); };
  n.combat!.setLoadout(['weapon.bat'], ['weapon.grenade']); swing();
  expect(near.infected!.state).toBe('idle'); expect(n.events.events().filter(e => e.type === 'noise')).toHaveLength(0);
  const victim = n.entities.get(n.infected!.spawn('infected.runner', { x: 1, z: 0 }))!; victim.health.current = 1;
  swing();
  expect(near.infected!.state).not.toBe('idle'); expect(beyond.infected!.state).toBe('idle');
  expect(n.events.events().some(e => e.type === 'noise' && e.actionId === 'weapon.bat' && e.radius === 6)).toBe(true);

  const s = await arena(); spawn(s, 'screamer', 1);
  const within = spawn(s, 'runner', 20.5, 0, 'idle'), past = spawn(s, 'runner', 22, 0, 'idle'); step(s, 51);
  expect(within.infected!.state).not.toBe('idle'); expect(past.infected!.state).toBe('idle');
});

test('melee knocks down for a seeded 10-20 s, respects the L2 recovery pool, then up at full HP; explosives and burns kill for good', async () => {
  const downTicks: number[] = [];
  for (const seed of [1, 2, 3, 1]) {
    const w = await arena(seed); w.infected!.configureL1v2();
    const e = w.entities.get(w.infected!.spawn('infected.runner', { x: 6, z: 0 }, { yaw: 0, variant: 'inf.cashier' }))!;
    step(w, 2); hit(w, e);
    const downAt = w.tick, recoverAt = e.infected!.recoverAt;
    expect(e.health.current).toBe(0);
    expect(e.infected!.knockdowns).toBe(1);
    expect(recoverAt - downAt).toBeGreaterThanOrEqual(lowS * 60); expect(recoverAt - downAt).toBeLessThanOrEqual(highS * 60);
    downTicks.push(recoverAt - downAt);
    step(w, 200);
    expect(e.corpse).toBeFalsy(); expect(e.infected!.state).toBe('dead');
    const hitAt = w.tick; hit(w, e);
    const reset = e.infected!.recoverAt;
    expect(e.infected!.knockdowns, 'hitting the floor body is not a second knockdown').toBe(1);
    expect(reset - hitAt).toBeGreaterThanOrEqual(lowS * 60);
    step(w, reset - w.tick - 1); expect(e.health.current).toBe(0);
    step(w, 2); expect(e.health.current).toBe(e.health.max); expect(e.infected!.state).not.toBe('dead'); expect(e.corpse).toBeFalsy();
    hit(w, e); expect(e.infected!.knockdowns).toBe(2);
    w.infected!.release(e);
    const replacement = w.entities.get(w.infected!.spawn('infected.runner', { x: 6, z: 0 }))!;
    expect(replacement.infected!.knockdowns, 'a pooled brain must not inherit the policy counter').toBeUndefined();
  }
  expect(downTicks[3]).toBe(downTicks[0]);
  expect(new Set(downTicks.slice(0, 3)).size).toBeGreaterThan(1);

  const w = await arena(3); w.infected!.configureL1v2();
  const z = (x: number, zz: number) => w.entities.get(w.infected!.spawn('infected.runner', { x, z: zz }, { yaw: 0, variant: 'inf.cashier' }))!;
  const blasted = z(6, 0), downed = z(-6, 0), burned = z(0, 6);
  step(w, 2); hit(w, blasted, 'explosive'); expect(blasted.infected!.recoverAt).toBe(-1);
  hit(w, downed); step(w, 30); hit(w, w.entities.get(downed.id)!, 'explosive', 40);
  w.combat!.status.apply(burned, { kind: 'burning', duration: 10, maxStacks: 1, dps: 15, slow: 0 }, 1, 'throw.molotov');
  step(w, 60 * highS + 300);
  for (const e of [blasted, downed, burned]) { expect(w.entities.get(e.id)!.health.current).toBe(0); expect(w.entities.get(e.id)!.corpse, `${e.id} is a corpse`).toBe(true); }
  // L2 has a separate recovery pool: living caps exclude downed bodies and
  // the oldest body above the tier limit settles into a persistent corpse.
  {
  const w = await arena(1, false); w.scenario = 'L2';
  w.infected!.director.strict = true; w.infected!.director.tier = 'low'; w.infected!.director.levelCap = 60;
  const bodies = Array.from({ length: 13 }, (_, i) => spawn(w, 'runner', -12 + i * 2, 8));
  for (const body of bodies) { hit(w, body); step(w, 1); }
  expect(w.infected!.director.count).toBe(0);
  expect(w.infected!.active.filter(e => e.infected!.recoverAt >= 0)).toHaveLength(12);
  expect(bodies[0].infected!.recoverAt).toBe(-1);
  step(w, 125);
  expect(w.entities.get(bodies[0].id)).toMatchObject({ id: bodies[0].id, corpse: true });
  expect(w.entities.get(bodies[0].id)).toBeDefined();
  expect(w.infected!.active.filter(e => e.infected!.recoverAt >= 0)).toHaveLength(12);
  }
});

test('bodies: a pile-up holds the melee ring yet keeps landing hits; large roles keep contact clearance; corpses persist past 100 bodies', async () => {
  const w = await arena(1, false), player = w.entities.get(1)!, start = player.health.current;
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; w.infected!.spawn('infected.runner', { x: player.transform.x + Math.cos(a) * 3, z: player.transform.z + Math.sin(a) * 3 }, { state: 'chase' }); }
  let closest = Infinity, attacking = 0;
  for (let tick = 0; tick < 300; tick++) {
    w.update(); if (tick < 120) continue;
    for (const e of w.infected!.active) { closest = Math.min(closest, Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z)); if (e.infected!.state === 'attack') attacking++; }
  }
  expect(meleeRing).toBeLessThan(1.1); expect(closest).toBeGreaterThan(meleeRing - .03);
  expect(attacking).toBeGreaterThan(100); expect(player.health.current).toBeLessThan(start);

  for (const role of ['infected.butcher', 'infected.gorilla']) {
    const b = await arena(1, false), p = b.entities.get(1)!, hp = p.health.current;
    const e = b.entities.get(b.infected!.spawn(role, { x: p.transform.x + 3, z: p.transform.z }, { state: 'chase' }))!;
    for (let tick = 0; tick < 240; tick++) {
      b.update();
      expect(Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z), role).toBeGreaterThanOrEqual(infectedContactDistance(e.combat!.radius) - .002);
    }
    expect(p.health.current, role).toBeLessThan(hp);
  }

  const c = await arena(), ids: number[] = [];
  for (let i = 0; i < 101; i++) { const corpse = spawn(c, 'runner', i % 20 - 10, 10 + Math.floor(i / 20), 'idle'); ids.push(corpse.id); corpse.health.current = 0; }
  step(c, 121); expect(c.infected!.active).toHaveLength(0);
  for (const id of ids) expect(c.entities.get(id)?.corpse).toBe(true);
});

test('recovered infected forget the chase: re-acquisition needs sight, not memory', async () => {
  const w = await arena(4); w.infected!.configureL1v2();
  const player = w.entities.get(1)!;
  const e = w.entities.get(w.infected!.spawn('infected.runner', { x: player.transform.x + 6, z: player.transform.z }, { yaw: Math.PI, variant: 'inf.cashier' }))!;
  const alerts: GameEvent[] = [];
  w.events.on('ai.alerted', ev => { if (ev.type === 'ai.alerted' && ev.targetId === e.id) alerts.push(ev); });
  for (let i = 0; i < 120 && e.infected!.l1!.mode !== 'chase'; i++) step(w, 1);
  expect(e.infected!.l1!.mode).toBe('chase');
  hit(w, e);
  step(w, e.infected!.recoverAt - w.tick + 2);
  expect(e.health.current).toBe(e.health.max);
  expect(e.infected!.l1!.mode).not.toBe('chase');
});
