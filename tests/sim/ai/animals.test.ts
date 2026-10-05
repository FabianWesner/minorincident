import { expect, test } from 'vitest';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { arena, spawn, step } from './helpers';
test('T-E07-16 @E07 @E07-AC16 four dogs flank from at least two directions and telegraph 0.6 s knockdown pounces', async () => {
  const w = await arena(); w.combat!.damage.god = true;
  for (let i = 0; i < 4; i++) w.infected!.spawn('infected.dog', { x: 15, z: i - 1.5 }, { state: 'chase', pack: 1, packIndex: i });
  const approaches: number[] = []; const sources = new Set<number>(); let pinnedAt = -1;
  for (let i = 0; i < 600; i++) {
    w.update(); for (const e of w.infected!.active) if (e.infected!.state === 'attack' && !sources.has(e.id)) { sources.add(e.id); approaches.push(Math.atan2(e.infected!.dz, e.infected!.dx)); }
    if (pinnedAt < 0 && w.infected!.playerPinned()) { pinnedAt = w.tick; expect(w.infected!.active.find((e) => e.infected!.grabUntil > w.tick)!.infected!.grabUntil - w.tick).toBe(36); }
  }
  expect(sources.size).toBe(4); let spread = 0; for (const a of approaches) for (const b of approaches) spread = Math.max(spread, Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))); expect(spread).toBeGreaterThanOrEqual(Math.PI / 2);
  expect(pinnedAt).toBeGreaterThan(0); for (const event of w.events.events().filter((e) => e.type === 'infected.attack')) if (event.type === 'infected.attack') { const telegraph = w.events.events().find((e) => e.type === 'telegraph' && e.attackId === event.attackId)!; expect(event.tick - telegraph.tick).toBeGreaterThanOrEqual(24); }
  for (const dog of w.infected!.active) dog.infected!.cooldown = 10000;
  const last = Math.max(...w.infected!.active.map((e) => e.infected!.grabUntil)); step(w, Math.max(0, last - w.tick)); expect(w.infected!.playerPinned()).toBe(false);
});
test('T-E07-17 @E07 @E07-AC17 cat remains hidden beyond 5 m then leaps/clings with three escape paths', async () => {
  const w = await arena(); w.combat!.damage.god = true; const cat = spawn(w, 'cat', 5.1, 0, 'idle'); step(w, 30);
  expect(cat.infected!.perched).toBe(true); expect(w.query({ kind: 'infected', detectable: true })).toHaveLength(0); const aim = { x: 1, z: 0.1 }; w.combat!.assist.apply(1, { x: 0, z: 0 }, aim, 20); expect(aim).toEqual({ x: 1, z: 0.1 });
  cat.transform.x = 4.9; w.spatial.set(cat.id, 4.9, 0); step(w, 1); expect(w.query({ detectable: true, kind: 'infected' })).toHaveLength(1);
  step(w, 90); expect(w.infected!.playerSpeedScale()).toBe(0.5); const attack = w.events.events().find((e) => e.type === 'infected.attack' && e.sourceId === cat.id)!; expect(cat.infected!.grabUntil - attack.tick).toBe(120);
  cat.infected!.cooldown = 10000; const expires = cat.infected!.grabUntil; step(w, expires - w.tick); expect(w.infected!.playerSpeedScale()).toBe(1);
  cat.infected!.grabUntil = w.tick + 120; cat.infected!.grabX = 0; cat.infected!.grabZ = 0; w.entities.get(1)!.transform.x = 3.1; w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); step(w, 1); expect(w.infected!.playerSpeedScale()).toBe(1);
  cat.infected!.grabUntil = w.tick + 120; w.events.emit({ type: 'combat.attack', tick: w.tick, attackId: 20, sourceId: 1, actionId: 'weapon.bat', side: 'LEFT', position: { ...w.entities.get(1)!.transform }, direction: { x: 1, z: 0 } }); expect(w.infected!.playerSpeedScale()).toBe(1);
});
test('T-E07-18 @E07 @E07-AC18 flock circles, telegraphs wave dives, individual birds die and survivors scatter at least 5 seconds', async () => {
  const w = await arena(); w.combat!.damage.god = true; const flock = spawn(w, 'crow', 5); expect(w.infected!.director.count).toBe(5); step(w, 1); expect(flock.infected!.birdPositions.filter((_, i) => i % 3 === 1).every((y) => y > 2)).toBe(true); step(w, 165);
  const attacks = w.events.events().filter((e) => e.type === 'infected.attack' && e.sourceId === flock.id); expect(attacks.length).toBeGreaterThanOrEqual(4);
  for (const attack of attacks) { const telegraph = w.events.events().find((e) => e.type === 'telegraph' && e.attackId === (attack as { attackId: number }).attackId); expect(telegraph).toBeDefined(); expect(attack.tick - telegraph!.tick).toBeGreaterThanOrEqual(36); }
  const b = flock.infected!; const origin = { x: b.birdPositions[0], z: b.birdPositions[2] };
  const damage = w.combat!.damage.apply({ sourceId: 1, targetId: flock.id, attackId: 99, actionId: 'weapon.grenade', origin, direction: { x: 1, z: 0 }, base: 100, multiplier: 1, type: 'explosive', radius: 0.2, knockback: 0, stagger: 0 });
  expect(damage).toBeGreaterThan(0); expect(b.birds).toBeLessThan(20); expect(b.birds).toBeGreaterThan(0); expect(b.birdAlive.filter(Boolean)).toHaveLength(b.birds); expect(w.infected!.director.count).toBe(b.birds * 0.25);
  const until = b.scatterUntil; step(w, 299); expect(b.state).toBe('scatter'); expect(w.tick).toBeLessThan(until); step(w, 1); expect(b.state).not.toBe('scatter');
  w.infected!.noise(flock.transform, 25, true); expect(b.scatterUntil).toBe(w.tick + 300);
});
test('T-E07-19a @E07 @E07-AC19 gorilla throws nearest medium E26 body with momentum damage and sixfold barricade damage', async () => {
  const w = await arena(), gorilla = spawn(w, 'gorilla', 10);
  for (const [id, x, cls] of [[101, 10.5, 'light'], [102, 12, 'medium'], [103, 14, 'medium']] as const) {
    const body = w.physics.world!.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 0.4, 0)); w.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3).setMass(35), body); w.infected!.props.props.push({ id, body, mass: 35, class: cls, radius: 0.3 });
  }
  step(w, 49); expect(w.infected!.props.flights).toHaveLength(1); expect(w.infected!.props.flights[0].prop.id).toBe(102); expect(w.infected!.props.flights[0].prop.body.linvel().x).toBeLessThan(-10); step(w, 80);
  expect(w.entities.get(1)!.health.current).toBeLessThan(100); expect(w.events.events().some((e) => e.type === 'infected.attack' && e.special === 'prop-throw' && e.amount > 0)).toBe(true); expect(w.infected!.barricadeDamage(gorilla.id, 10)).toBe(60);
  const w2 = await arena(), attacker = spawn(w2, 'gorilla', 10);
  const barricade = w2.entities.create({ kind: 'barricade', archetype: 'barricade.test', faction: 'neutral', transform: { ...attacker.transform, x: attacker.transform.x + 1 }, health: { current: 400, max: 400 } });
  step(w2, 49); expect(barricade.health.current).toBe(340);
});
test('T-E07-19b @E07 @E07-AC19 lion pounce pins for 1.5 seconds unless interrupted by two attack inputs', async () => {
  const w = await arena(); w.combat!.damage.god = true; const lion = spawn(w, 'lion', 8); step(w, 110); expect(w.infected!.playerPinned()).toBe(true); const until = lion.infected!.grabUntil; expect(until - w.events.events().filter((e) => e.type === 'infected.attack')[0].tick).toBe(90);
  lion.infected!.cooldown = 10000; step(w, until - w.tick - 1); expect(w.infected!.playerPinned()).toBe(true); step(w, 1); expect(w.infected!.playerPinned()).toBe(false);
  lion.infected!.grabUntil = w.tick + 90; lion.infected!.grabHits = 0; for (let i = 0; i < 2; i++) w.events.emit({ type: 'combat.attack', tick: w.tick, attackId: 100 + i, sourceId: 1, actionId: 'weapon.bat', side: 'LEFT', position: { ...w.entities.get(1)!.transform }, direction: { x: 1, z: 0 } }); expect(w.infected!.playerPinned()).toBe(false);
});

test('T-E07-floor @E07 the large arena keeps a stationary survivor grounded', async () => { const w = await arena(); step(w, 600); expect(w.entities.get(1)!.transform.y).toBeCloseTo(0.705, 2); });

test('T-E07-17b @E07 @E07-AC17 cat uses layout-authored perch points', async () => {
  const w = await arena(); w.loadScenario('animal-lab'); const cat = spawn(w, 'cat', 6, 0, 'idle');
  expect(cat.transform.x).toBe(5.1); expect(cat.transform.y).toBe(2.2); step(w, 1); expect(cat.infected!.hidden).toBe(true);
});
