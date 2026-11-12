import { emptyInput } from '../../../src/input/InputFrame';
import { preset } from '../../../src/sim/progression/Campaign';
import { loadLevel } from '../../sim-runner/levels';

const scenarios = [
  { name: 'one brute', types: ['infected.brute'] },
  { name: 'six mixed', types: ['infected.runner', 'infected.brute', 'infected.armored', 'infected.sprinter', 'infected.crawler', 'infected.dog'] },
  { name: 'twenty ordinary', types: Array.from({ length: 20 }, (_, i) => ['infected.runner', 'infected.sprinter', 'infected.crawler', 'infected.dog'][i % 4]) },
] as const;

const rows: unknown[] = [];
for (let run = 0; run < scenarios.length; run++) {
  const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
  try {
    const scenario = scenarios[run], mission = world.missions!.l9!, car = world.vehicles!.cars.get(mission.state.carId)!, x0 = -300, z0 = -330;
    world.missions!.begin();
    for (let i = 0; i < 5; i++) world.update();
    const pose = { x: x0, z: z0, y: car.physics.def.suspension + car.physics.def.wheelRadius + .15, yaw: 0 };
    Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose);
    car.physics.body.setTranslation(pose, true); car.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < 30; i++) world.update();
    const entrySpeed = car.physics.def.topSpeed * .8;
    car.physics.body.setLinvel({ x: entrySpeed, y: 0, z: 0 }, true); car.physics.postPhysics();
    const ids = scenario.types.map((type, i) => world.infected!.spawn(type, {
      x: x0 + car.physics.def.length / 2 + 1 + Math.floor(i / 5) * .8,
      z: z0 + (i % 5 - 2) * .7,
    }, { state: 'chase' }));
    const armor = car.entity.health.current, drive = emptyInput(); drive.drive = { throttle: 1, steer: 0 }; drive.brake = false;
    let contactEvents = 0, minSpeed = Infinity, recovery = -1, lastTouch = -1, ramArmorCost = 0;
    const hits: { type: string | undefined; cost: number }[] = [];
    const off = world.events.on('vehicle.durability-hit', e => {
      if (e.type === 'vehicle.durability-hit' && e.source === 'contact' && ids.includes(e.targetId)) {
        hits.push({ type: world.entities.get(e.targetId)?.archetype, cost: e.before - e.after });
        contactEvents++; minSpeed = Math.min(minSpeed, car.physics.speed); lastTouch = world.tick; ramArmorCost += e.before - e.after;
      }
    });
    for (let i = 0; i < 600; i++) {
      world.applyInput(drive, 'keyboard'); world.update();
      const touching = ids.some(id => {
        const e = world.entities.get(id);
        return !!e && e.health.current > 0 && !e.attachedTo && car.physics.hullDistance(e.transform.x, e.transform.z) <= (e.combat?.radius ?? .4) + .02;
      });
      if (touching) minSpeed = Math.min(minSpeed, car.physics.speed);
      else if (lastTouch >= 0 && recovery < 0 && car.physics.speed >= car.physics.def.topSpeed * .9) recovery = world.tick - lastTouch;
    }
    off();
    rows.push({ scenario: scenario.name, entrySpeed: +entrySpeed.toFixed(2), minSpeed: Number.isFinite(minSpeed) ? +minSpeed.toFixed(2) : null, contactEvents,
      recoveryTicks: recovery, recoverySeconds: recovery < 0 ? null : +(recovery / 60).toFixed(2), armorLost: +(armor - car.entity.health.current).toFixed(1),
      ramArmorCost: +ramArmorCost.toFixed(1), otherArmorLoss: +(armor - car.entity.health.current - ramArmorCost).toFixed(1), hitCosts: hits.map(hit => hit.cost), endSpeed: +car.physics.speed.toFixed(2),
      position: { x: +car.entity.transform.x.toFixed(1), z: +car.entity.transform.z.toFixed(1) }, holding: mission.driving.holding(car.entity.id), stallAt: mission.driving.state.stallAt,
      throttle: car.physics.intent.throttle, brake: car.physics.intent.brake, ramProtectionTicks: Math.max(0, (car.entity.vehicle!.ramImpactUntil ?? 0) - world.tick),
      speedCap: car.physics.speedCap, stateSpeed: car.entity.vehicle!.speed, driver: car.entity.vehicle!.driver, active: world.vehicles!.active });
  } finally { world.dispose(); }
}
console.log(JSON.stringify(rows, null, 2));
