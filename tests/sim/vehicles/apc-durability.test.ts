import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { emptyInput } from '../../../src/input/InputFrame';

async function fixture() {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 31);
  const v = w.vehicles!, id = v.spawn('vehicle.military-apc', { x: 0, z: 0 }), car = v.cars.get(id)!;
  // Isolate the fixed-phase resolver from AI locomotion, keeping real Rapier hull transforms.
  const step = (n = 1, speed = 0) => { for (let i = 0; i < n; i++) { w.tick++; car.physics.body.setLinvel({ x: speed, y: 0, z: 0 }, true); v.postPhysics(); w.solids.commit(); expect(w.solids.offenders).toEqual([]); } };
  // These are deliberate impact proposals, consumed by postPhysics before the
  // final contact commit. Ordinary spawn admission now rejects hull penetration.
  const spawn = (x: number, z: number, aware = true) => {
    const id = w.infected!.spawn('infected.runner', { x: 20, z: -10 }, { state: aware ? 'chase' : 'idle' });
    Object.assign(w.entities.get(id)!.transform, { x, z }); w.spatial.set(id, x, z); return id;
  };
  const move = (id: number, x: number, z: number) => { Object.assign(w.entities.get(id)!.transform, { x, z }); w.spatial.set(id, x, z); };
  return { w, v, id, car, step, spawn, move };
}

test('T-E31-06 @E31-AC06 ten distinct contacts cost 100 at any speed, overlap is billed once', async () => {
  for (const speed of [0, .3, 8]) {
    const s = await fixture();
    try {
      s.v.progressionArmor = .9;
      for (let i = 0; i < 10; i++) s.spawn(-2 + i * .4, 0, false);
      s.step(1, speed); expect(s.car.entity.health.current).toBe(900);
      s.step(120, speed); expect(s.car.entity.health.current).toBe(900);
      const contacts = s.w.events.events().filter(e => e.type === 'vehicle.durability-hit');
      expect(contacts).toHaveLength(10);
      expect(new Set(contacts.map(e => e.type === 'vehicle.durability-hit' ? e.contactId : 0)).size).toBe(10);
      for (const e of contacts) if (e.type === 'vehicle.durability-hit') {
        expect(e.source).toBe('contact'); expect(e.sourceId).toBe(s.id); expect(e.before - e.after).toBe(10);
      }
    } finally { s.w.dispose(); }
  }
});

test('T-E31-06-repeat @E31-AC06 re-contact requires 0.5m separation for 0.25s, downed active infected count', async () => {
  const s = await fixture();
  try {
    const id = s.spawn(0, 1.5, false), e = s.w.entities.get(id)!;
    e.health.current = 0; e.infected!.state = 'dead'; e.infected!.recoverAt = s.w.tick + 1000;
    s.step(); expect(s.car.entity.health.current).toBe(990);
    s.move(id, 0, 3); s.step(14); s.move(id, 0, 1.5); s.step(); expect(s.car.entity.health.current).toBe(990);
    s.move(id, 0, 2); s.step(30); s.move(id, 0, 1.5); s.step(); expect(s.car.entity.health.current).toBe(990);
    s.move(id, 0, 3); s.step(16); s.move(id, 0, 1.5); s.step(); expect(s.car.entity.health.current).toBe(980);
    e.infected!.recoverAt = -1; s.move(id, 0, 3); s.step(20); s.move(id, 0, 1.5); s.step(); expect(s.car.entity.health.current).toBe(980);
  } finally { s.w.dispose(); }
});

test('T-E31-07 @E31-AC07 four stopped hull attackers wind up and keep damaging for five seconds', async () => {
  const s = await fixture();
  try {
    const ids = [s.spawn(1, 2.5), s.spawn(-1, 2.5), s.spawn(1, -2.5), s.spawn(-1, -2.5)];
    s.step(36); expect(s.car.entity.health.current).toBe(1000);
    s.step(); expect(s.car.entity.health.current).toBe(960);
    s.step(264); expect(s.car.entity.health.current).toBe(880);
    const events = s.w.events.events(), hits = events.filter(e => e.type === 'vehicle.durability-hit');
    expect(hits).toHaveLength(12);
    for (const e of hits) if (e.type === 'vehicle.durability-hit') {
      expect(e.source).toBe('attack'); expect(e.attackId).not.toBeNull(); expect(e.contactId).toBeNull(); expect(e.before - e.after).toBe(10);
      const windup = events.find(a => a.type === 'vehicle.attack-windup' && a.attackId === e.attackId);
      expect(windup).toBeDefined(); expect(e.tick - windup!.tick).toBeGreaterThanOrEqual(36);
    }
    for (const id of ids) {
      const times = hits.filter(e => e.type === 'vehicle.durability-hit' && e.targetId === id).map(e => e.tick);
      for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(60);
      s.move(id, 0, 8);
    }
    s.step(180); expect(s.car.entity.health.current).toBe(880);
  } finally { s.w.dispose(); }
});

test('T-E31-07-surrounded @E31-AC07 moving hull needs four aware attackers in three quadrants', async () => {
  const s = await fixture();
  try {
    const ids = [s.spawn(1, 2.5), s.spawn(-1, 2.5), s.spawn(1, -2.5)];
    s.step(90, 1); expect(s.car.entity.health.current).toBe(1000);
    ids.push(s.spawn(-1, -2.5)); s.step(37, 1); expect(s.car.entity.health.current).toBe(960);
    s.move(ids[3], 1.5, -2.5); s.step(96, 1); expect(s.car.entity.health.current).toBe(920);
    s.move(ids[1], 1.5, 2.5); s.step(120, 1); expect(s.car.entity.health.current).toBe(920);
  } finally { s.w.dispose(); }
});

test('T-E31-07-cancel @E31-AC07 unaware, staggered and out-of-reach infected cannot finish hull attacks', async () => {
  const s = await fixture();
  try {
    const id = s.spawn(1, 2.5, false); s.step(90); expect(s.car.entity.health.current).toBe(1000);
    s.w.entities.get(id)!.infected!.state = 'chase'; s.step(20); s.move(id, 1, 4); s.step(60); expect(s.car.entity.health.current).toBe(1000);
    s.move(id, 1, 2.5); s.step(20); s.w.entities.get(id)!.combat!.staggerUntil = s.w.tick + 60; s.step(60); expect(s.car.entity.health.current).toBe(1000);
    s.step(36); expect(s.car.entity.health.current).toBe(990);
  } finally { s.w.dispose(); }
});

for (const hp of [1000, 0]) test(`T-E31-03-${hp} @E31-AC03 300 driving firing ticks at ${hp} HP emit no attacks, projectiles or blasts, mass still hits`, async () => {
  const s = await fixture();
  try {
    s.v.setFloorPolicy(s.id); s.v.damage(s.id, 1000 - hp);
    // Leave space for five seconds of driving and the final ram inside the arena's navigation grid.
    s.car.physics.body.setTranslation({ ...s.car.physics.body.translation(), x: -20 }, true); s.car.physics.postPhysics();
    const p = s.w.entities.get(1)!; Object.assign(p.transform, { x: s.car.entity.transform.x + .71, z: 2.025 });
    s.w.physics.playerBody!.setTranslation(p.transform, true); s.w.physics.playerBody!.setNextKinematicTranslation(p.transform);
    s.w.setInput({ interact: true }); s.w.update(); s.w.clearInput();
    expect(s.v.active).toBe(s.id);
    const startX = s.car.entity.transform.x;
    // RMB also defaults to the vehicle handbrake; keep its explicit control released for this firing probe.
    const frame = emptyInput(); frame.drive = { throttle: 1, steer: 0 }; frame.handbrake = false; frame.left.down = frame.left.held = frame.right.down = frame.right.held = true;
    s.w.applyInput(frame, 'keyboard'); for (let i = 0; i < 300; i++) s.w.update(); s.w.clearInput();
    expect(s.car.entity.transform.x).toBeGreaterThan(startX + 5);
    expect(s.car.physics.speed).toBeGreaterThan(1);
    expect(s.w.events.events().filter(e => ['combat.attack', 'combat.exploded', 'explosion'].includes(e.type))).toHaveLength(0);
    expect(s.w.combat!.projectiles).toHaveLength(0);
    const target = s.spawn(s.car.entity.transform.x + 3.1, s.car.entity.transform.z);
    s.car.physics.body.setLinvel({ x: 8, y: 0, z: 0 }, true); s.car.physics.postPhysics(); s.w.update();
    expect(s.w.entities.get(target)!.health.current).toBeLessThan(s.w.entities.get(target)!.health.max);
    expect(s.car.entity.health.current).toBe(hp === 0 ? 0 : 990);
  } finally { s.w.dispose(); }
});

test('T-E31-06-groups @E31-AC06 full durability allows twelve rammed groups of eight before exhaustion', async () => {
  const s = await fixture();
  try {
    for (let group = 0; group < 12; group++) {
      const ids = Array.from({ length: 8 }, (_, i) => s.spawn(-2 + i * .5, 0, false));
      s.step(1, 8); expect(s.car.entity.health.current).toBe(1000 - (group + 1) * 80);
      expect(ids.every(id => s.w.entities.get(id)!.health.current < s.w.entities.get(id)!.health.max)).toBe(true);
      ids.forEach(id => s.move(id, 20, 20)); s.step(16);
      expect(Object.keys(s.car.entity.vehicle!.apcContacts!.infected)).toHaveLength(0);
    }
    for (let i = 0; i < 8; i++) s.spawn(-2 + i * .5, 0, false);
    s.step(); expect(s.car.entity.health.current).toBe(0);
    s.step(); expect(s.car.entity.health.current).toBe(0);
    const contacts = s.w.events.events().filter(e => e.type === 'vehicle.durability-hit' && e.source === 'contact');
    expect(contacts).toHaveLength(100);
    expect(contacts.every(e => e.type === 'vehicle.durability-hit' && e.before - e.after === 10)).toBe(true);
  } finally { s.w.dispose(); }
});

test('T-E31-06-checkpoint @E31-AC06 @E31-AC07 checkpoint rebuild retains overlap and remaining hull windup', async () => {
  const { missionSandbox } = await import('../../fixtures/scenarios/mission-sandbox');
  const s = await fixture();
  try {
    const def = missionSandbox('survive'); def.onStart = []; def.steps[0].complete = { kind: 'timer', seconds: 1000 };
    const mission = s.w.loadMission(def); mission.begin();
    s.spawn(0, 0, false); const attacker = s.spawn(1, 2.5);
    s.step(20); mission.checkpoint('C');
    const saved = structuredClone(s.car.entity.vehicle!.apcContacts);
    s.step(80); mission.restore('C');
    const car = s.v.cars.get(s.id)!;
    expect(car.entity.health.current).toBe(990);
    const contact = car.entity.vehicle!.apcContacts!.infected[attacker];
    const remaining = contact.windupAt! + 36 - s.w.tick;
    expect(remaining).toBe(17);
    expect(car.entity.vehicle!.apcContacts!.sequence).toBe(saved!.sequence);
    for (let i = 0; i < remaining - 1; i++) { s.w.tick++; s.v.postPhysics(); }
    expect(car.entity.health.current).toBe(990);
    s.w.tick++; s.v.postPhysics(); expect(car.entity.health.current).toBe(980);
  } finally { s.w.dispose(); }
});

test('T-E31-06-attack @E31-AC06 @E31-AC07 one overlap has distinct contact/attack IDs and can ram after accelerating', async () => {
  const s = await fixture();
  try {
    const id = s.spawn(0, 1.6);
    s.step(37); expect(s.car.entity.health.current).toBe(980);
    const hits = s.w.events.events().filter(e => e.type === 'vehicle.durability-hit');
    expect(hits).toHaveLength(2);
    if (hits[0].type !== 'vehicle.durability-hit' || hits[1].type !== 'vehicle.durability-hit') throw new Error('Missing durability event');
    expect(hits[0].contactId).not.toBe(hits[1].attackId);
    expect(hits[0].source).toBe('contact'); expect(hits[1].source).toBe('attack');
    // Restore penetration after the stopped hull projection; there has been no re-arm separation.
    s.move(id, 0, 1.6);
    s.step(1, 8); expect(s.w.entities.get(id)!.health.current).toBeLessThan(s.w.entities.get(id)!.health.max);
    expect(s.car.entity.health.current).toBe(980);
  } finally { s.w.dispose(); }
});

test('T-E31-07-driver @E31-AC07 ordinary infected melee cannot bypass the occupied APC hull', async () => {
  const s = await fixture();
  try {
    const player = s.w.entities.get(1)!; Object.assign(player.transform, { x: .71, z: 2.025 });
    s.w.physics.playerBody!.setTranslation(player.transform, true); s.w.physics.playerBody!.setNextKinematicTranslation(player.transform);
    s.w.setInput({ interact: true }); s.w.update(); s.w.clearInput();
    const passengerId = s.w.npcs!.civilians.spawn('cashier', { x: .71, z: 2.025 });
    expect(s.v.boardPassenger(s.id, passengerId)).toBe(true);
    for (let i = 0; i < 61; i++) s.w.update();
    const attacker = s.spawn(0, 0), passenger = s.w.entities.get(passengerId)!;
    for (const target of [player, passenger]) {
      const amount = s.w.combat!.damage.apply({ sourceId: attacker, targetId: target.id, attackId: 31, actionId: 'infected.runner', origin: target.transform, direction: { x: 1, z: 0 }, base: 10, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
      expect(amount).toBe(0); expect(target.health.current).toBe(target.health.max);
    }
    for (let i = 0; i < 300; i++) s.w.update();
    expect(player.health.current).toBe(player.health.max); expect(passenger.health.current).toBe(passenger.health.max);
    expect(s.car.entity.health.current).toBeLessThan(1000);
    expect(s.v.active).toBe(s.id);
    expect(s.v.exit()).toBe(true);
    s.w.combat!.damage.apply({ sourceId: attacker, targetId: 1, attackId: 32, actionId: 'infected.runner', origin: player.transform, direction: { x: 1, z: 0 }, base: 10, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
    expect(player.health.current).toBe(player.health.max - 10);
  } finally { s.w.dispose(); }
});

test('T-E31-07-hull @E31-AC06 @E31-AC07 stopped infected remain outside the rotated hull without repeat contact billing', async () => {
  const s = await fixture();
  try {
    const rotation = Math.PI / 3;
    s.car.physics.body.setRotation({ x: 0, y: Math.sin(rotation / 2), z: 0, w: Math.cos(rotation / 2) }, true);
    const id = s.spawn(0, 0, false), target = s.w.entities.get(id)!;
    s.step();
    expect(s.car.physics.hullDistance(target.transform.x, target.transform.z)).toBeCloseTo(target.combat!.radius, 8);
    s.step(90); expect(s.car.entity.health.current).toBe(990);
    expect(s.car.entity.vehicle!.apcContacts!.infected[id].contactId).not.toBeNull();
  } finally { s.w.dispose(); }
});
