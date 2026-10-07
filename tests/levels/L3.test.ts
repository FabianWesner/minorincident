import { expect, test } from 'vitest';
import { loadLevel } from '../../tools/sim-runner/levels';
import { emptyInput } from '../../src/input/InputFrame';
import { LevelThreeBot } from '../../src/debug/bot/LevelThreeBot';
for (const route of ['market', 'park'] as const) {
  test(`@E21 @E21-AC01 graph completes via ${route} and cancels the other route`, async () => {
    const w = await loadLevel('L3', 1);
    try { const m = w.missions!; m.completeObjective('forecourt'); m.completeObjective('car'); m.completeObjective(`${route}-route`);
      expect(m.state.steps[`${route === 'market' ? 'park' : 'market'}-route`].status).toBe('cancelled');
      for (let i = 0; i < 30 && m.state.phase === 'playing'; i++) m.completeObjective();
      expect(m.state.states.collapsed).toBe(true); w.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); for (let i = 0; i < 30; i++) w.update(); expect(m.state.phase).toBe('result');
      expect(w.events.events().filter(e => e.type === 'mission.signal').map(e => e.type === 'mission.signal' ? e.name : '')).toContain('L3.perimeter-collapsed');
      m.continue(); expect(m.state.phase).toBe('progression');
    } finally { w.dispose(); }
  });
}
for (const blast of ['bloated', 'propane'] as const) test(`@E21 @E21-AC06 heavy wall stops a real sedan; ${blast} breaks it`, async () => {
  const w = await loadLevel('L3', 1);
  try {
    const m = w.missions!; m.completeObjective('forecourt'); m.completeObjective('car');
    const car = w.vehicles!.cars.get(m.state.actors.sedan)!;
    const wall = w.vehicles!.obstacles.items.find(o => o.entity.archetype === 'obstacle.wall')!;
    car.physics.body.setTranslation({ x: wall.entity.transform.x-8, y: .65, z: wall.entity.transform.z }, true);
    car.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    w.vehicles!.active = car.entity.id; car.entity.vehicle!.driver = 1;
    w.applyInput({ ...emptyInput(), drive: { throttle: 1, steer: 0 } }, 'keyboard');
    for (let i = 0; i < 180; i++) w.update();
    expect(car.entity.transform.x).toBeLessThan(wall.entity.transform.x); expect(wall.broken).toBe(false);
    w.vehicles!.active = null; car.entity.vehicle!.driver = null; w.clearInput();
    if (blast === 'propane') {
      const propane = w.entities.values().find(e => e.hazard?.kind === 'propane' && Math.hypot(e.transform.x-wall.entity.transform.x,e.transform.z-wall.entity.transform.z) < 5)!;
      w.hazards!.hit(propane.id, 1000, 'bullet');
    } else {
      const id = w.infected!.spawn('infected.bloated', { x: wall.entity.transform.x-2, z: wall.entity.transform.z });
      w.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: 1, actionId: 'weapon.bat', base: 1000, multiplier: 1, type: 'melee', origin: w.entities.get(1)!.transform, direction: { x: 1, z: 0 }, knockback: 0, stagger: 0 });
    }
    for (let i = 0; i < 120; i++) w.update(); expect(wall.broken).toBe(true); expect(wall.collider.isEnabled()).toBe(false);
  } finally { w.dispose(); }
});
test('@E21 @E21-AC07 L3 timeout retries with restored checkpoint timer plus 60s', async () => {
  const w = await loadLevel('L3', 7);
  try { const m = w.missions!, bot = new LevelThreeBot(w);
    for (let i = 0; i < 36000 && m.state.checkpoint !== 'checkpoint'; i++) { w.applyInput(bot.sample(), 'keyboard'); w.update(); }
    expect(m.state.checkpoint).toBe('checkpoint'); const remaining = m.state.deadlineTicks!;
    m.state.deadlineTicks = 1; w.clearInput(); w.update(); expect(m.state.failure).toBe('timeout');
    m.restore(); expect(m.state.deadlineTicks).toBe(remaining+3600); expect(m.state.steps.checkpoint.status).toBe('active');
  } finally { w.dispose(); }
});
test('@E21 @E21-AC04 parked sedan blocks foot navigation until the native driver enters', async () => {
  const w = await loadLevel('L3', 1);
  try {
    const m = w.missions!; m.completeObjective('forecourt'); m.completeObjective('car');
    const car = w.vehicles!.cars.get(m.state.actors.sedan)!;
    expect(w.infected!.nav.clear(car.entity.transform.x, car.entity.transform.z, .3)).toBe(false);
    const bot = new LevelThreeBot(w);
    for (let i = 0; i < 600 && w.vehicles!.active === null; i++) { w.applyInput(bot.sample(), 'keyboard'); w.update(); }
    expect(w.vehicles!.active).toBe(car.entity.id);
    expect(w.infected!.nav.clear(car.entity.transform.x, car.entity.transform.z, .3)).toBe(true);
  } finally { w.dispose(); }
});
test('@E21 @E21-AC04 bot leaves the conservative nav box beside an angled parked sedan', async () => {
  const w = await loadLevel('L3', 1);
  try {
    const m = w.missions!; m.completeObjective('forecourt'); m.completeObjective('car');
    const car = w.vehicles!.cars.get(m.state.actors.sedan)!, yaw = Math.PI / 4;
    car.physics.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    w.update(); w.events.emit({ type: 'vehicle.exited', tick: w.tick, sourceId: car.entity.id, targetId: 1 });
    m.completeObjective('market-route');
    const c = car.entity.transform, player = w.entities.get(1)!;
    Object.assign(player.transform, { x: c.x+Math.sin(yaw)*1.55, z: c.z+Math.cos(yaw)*1.55 });
    w.physics.playerBody!.setTranslation(player.transform, true);
    expect(w.infected!.nav.clear(player.transform.x, player.transform.z, .45)).toBe(false);
    const frame = new LevelThreeBot(w).sample();
    expect(frame.move.x*Math.sin(yaw)+frame.move.z*Math.cos(yaw)).toBeGreaterThan(.9);
  } finally { w.dispose(); }
});
