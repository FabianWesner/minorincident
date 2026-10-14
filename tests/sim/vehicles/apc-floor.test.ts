import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { vehicleDef } from '../../../src/data/vehicles';
import { emptyInput } from '../../../src/input/InputFrame';

const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
async function fixture(floor = true) {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 31);
  const v = w.vehicles!, def = vehicleDef('vehicle.military-apc'), id = v.spawn(def.id, { x: 0, z: 0 }), car = v.cars.get(id)!;
  if (floor) v.setFloorPolicy(id, true);
  const player = w.entities.get(1)!;
  Object.assign(player.transform, { x: def.doorX, z: def.width / 2 + .55 });
  w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
  w.setInput({ interact: true }); step(w, 1); w.clearInput(); expect(v.active).toBe(id); step(w, 60);
  const hits = () => w.events.events().flatMap(e => e.type === 'vehicle.durability-hit' ? [e] : []);
  const stages = () => w.events.events().flatMap(e => e.type === 'vehicle.damage-stage' ? [e.stage] : []);
  return { w, v, id, car, def, hits, stages };
}
const throttle = (w: SimWorld, value: number, interact = false) => w.applyInput({ ...emptyInput(), drive: { throttle: value, steer: 0 }, interact }, 'keyboard');
/** Top speed reached while holding full throttle straight ahead on open ground. */
async function topSpeed(hp: number): Promise<number> {
  const s = await fixture();
  try {
    s.car.entity.health.current = hp; s.v.damage(s.id, 0);
    throttle(s.w, 1);
    let top = 0;
    for (let i = 0; i < 1500; i++) { s.w.update(); top = Math.max(top, s.car.physics.speed); }
    return top;
  } finally { s.w.dispose(); }
}

test('T-E31-09 @E31-AC09 zero HP caps terrain top speed to 60% of healthy and keeps driving', async () => {
  const healthy = await topSpeed(1000), floor = await topSpeed(0);
  expect(healthy).toBeGreaterThan(10);
  // The spec numbers: 60% of the 18 m/s healthy cap = 10.8 m/s (the engine taper reaches ~17.4 m/s healthy).
  expect(floor).toBeGreaterThan(10.8 * .98); expect(floor).toBeLessThan(10.8 * 1.02); expect(floor / healthy).toBeLessThan(.64);
});

test('T-E31-09-policy @E31-AC09 zero HP never explodes or exits; the exit input is ignored; extra hits log before=after=0', async () => {
  const s = await fixture();
  try {
    s.v.damage(s.id, 5000);
    expect(s.car.entity.health.current).toBe(0);
    throttle(s.w, 0, true); step(s.w, 2); throttle(s.w, 0, false);
    step(s.w, 400);
    expect(s.v.active).toBe(s.id); expect(s.v.canInteract()).toBe(false);
    expect(s.car.entity.vehicle!.damage).toBe('smoking'); expect(s.car.entity.vehicle!.explodeAt).toBeNull(); expect(s.car.entity.vehicle!.decay).toBeUndefined();
    const types = s.w.events.events().map(e => e.type);
    for (const forbidden of ['vehicle.exploded', 'vehicle.burning', 'vehicle.exited']) expect(types).not.toContain(forbidden);
    const near = s.w.infected!.spawn('infected.runner', { x: 0, z: 1.5 }, { state: 'idle' });
    s.w.spatial.set(near, 0, 1.5); step(s.w, 3);
    const last = s.hits().at(-1)!;
    expect(last.source).toBe('contact'); expect(last.before).toBe(0); expect(last.after).toBe(0);
  } finally { s.w.dispose(); }
});

test('T-E31-09-ram @E31-AC09 mass-contact ramming still damages infected at zero HP', async () => {
  const s = await fixture();
  try {
    s.v.damage(s.id, 5000);
    const id = s.w.infected!.spawn('infected.runner', { x: 40, z: 0 }, { state: 'idle' });
    let lowest = s.w.entities.get(id)!.health.current;
    throttle(s.w, 1);
    for (let i = 0; i < 600; i++) { s.w.update(); lowest = Math.min(lowest, s.w.entities.get(id)!.health.current); }
    expect(lowest).toBeLessThanOrEqual(0);
    expect(s.car.physics.speed).toBeGreaterThan(0);
  } finally { s.w.dispose(); }
});

test('T-E31-21 @E31-AC21 obstacle and wreck contacts bill 10 per onset, aliases bill once, floor clamps at zero', async () => {
  const s = await fixture();
  try {
    const front = s.def.length / 2, post = s.v.obstacles.spawn('jersey-barrier', { x: front + .35 + .05, z: 0 });
    const item = s.v.obstacles.items.find(o => o.entity.id === post)!;
    step(s.w, 120);
    expect(s.hits()).toHaveLength(1);
    const first = s.hits()[0]; expect(first.source).toBe('obstacle'); expect(first.targetId).toBe(post); expect(first.contactId).not.toBeNull();
    expect(first.before - first.after).toBe(10);
    // Re-contact needs 0.5 m of clearance held for 0.25 s.
    item.entity.transform.x += 3; step(s.w, 10); item.entity.transform.x -= 3; step(s.w, 2); expect(s.hits()).toHaveLength(1);
    item.entity.transform.x += 3; step(s.w, 20); item.entity.transform.x -= 3; step(s.w, 2); expect(s.hits()).toHaveLength(2);
    expect(s.car.entity.health.current).toBe(980);
    // One wreck, two overlapping collider boxes: a single contact.
    item.entity.transform.x += 30;
    s.v.wrecks.set(9001, [{ x: 0, z: s.def.width / 2 + .5, halfX: 1.5, halfZ: .45 }, { x: 1, z: s.def.width / 2 + .4, halfX: 1.5, halfZ: .35 }]);
    step(s.w, 60);
    expect(s.hits().filter(e => e.targetId === 9001)).toHaveLength(1);
    expect(s.car.entity.health.current).toBe(970);
    // At the floor further onsets still log with before = after = 0.
    s.v.damage(s.id, 5000); s.v.wrecks.delete(9001); step(s.w, 30); s.v.wrecks.set(9002, [{ x: 0, z: s.def.width / 2 + .5, halfX: 1, halfZ: .45 }]); step(s.w, 3);
    const last = s.hits().at(-1)!; expect(last.targetId).toBe(9002); expect(last.before).toBe(0); expect(last.after).toBe(0);
    expect(s.car.entity.health.current).toBe(0);
  } finally { s.w.dispose(); }
});

test('T-E31-22 @E31-AC22 boundary percentages select cumulative stages, each announced once; reload replays nothing', async () => {
  const cases: [number, number][] = [[76, 0], [75, 1], [51, 1], [50, 2], [26, 2], [25, 3], [1, 3], [0, 4]];
  for (const [percent, stage] of cases) {
    const s = await fixture();
    try {
      s.v.damage(s.id, 1000 - percent * 10);
      expect(s.car.entity.vehicle!.stage ?? 0).toBe(stage);
      expect(s.stages()).toEqual(Array.from({ length: stage }, (_, i) => i + 1));
      expect(s.car.entity.vehicle!.damage).toBe(stage >= 3 ? 'smoking' : 'normal');
    } finally { s.w.dispose(); }
  }
  const s = await fixture();
  try {
    s.v.damage(s.id, 520);
    const saved = structuredClone({ health: s.car.entity.health, vehicle: s.car.entity.vehicle });
    s.v.damage(s.id, 1000); expect(s.stages()).toEqual([1, 2, 3, 4]);
    // Checkpoint retry: the saved HP and stage return, with no cue replay; a later hit crosses only the next boundary.
    Object.assign(s.car.entity.health, saved.health); Object.assign(s.car.entity.vehicle!, saved.vehicle);
    const before = s.stages().length;
    s.v.rebuild(false, 0);
    const car = s.v.cars.get(s.id)!;
    expect(car.entity.vehicle!.stage).toBe(2); expect(car.physics.speedCap).toBe(1); expect(s.stages()).toHaveLength(before);
    s.v.damage(s.id, 300); expect(car.entity.vehicle!.stage).toBe(3);
    s.v.damage(s.id, 5000); expect(car.physics.speedCap).toBeCloseTo(.6);
  } finally { s.w.dispose(); }
});

test('T-E31-09-scope @E31-AC09 other vehicles keep the ordinary zero rules', async () => {
  const s = await fixture(false);
  try {
    s.v.damage(s.id, 5000);
    expect(s.car.entity.vehicle!.stage).toBeUndefined(); expect(s.car.entity.vehicle!.floor).toBeUndefined();
    expect(s.car.physics.speedCap).toBe(1);
    expect(s.car.entity.vehicle!.explodeAt).not.toBeNull();
  } finally { s.w.dispose(); }
});

test('T-E31-09-controls @E31-AC09 zero APC still brakes, reverses and steers with its original driver', async () => {
  const s = await fixture();
  try {
    s.v.damage(s.id, 1000);
    // Keep the drive/brake/reverse cycle on the 100 m arena ground.
    throttle(s.w, 1); step(s.w, 240);
    expect(s.car.physics.speed).toBeGreaterThan(5);
    s.w.applyInput({ ...emptyInput(), brake: true, drive: { throttle: 0, steer: 0 } }, 'keyboard'); step(s.w, 180);
    expect(s.car.physics.speed).toBeLessThan(.5);
    const stoppedX = s.car.entity.transform.x;
    throttle(s.w, -1); step(s.w, 360);
    expect(s.car.entity.transform.x).toBeLessThan(stoppedX - 5);
    expect(s.car.physics.forwardSpeed).toBeLessThan(-1);
    s.w.applyInput({ ...emptyInput(), drive: { throttle: -1, steer: .5 } }, 'keyboard'); step(s.w, 120);
    expect(Math.abs(s.car.entity.transform.yaw)).toBeGreaterThan(.1);
    expect(s.v.active).toBe(s.id); expect(s.car.entity.vehicle!.driver).toBe(1);
    expect(s.car.entity.health.current).toBe(0);
    expect(s.w.events.events().filter(e => ['vehicle.exited', 'vehicle.exploded', 'vehicle.burning'].includes(e.type))).toHaveLength(0);
  } finally { s.w.dispose(); }
});

for (const hp of [500, 0]) test(`T-E31-08-no-repair-${hp} @E31-AC08 medkit healing and elapsed time never repair ${hp}-HP APC durability`, async () => {
  const s = await fixture();
  try {
    s.v.damage(s.id, 1000 - hp);
    const player = s.w.entities.get(1)!; player.health.current = 1;
    const item = s.w.pickups!.spawn('medkit', player.transform);
    step(s.w, 1);
    expect(player.health.current).toBeGreaterThan(1);
    expect(s.w.entities.get(item)!.pickup).toMatchObject({ collected: true });
    step(s.w, 600);
    expect(s.car.entity.health.current).toBe(hp);
    expect(s.v.active).toBe(s.id);
  } finally { s.w.dispose(); }
});
