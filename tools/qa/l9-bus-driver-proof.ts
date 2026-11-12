import assert from 'node:assert/strict';
import { loadLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { emptyInput } from '../../src/input/InputFrame';

const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
try {
  world.missions!.begin(); world.update();
  const l9 = world.missions!.l9!, s = l9.driving.state, vehicles = world.vehicles!;
  const car = vehicles.cars.get(l9.state.carId)!, bus = vehicles.cars.get(s.busId)!;
  const place = (v: typeof car, x: number) => {
    const p = { x, z: 0, y: v.physics.def.suspension + v.physics.def.wheelRadius + .15, yaw: 0 };
    Object.assign(v.entity.transform, p); Object.assign(v.physics.previous, p);
    v.physics.body.setEnabled(true); v.physics.body.setTranslation(p, true);
    v.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    v.physics.body.setLinvel({ x: 10, y: 0, z: 0 }, true); v.entity.hidden = false;
  };
  place(car, 50); place(bus, 30); s.restarted = true; s.busLineAt = world.tick;
  vehicles.autopilot.set(s.busId, (l9.driving as unknown as { busIntent: never }).busIntent);
  const signals: string[] = [];
  world.events.on('mission.signal', e => { if (e.type === 'mission.signal') signals.push(e.name); });
  for (let i = 0; i < 1800 && s.busStoppedAt === null; i++) {
    const f = emptyInput();
    const warning = (s.busRamAt ?? 0) > world.tick;
    const yaw = car.entity.transform.yaw;
    f.drive = { throttle: 1, steer: warning ? -1 : Math.max(-1, Math.min(1, -yaw * 3)) }; f.brake = false;
    world.applyInput(f, 'keyboard'); world.update();
  }
  const result = { rams: s.busRams, hits: signals.filter(s => s === 'l9.bus-ram').length, misses: signals.filter(s => s === 'l9.bus-ram-missed').length, busHealth: bus.entity.health.current, stopped: s.busStoppedAt, armor: car.entity.health.current, signals: signals.filter(s => s.includes('bus')) };
  console.log(JSON.stringify(result));
  assert.ok(result.hits <= 1, 'steering driver takes at most one ram');
  assert.ok(result.misses >= 2, 'steering input actually evades rams');
} finally { world.dispose(); }
