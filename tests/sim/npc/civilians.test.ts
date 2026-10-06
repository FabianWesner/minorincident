import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { npcs } from '../../../src/data/npcs';
async function world(seed = 1) { const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', seed); w.combat!.damage.god = true; return w; }
function step(w: SimWorld, ticks: number) { for (let i = 0; i < ticks; i++) w.update(); }
function pair(w: SimWorld) { const id = w.npcs!.civilians.spawn('cashier', { x: 5, z: 0 }), attacker = w.infected!.spawn('infected.runner', { x: 5, z: 0 }); return { e: w.entities.get(id)!, attacker: w.entities.get(attacker)! }; }
function hit(w: SimWorld, id: number, type: 'melee' | 'bullet' | 'explosive' = 'bullet') { return w.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: 1, actionId: 'weapon.pistol', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 100, multiplier: 1, type, knockback: 1, stagger: .5 }); }
test('T-E08-03 @E08 @E08-AC03 50 seeded cycles retain clothes/body position and exact tick timings/eyes', async () => {
  const timings = new Set<number>();
  for (let seed = 1; seed <= 50; seed++) {
    const w = await world(seed), { e, attacker } = pair(w); expect(w.npcs!.civilians.grab(e.id, attacker.id, true)).toBe(true);
    step(w, 89); expect(e.civilian!.state).toBe('grabbed'); step(w, 1); expect(e.civilian!.state).toBe('bitten');
    const biteTicks = e.civilian!.until - w.tick; expect(biteTicks).toBeGreaterThanOrEqual(60); expect(biteTicks).toBeLessThanOrEqual(120);
    step(w, biteTicks); expect(e.civilian!.state).toBe('down'); const down = e.civilian!.downTicks; timings.add(down); expect(down).toBeGreaterThanOrEqual(240); expect(down).toBeLessThanOrEqual(480);
    step(w, down - npcs.eyesTicks - 1); expect(e.civilian!.eyesGlow).toBe(false); step(w, 1); expect(e.civilian!.eyesGlow).toBe(true);
    step(w, npcs.eyesTicks); expect(e.civilian!.state).toBe('rising'); const p = { x: e.transform.x, z: e.transform.z };
    step(w, 71); expect(e.civilian!.state).toBe('rising'); step(w, 1); expect(e.civilian!.state).toBe('infected');
    const event = w.events.events().find(e => e.type === 'civilian.turned'); expect(event).toMatchObject({ variant: 'inf.cashier', position: p });
    if (event?.type === 'civilian.turned') expect(w.entities.get(event.infectedId)).toMatchObject({ infected: { variant: 'inf.cashier' }, transform: p });
    const states = w.events.events().filter(e => e.type === 'civilian.state').map(e => e.type === 'civilian.state' ? e.state : ''); expect(states).toEqual(['grabbed', 'bitten', 'down', 'rising', 'infected']); w.dispose();
  }
  expect(timings.size).toBeGreaterThan(30);
});
test('@E08 @E08-AC13 melee and shots both finish the vulnerable rising body', async () => {
  for (const type of ['melee', 'bullet'] as const) {
    const w = await world(), { e, attacker } = pair(w); w.npcs!.civilians.grab(e.id, attacker.id, true);
    while (e.civilian!.state !== 'rising') step(w, 1);
    expect(w.combat!.query.melee(1, e.transform, { x: 1, z: 0 }, 3, 360, 4)).toContain(e);
    hit(w, e.id, type); step(w, 1000); expect(e.civilian!.state).toBe('finished'); expect(w.events.events().some(event => event.type === 'civilian.turned')).toBe(false); w.dispose();
  }
});
test('T-E08-02 @E08 @E08-AC02 attack panic within .5s moves away over 3s', async () => {
  const w = await world(), id = w.npcs!.civilians.spawn('jogger', { x: 10, z: 0 }); const sourceId = w.infected!.spawn('infected.runner', { x: 2, z: 0 });
  w.events.emit({ type: 'infected.attack', tick: w.tick, sourceId, targetId: 1, amount: 10, special: 'lunge', attackId: 1 });
  step(w, 30); expect(w.entities.get(id)!.civilian!.state).toBe('flee'); const initial = w.entities.get(id)!.transform.x - 2;
  step(w, 180); expect(w.entities.get(id)!.transform.x - 2).toBeGreaterThan(initial + 10); w.dispose();
});
test('T-E08-12 @E08 @E08-AC12 kill/knockback rescue only during grab', async () => {
  for (const mode of ['kill', 'knockback', 'late'] as const) {
    const w = await world(), { e, attacker } = pair(w); w.npcs!.civilians.grab(e.id, attacker.id, true); step(w, mode === 'late' ? 90 : 30);
    if (mode === 'knockback') w.knockback(attacker, { x: 1, z: 0 }, 3); else attacker.health.current = 0;
    step(w, 1); expect(w.events.events().some(e => e.type === 'civilian.saved')).toBe(mode !== 'late');
    step(w, 1000); expect(e.civilian!.state).toBe(mode === 'late' ? 'infected' : 'hide'); w.dispose();
  }
});
test('T-E08-13 @E08 @E08-AC13 finishing eyes only; 100 real crowd shots pass through living people', async () => {
  const w = await world(), { e, attacker } = pair(w); w.npcs!.civilians.grab(e.id, attacker.id, true); hit(w, e.id); expect(e.health.current).toBe(100);
  step(w, 90); // bite starts at the end of the grab
  while (e.civilian!.state !== 'down') step(w, 1);
  hit(w, e.id); expect(e.civilian!.state).toBe('down'); while (!e.civilian!.eyesGlow) step(w, 1);
  expect(w.combat!.query.ray(1, e.transform, { x: 1, z: 0 }, 10)?.id).toBe(e.id); hit(w, e.id); step(w, 1000); expect(e.civilian!.state).toBe('finished'); expect(w.events.events().some(e => e.type === 'civilian.finished')).toBe(true); expect(w.events.events().some(e => e.type === 'civilian.turned')).toBe(false);
  attacker.health.current = 0;
  for (let i = 0; i < 10; i++) w.npcs!.civilians.spawn('jogger', { x: i + 1, z: (i + 1) * .2 });
  w.spawnDummy('infected.dummy', { x: 15, z: 3 }, { hp: 100000 });
  w.combat!.setLoadout(['weapon.pistol'], ['weapon.grenade']); w.combat!.runner.infiniteCharges = true;
  w.setInput({ left: { down: true, held: true, up: false }, aim: { x: 1, z: .2 } });
  step(w, 3600); expect(w.events.events().filter(e => e.type === 'combat.attack').length).toBeGreaterThanOrEqual(100);
  expect(w.events.events().filter(e => e.type === 'combat.hit' && w.entities.get(e.targetId)?.civilian)).toHaveLength(0);
  expect(w.events.events().filter(e => e.type === 'combat.hit' && e.actionId === 'weapon.pistol').length).toBeGreaterThanOrEqual(100);
  const living = [...w.entities.iterate()].find(e => e.civilian && e.civilian.state !== 'finished')!; hit(w, living.id, 'explosive'); expect(living.health.current).toBe(100); expect(living.civilian!.knockedUntil).toBeGreaterThan(w.tick); w.dispose();
});
test('T-E08-14 @E08 @E08-AC14 full cap postpones rising; mass turning never exceeds L1 cap/chain', async () => {
  const w = await world(); w.infected!.director.levelCap = 1; const { e, attacker } = pair(w); w.npcs!.civilians.grab(e.id, attacker.id, true); step(w, 1000); expect(e.civilian!.state).toBe('down'); attacker.health.current = 0; step(w, 73); expect(e.civilian!.state).toBe('infected'); expect(w.infected!.director.count).toBe(1); w.dispose();
  const mass = await world(); mass.infected!.director.levelCap = 15;
  const secondAttackers: number[] = [], bodies: number[] = [];
  for (let wave = 0; wave < 2; wave++) {
    const attackers: number[] = [];
    for (let i = 0; i < 15; i++) {
      const p = { x: -30 + i * 3, z: wave ? 20 : 5 }, id = mass.npcs!.civilians.spawn('cashier', p), attacker = mass.infected!.spawn('infected.runner', p);
      expect(mass.npcs!.civilians.grab(id, attacker, true)).toBe(true); attackers.push(attacker); bodies.push(id);
    }
    step(mass, 90); // These are real bites: removing attackers now cannot rescue the wave.
    if (wave === 0) for (const id of attackers) mass.entities.get(id)!.health.current = 0;
    else secondAttackers.push(...attackers);
  }
  step(mass, 900); expect(bodies.every(id => mass.entities.get(id)!.civilian!.state === 'down')).toBe(true);
  for (const id of secondAttackers.slice(0, 8)) mass.entities.get(id)!.health.current = 0;
  for (let i = 0; i < 1800; i++) { mass.update(); expect(mass.infected!.director.count).toBeLessThanOrEqual(15); }
  expect(mass.npcs!.civilians.turns).toBe(npcs.turnChainLimit[0]); mass.dispose();
});
test('T-E08-01 @E08 @E08-AC01 W0 civ-street 30 routines never stuck over five minutes', async () => {
  const w = await world(); w.loadScenario('civ-street'); const crowd = [...w.entities.iterate()].filter(e => e.kind === 'civilian'); expect(crowd).toHaveLength(30);
  // Moving paths loop; displacement is measured throughout each 20s window, not only matching loop endpoints.
  const starts = crowd.map(e => ({ x: e.transform.x, z: e.transform.z })), maxDistance = new Float64Array(30);
  for (let tick = 1; tick <= 18000; tick++) {
    w.update(); crowd.forEach((e, i) => { maxDistance[i] = Math.max(maxDistance[i], Math.hypot(e.transform.x - starts[i].x, e.transform.z - starts[i].z)); expect(w.infected!.nav.clear(e.transform.x, e.transform.z, .35)).toBe(true); });
    if (tick % 1200 === 0) { crowd.forEach((e, i) => { expect(maxDistance[i]).toBeGreaterThanOrEqual(.5); starts[i].x = e.transform.x; starts[i].z = e.transform.z; maxDistance[i] = 0; }); }
  }
  w.dispose();
});
