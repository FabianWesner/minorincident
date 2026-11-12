import { action } from '../../../src/data/actions/catalog';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { emptyInput } from '../../../src/input/InputFrame';

const fireWeapons = ['weapon.army-mg', 'weapon.assault-rifle'] as const;
const attackRows: unknown[] = [];
for (const role of ['brute', 'butcher'] as const) for (const distance of [6, 3]) for (const weaponId of fireWeapons) {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena', 1); world.combat!.damage.god = false;
  try {
    const player = world.entities.get(1)!; player.health.current = player.health.max = 10000;
    const targetId = world.infected!.spawn(`infected.${role}`, { x: distance, z: 0 }, { state: 'chase', yaw: 180 });
    const target = world.entities.get(targetId)!; const gun = action(weaponId), cadence = Math.max(1, Math.round(60 / gun.fireRate!));
    let shots = 0, attacksStarted = 0, wasAttacking = false, deadAt: number | null = null;
    for (let tick = 0; tick < 600; tick++) {
      if (tick % cadence === 0 && target.health.current > 0) {
        world.combat!.damage.apply({ attackId: tick + 1, actionId: gun.id, sourceId: 1, targetId, origin: { x: player.transform.x, z: player.transform.z }, direction: { x: 1, z: 0 }, base: gun.damage, multiplier: 1, type: 'bullet', knockback: gun.knockback, stagger: gun.stagger });
        shots++;
      }
      const attacking = !!target.combat?.attacking;
      if (attacking && !wasAttacking) attacksStarted++;
      wasAttacking = attacking;
      world.update();
      if (target.health.current <= 0 && deadAt === null) deadAt = tick + 1;
    }
    const hits = world.events.events().filter(e => e.type === 'infected.attack' && e.sourceId === targetId && e.targetId === 1);
    attackRows.push({ role, distanceM: distance, weapon: weaponId, durationSeconds: 10, shotsFired: shots, attackStarts: attacksStarted, landedHits: hits.length, windupCompletions: new Set(hits.map(e => e.type === 'infected.attack' ? e.attackId : -1)).size, playerHpLost: +(10000 - player.health.current).toFixed(2), targetHpEnd: target.health.current, targetKilledAtSeconds: deadAt === null ? null : +(deadAt / 60).toFixed(3), positionAtEnd: { x: +target.transform.x.toFixed(3), z: +target.transform.z.toFixed(3) } });
  } finally { world.dispose(); }
}

const weapons = ['weapon.handgun', 'weapon.assault-rifle', 'weapon.army-mg', 'weapon.shotgun'] as const;
const armorRows: unknown[] = [];
for (const weaponId of weapons) for (const direction of ['front', 'rear', 'side'] as const) {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena', 1); world.combat!.damage.god = false;
  try {
    const targetId = world.infected!.spawn('infected.armored', { x: 0, z: 0 }, { state: 'idle', yaw: 0 });
    const target = world.entities.get(targetId)!; const gun = action(weaponId), cadence = Math.max(1, Math.round(60 / gun.fireRate!));
    const origin = direction === 'front' ? { x: 5, z: 0 } : direction === 'rear' ? { x: -5, z: 0 } : { x: 0, z: 5 };
    const dx = -origin.x, dz = -origin.z, len = Math.hypot(dx, dz), shotDirection = { x: dx / len, z: dz / len };
    let shots = 0, damage = 0;
    while (target.health.current > 0 && shots < 10000) {
      target.transform.yaw = 0;
      const amount = world.combat!.damage.apply({ attackId: shots + 1, actionId: gun.id, sourceId: 1, targetId, origin, direction: shotDirection, base: gun.damage, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
      damage += amount; shots++;
      for (let tick = 0; tick < cadence && target.health.current > 0; tick++) world.update();
    }
    const ordinary = world.entities.get(world.infected!.spawn('infected.runner', { x: 20, z: 20 }, { state: 'idle' }))!;
    let ordinaryShots = 0;
    while (ordinary.health.current > 0 && ordinaryShots < 1000) {
      world.combat!.damage.apply({ attackId: ordinaryShots + 50000, actionId: gun.id, sourceId: 1, targetId: ordinary.id, origin: { x: 25, z: 20 }, direction: { x: -1, z: 0 }, base: gun.damage, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
      ordinaryShots++;
    }
    armorRows.push({ target: 'infected.armored', weapon: weaponId, direction, shotsToKill: shots, landedDamage: +damage.toFixed(2), targetMaxHp: target.health.max, ordinaryTarget: 'infected.runner', ordinaryHp: ordinary.health.max, ordinaryShotsToKill: ordinaryShots, ratioToOrdinary: +(shots / ordinaryShots).toFixed(2) });
  } finally { world.dispose(); }
}

const vehicleWorld = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
let apcRam: unknown;
try {
  const mission = vehicleWorld.missions!.l9!, car = vehicleWorld.vehicles!.cars.get(mission.state.carId)!;
  vehicleWorld.missions!.begin(); for (let i = 0; i < 5; i++) vehicleWorld.update();
  for (const infected of [...vehicleWorld.infected!.active]) vehicleWorld.infected!.release(infected);
  const x = -500, z = 0, pose = { x, z, y: car.physics.def.suspension + car.physics.def.wheelRadius + .15, yaw: 0 };
  Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose); car.physics.body.setTranslation(pose, true); car.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  for (let i = 0; i < 30; i++) vehicleWorld.update();
  const entrySpeed = car.physics.def.topSpeed * .8; car.physics.body.setLinvel({ x: entrySpeed, y: 0, z: 0 }, true); car.physics.postPhysics();
  const ids = Array.from({ length: 20 }, (_, i) => vehicleWorld.infected!.spawn('infected.runner', { x: x + car.physics.def.length / 2 + .8 + Math.floor(i / 4) * .7, z: z + (i % 4 - 1.5) * .5 }, { state: 'chase' }));
  const beforeArmor = car.entity.health.current, input = emptyInput(); input.drive = { throttle: 1, steer: 0 }; input.brake = false;
  const contacts: Array<{ target: string; speedMps: number; armorCost: number }> = [], damageEvents: Array<{ source: string; cost: number }> = [];
  let minContactSpeed = Infinity, minTouchSpeed = Infinity;
  const stop = vehicleWorld.events.on('vehicle.durability-hit', e => {
    if (e.type !== 'vehicle.durability-hit' || e.sourceId !== car.entity.id) return;
    const cost = e.before - e.after; damageEvents.push({ source: e.source, cost });
    if (e.source === 'contact' && ids.includes(e.targetId)) {
      const target = vehicleWorld.entities.get(e.targetId)!;
      contacts.push({ target: target.archetype ?? '', speedMps: +car.physics.speed.toFixed(4), armorCost: cost }); minContactSpeed = Math.min(minContactSpeed, car.physics.speed);
    }
  });
  let elapsedTicks = 0;
  for (; elapsedTicks < 600 && contacts.length < ids.length; elapsedTicks++) {
    vehicleWorld.applyInput(input, 'keyboard'); vehicleWorld.update();
    if (ids.some(id => { const e = vehicleWorld.entities.get(id); return !!e && e.health.current > 0 && !e.attachedTo && car.physics.hullDistance(e.transform.x, e.transform.z) <= (e.combat?.radius ?? .4) + .02; })) minTouchSpeed = Math.min(minTouchSpeed, car.physics.speed);
  }
  stop();
  apcRam = { level: 'L9', surface: 'authored road', infected: 'infected.runner', count: ids.length, entrySpeedMps: +entrySpeed.toFixed(3), minRamSpeedMps: Number.isFinite(minContactSpeed) ? +minContactSpeed.toFixed(3) : null, minTouchSpeedMps: Number.isFinite(minTouchSpeed) ? +minTouchSpeed.toFixed(3) : null, contactCount: contacts.length, armourBefore: beforeArmor, armourAfter: car.entity.health.current, armourLost: beforeArmor - car.entity.health.current, ramArmourCost: contacts.reduce((sum, row) => sum + row.armorCost, 0), durabilityEventBreakdown: damageEvents, contacts, durationSeconds: +(elapsedTicks / 60).toFixed(3), positionEnd: { x: +car.entity.transform.x.toFixed(2), z: +car.entity.transform.z.toFixed(2) } };
} finally { vehicleWorld.dispose(); }

const barrierWorld = await loadLevel('L9', 1, preset('L9-default'), 0, { quality: 'low' });
let barrierPersistence: unknown;
try {
  const mission = barrierWorld.missions!.l9!, car = barrierWorld.vehicles!.cars.get(mission.state.carId)!;
  mission.begin(); for (let i = 0; i < 5; i++) barrierWorld.update();
  const start = { x: -500, z: 0, y: car.physics.def.suspension + car.physics.def.wheelRadius + .15, yaw: 0 };
  Object.assign(car.entity.transform, start); Object.assign(car.physics.previous, start); car.physics.body.setTranslation(start, true); car.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  for (let i = 0; i < 30; i++) barrierWorld.update();
  const barrierId = barrierWorld.vehicles!.obstacles.spawn('jersey-barrier', { x: -490, z: 0 });
  const barrier = barrierWorld.vehicles!.obstacles.items.find(item => item.entity.id === barrierId)!;
  car.physics.body.setLinvel({ x: 14.4, y: 0, z: 0 }, true); car.physics.postPhysics();
  const drive = emptyInput(); drive.drive = { throttle: 1, steer: 0 }; drive.brake = false;
  for (let i = 0; i < 120 && !barrier.body; i++) { barrierWorld.applyInput(drive, 'keyboard'); barrierWorld.update(); }
  const rammedByAPC = !!barrier.body;
  car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); const stopDrive = emptyInput(); stopDrive.drive = { throttle: 0, steer: 0 }; stopDrive.brake = true;
  barrierWorld.applyInput(stopDrive, 'keyboard');
  let settleTicks = 0, maxTiltRadians = 0, maxCenterY = -Infinity;
  for (; settleTicks < 120 && barrier.airborne; settleTicks++) {
    barrierWorld.update(); const rotation = barrier.body!.rotation();
    maxTiltRadians = Math.max(maxTiltRadians, 2 * Math.atan2(Math.hypot(rotation.x, rotation.z), Math.abs(rotation.w)));
    maxCenterY = Math.max(maxCenterY, barrier.body!.translation().y);
  }
  const settled = { x: barrier.entity.transform.x, y: barrier.entity.transform.y, z: barrier.entity.transform.z, rotation: barrier.body!.rotation() };
  for (let i = 0; i < 3600; i++) barrierWorld.update();
  const after60s = { x: barrier.entity.transform.x, y: barrier.entity.transform.y, z: barrier.entity.transform.z, rotation: barrier.body!.rotation() };
  const groundY = 0, halfHeight = .5, maxDrift = Math.hypot(after60s.x - settled.x, after60s.z - settled.z), minBottom = Math.min(settled.y - halfHeight, after60s.y - halfHeight), maxBottom = Math.max(settled.y - halfHeight, after60s.y - halfHeight);
  barrierPersistence = { level: 'L9', method: 'APC collision at 14.4 m/s; APC halted after impact', rammedByAPC, settledAfterSeconds: +(settleTicks / 60).toFixed(3), maxTiltDuringTumbleDegrees: +(maxTiltRadians * 180 / Math.PI).toFixed(2), maxCenterYDuringTumbleM: +maxCenterY.toFixed(3), remainingHealth: barrier.entity.health.current, existsAfter60s: !!barrierWorld.entities.get(barrierId), dynamicBody: barrier.body!.isDynamic(), settledAt: settled, after60s, horizontalDriftM: +maxDrift.toFixed(4), bottomHeightRangeM: [ +minBottom.toFixed(4), +maxBottom.toFixed(4) ], groundY, onGroundWithin5cm: minBottom >= groundY - .05 && maxBottom <= groundY + .05, floatsOrSinks: minBottom < groundY - .05 || maxBottom > groundY + .05 };
} finally { barrierWorld.dispose(); }

console.log(JSON.stringify({ schema: 's69-isofixtures-v1', attackUnderFire: attackRows, armoredShotsToKill: armorRows, apcRam, barrierPersistence }, null, 2));
