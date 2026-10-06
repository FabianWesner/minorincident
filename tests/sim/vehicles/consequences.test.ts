import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { emptyInput } from '../../../src/input/InputFrame';
import { Driver } from '../../../src/debug/bot/Driver';
import { lightObstacles, heavyObstacles } from '../../../src/sim/vehicles/Obstacles';
async function fixture() { const world = new SimWorld(); await world.init(); world.loadScenario('drive-course'); const car = world.vehicles!.cars.get(2)!; const tick = (count = 1) => { for (let i = 0; i < count; i++) world.update(); }; tick(36); return { world, car, tick, speed(value: number) { const frame = emptyInput(); frame.drive = { throttle: 1, steer: 0 }; world.applyInput(frame, 'keyboard'); car.physics.body.setLinvel({ x: value, y: 0, z: 0 }, true); car.physics.postPhysics(); } }; }
test('T-E09-04 @E09-AC04 runner run-over kill cause and brute knockback/ramDamage', async () => {
  const s = await fixture();
  try {
    const runner = s.world.spawnDummy('infected.runner', { x: 2, z: 0 }, { hp: 40 }); s.speed(4.1); s.tick();
    expect(s.world.getEntity(runner)!.health.current).toBe(0);
    expect(s.world.events.events().some(e => e.type === 'combat.kill' && e.targetId === runner && e.cause === 'vehicle')).toBe(true);
    const x = s.car.entity.transform.x + 2, brute = s.world.spawnDummy('infected.brute', { x, z: 0 }, { hp: 1000, ramDamage: 73 });
    const hp = s.car.entity.health.current; s.speed(5); s.tick();
    expect(s.world.getEntity(brute)!.transform.x - x).toBeGreaterThanOrEqual(2.9);
    expect(s.car.entity.health.current).toBe(hp - 73);
  } finally { s.world.dispose(); }
});
test('T-E09-05 @E09-AC05 every light obstacle breaks with <=25% slowdown; every heavy obstacle stops and damages', async () => {
  for (const kind of [...lightObstacles, ...heavyObstacles]) {
    const s = await fixture();
    try {
      const id = s.world.vehicles!.obstacles.spawn(kind, { x: 2.5, z: 0 }); s.speed(6); s.tick();
      if ((lightObstacles as readonly string[]).includes(kind)) { expect(s.world.getEntity(id)!.health.current).toBe(0); expect(s.car.physics.speed).toBeGreaterThanOrEqual(4.5); expect(s.world.vehicles!.obstacles.debris).toHaveLength(3); }
      else { expect(s.car.physics.speed).toBeLessThan(.5); expect(s.car.entity.health.current).toBeLessThan(s.car.entity.health.max); expect(s.world.getEntity(id)!.health.current).toBe(1); }
    } finally { s.world.dispose(); }
  }
});
test('T-E09-05b @E09-AC05 below-threshold impact stays solid and debris bodies remain bounded/recycled', async () => {
  const s = await fixture();
  try {
    const id = s.world.vehicles!.obstacles.spawn('cone', { x: 2.3, z: 0 }); s.speed(4); s.tick(); expect(s.world.getEntity(id)!.health.current).toBe(1);
    for (let i = 0; i < 20; i++) { s.world.vehicles!.obstacles.spawn('cone', { x: s.car.entity.transform.x + 2.3, z: 0 }); s.speed(6); s.tick(); }
    expect(s.world.vehicles!.obstacles.debris).toHaveLength(24);
    s.world.clearInput(); s.tick(301); expect(s.world.vehicles!.obstacles.debris.every(d => !d.body.isEnabled())).toBe(true);
  } finally { s.world.dispose(); }
});
test('T-E09-06 @E09-AC06 strict smoke/fire thresholds, exactly three-second fuse, eject and splash', async () => {
  const s = await fixture();
  try {
    s.world.vehicles!.damage(2, 180); expect(s.car.entity.vehicle!.damage).toBe('normal');
    s.world.vehicles!.damage(2, 1); expect(s.car.entity.vehicle!.damage).toBe('smoking');
    s.world.vehicles!.damage(2, 74); expect(s.car.entity.vehicle!.damage).toBe('smoking');
    s.world.vehicles!.damage(2, 1); expect(s.car.entity.vehicle!.damage).toBe('burning');
    const target = s.world.spawnDummy('infected.runner', { x: 4, z: 0 }, { hp: 20 });
    s.world.vehicles!.damage(2, 44); const started = s.world.tick; s.tick(179);
    expect(s.car.entity.vehicle!.damage).toBe('burning'); expect(s.world.vehicles!.active).toBe(2);
    s.tick(); expect(s.car.entity.vehicle!.damage).toBe('exploded'); expect(s.world.vehicles!.active).toBeNull();
    expect(s.world.getEntity(1)!.hidden).toBe(false); expect(s.world.getEntity(target)!.health.current).toBe(0);
    expect(s.world.getEntity(1)!.health.current).toBeLessThan(100);
    expect(s.world.events.events().filter(e => e.type === 'vehicle.exploded').map(e => e.tick)).toEqual([started + 180]);
    s.tick(60); expect(s.world.events.events().filter(e => e.type === 'vehicle.exploded')).toHaveLength(1);
  } finally { s.world.dispose(); }
});
test('T-E09-07 @E09-AC07 proximity/speed grab limits and acceleration/steering shake-off', async () => {
  for (const mode of ['accelerate', 'steer']) {
    const s = await fixture();
    try {
      for (let i = 0; i < 5; i++) s.world.spawnDummy('infected.runner', { x: .8 + i * .05, z: .4 });
      const far = s.world.spawnDummy('infected.runner', { x: 5, z: 0 }); s.tick();
      expect(s.car.entity.vehicle!.attached).toHaveLength(4); expect(s.world.getEntity(far)!.hidden).not.toBe(true);
      if (mode === 'accelerate') s.speed(8.1);
      else { const input = emptyInput(); input.drive = { throttle: 0, steer: 1 }; s.world.applyInput(input, 'keyboard'); }
      s.tick(); expect(s.car.entity.vehicle!.attached).toHaveLength(0);
      expect(s.world.events.events().filter(e => e.type === 'vehicle.shaken')).toHaveLength(4);
    } finally { s.world.dispose(); }
  }
});
test('T-E09-09 @E09-AC09 driver completes 600m cone course under 90s without cheats', async () => {
  const s = await fixture(); const driver = new Driver(s.world), samples: number[] = [];
  try {
    while (!driver.finished && s.world.tick < 5400) { s.world.applyInput(driver.sample(), 'keyboard'); const start = performance.now(); s.tick(); samples.push(performance.now() - start); }
    expect(driver.finished).toBe(true); expect(s.car.entity.transform.x).toBeGreaterThanOrEqual(600);
    expect(s.world.tick / 60).toBeLessThanOrEqual(90);
    expect(s.world.events.events().some(e => e.type === 'vehicle.recovering')).toBe(false);
    samples.sort((a,b) => a-b); const metrics = { courseSeconds: s.world.tick / 60, travelledX: s.car.entity.transform.x, simMsP95: samples[Math.floor(samples.length * .95)], hp: s.car.entity.health.current }; expect(metrics.simMsP95).toBeLessThan(4); mkdirSync('test-results/epics/E09', { recursive: true }); writeFileSync('test-results/epics/E09/course-metrics.json', JSON.stringify(metrics, null, 2));
  } finally { s.world.dispose(); }
});
test('T-E09-09b @E09-AC09 commanded stuck car starts reverse recovery after a three-second travel window', async () => {
  const s = await fixture();
  try {
    s.world.vehicles!.obstacles.spawn('wall', { x: 2.5, z: 0 }); const frame = emptyInput(); frame.drive = { throttle: 1, steer: 0 }; s.world.applyInput(frame, 'keyboard');
    s.tick(360); expect(s.world.events.events().some(e => e.type === 'vehicle.recovering')).toBe(true);
    expect(s.car.entity.transform.x).toBeLessThan(0);
  } finally { s.world.dispose(); }
});

test('T-E09-06b @E09-AC06 a boxed-in driver is forcibly ejected and attached infected are released', async () => {
  const s = await fixture();
  try {
    const infected = s.world.spawnDummy('infected.runner', { x: .8, z: .4 }); s.tick(); expect(s.world.getEntity(infected)!.attachedTo).toBe(2);
    const R = await import('@dimforge/rapier3d-compat');
    for (const z of [-1.45, 1.45]) s.world.physics.world!.createCollider(R.ColliderDesc.cuboid(2, .6, .3).setTranslation(0, .6, z));
    s.world.physics.world!.step(); expect(s.world.vehicles!.exit()).toBe(false);
    s.world.vehicles!.damage(2, 300); s.tick(180);
    expect(s.world.vehicles!.active).toBeNull(); expect(s.world.getEntity(1)!.hidden).toBe(false); expect(s.world.getEntity(infected)!.attachedTo).toBeUndefined();
  } finally { s.world.dispose(); }
});

test('T-E09-06c @E09-AC06 ACTION can exit a zero-HP car during its fuse', async () => {
  const s = await fixture();
  try { s.world.vehicles!.damage(2, 300); const input = emptyInput(); input.interact = true; s.world.applyInput(input, 'keyboard'); s.tick(); expect(s.world.vehicles!.active).toBeNull(); expect(s.car.entity.vehicle!.damage).toBe('burning'); } finally { s.world.dispose(); }
});
