import assert from 'node:assert/strict';
import { loadLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { emptyInput } from '../../src/input/InputFrame';

async function l9SetPiecesFight(): Promise<void> {
  const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
  try {
    const l9 = world.missions!.l9!, vehicles = world.vehicles!, car = vehicles.cars.get(l9.state.carId)!;
    world.missions!.begin();
    for (let i = 0; i < 5; i++) world.update();
    const z0 = -305, pose = { x: -330, z: z0, y: car.physics.def.suspension + car.physics.def.wheelRadius + .15, yaw: 0 };
    Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose); car.physics.body.setTranslation(pose, true);
    car.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    const signals: string[] = [];
    world.events.on('mission.signal', e => { if (e.type === 'mission.signal') signals.push(e.name); });
    let leaperHits = 0;
    world.events.on('vehicle.durability-hit', e => { if (e.type === 'vehicle.durability-hit' && world.entities.get(e.targetId)?.infected?.alphaType === 'leaper') leaperHits++; });
    const drive = (shake: boolean) => {
      const f = emptyInput(), p = car.entity.transform;
      f.drive = { throttle: .7, steer: Math.max(-1, Math.min(1, (p.z - z0) * -.15 - p.yaw * 2)) }; f.brake = false; f.handbrake = shake;
      world.applyInput(f, 'keyboard'); world.update();
    };
    let clung: number | undefined;
    for (let i = 0; i < 1500 && clung === undefined; i++) { drive(false); clung = l9.driving.state.setPieces?.alphas.find(a => a.phase === 'hull')?.id; }
    assert.ok(clung !== undefined, `a leaper pounce lands on the hull (signals ${signals.filter(n => n.includes('leaper') || n.includes('setpiece')).join(',')})`);
    const leaper = world.entities.get(clung!)!;
    assert.ok(car.entity.vehicle!.attached.includes(clung), 'the landed leaper clings to the hull');
    assert.ok(leaper.transform.y > 1, 'clinging above the road, at the side rail');
    for (let i = 0; i < 100; i++) drive(false);
    assert.ok(leaperHits >= 2, 'the clinging leaper tears at the hull (landing + strike)');
    for (let i = 0; i < 10 && leaper.attachedTo !== undefined; i++) drive(true);
    assert.ok(leaper.attachedTo === undefined, 'a handbrake at speed throws it off');
    assert.ok(leaper.health.current > 0, 'thrown off, not run over');
    for (let i = 0; i < 1800 && !signals.includes('l9.thrower-landed') && !signals.includes('l9.thrower-hull-hit'); i++) drive(false);
    for (let i = 0; i < 120; i++) drive(false);
    const thrown = vehicles.obstacles.items.filter(o => !l9.driving.state.obstacleIds.includes(o.entity.id));
    assert.ok(signals.filter(n => n === 'l9.thrower-throw').length >= 1, 'the thrower lobs debris into the road');
    assert.ok(thrown.length >= 1, 'thrown debris becomes road obstacles');
    for (const o of thrown) {
      const flying = !!l9.driving.state.setPieces!.flights.some(f => f.obstacleId === o.entity.id);
      assert.ok(!!o.airborne === flying, 'only debris still in flight is airborne');
      if (!o.broken && !flying) { assert.ok(o.entity.transform.y === .5); assert.ok(o.collider.isEnabled() === true, 'landed debris has a live collider'); assert.ok(Math.abs(o.entity.transform.z - z0) < 8, 'lands on the APC lane'); }
    }
  } finally { world.dispose(); }
}


await l9SetPiecesFight();
console.log('L9 leaper and thrower proof passed');
