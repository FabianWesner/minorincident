import { mkdirSync, writeFileSync } from 'node:fs';
import { crossing } from '../../src/levels/L9/district';
import { preset } from '../../src/sim/progression/Campaign';
import { emptyInput } from '../../src/input/InputFrame';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';

const road = crossing.routes.find(route => route.id === 'road')!;
function segmentDistance(p: { x: number; z: number }, a: readonly number[], b: readonly number[]) {
  const dx = b[0]! - a[0]!, dz = b[1]! - a[1]!, t = Math.max(0, Math.min(1, ((p.x - a[0]!) * dx + (p.z - a[1]!) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a[0]! - t * dx, p.z - a[1]! - t * dz);
}
function roadDistance(p: { x: number; z: number }) { return Math.min(...road.points.slice(1).map((b, i) => segmentDistance(p, road.points[i]!, b))); }
const rows = [];
for (const quality of ['high', 'low'] as const) for (const path of ['on-road', 'corner-cut', 'wide-detour'] as const) {
  const world = await loadLevel('L9', 1, preset('L9-default'), 0, { quality });
  try {
    world.missions!.begin(); world.update();
    const l9 = world.missions!.l9!, state = l9.driving.state, car = world.vehicles!.cars.get(l9.state.carId)!, bus = world.vehicles!.cars.get(state.busId)!;
    const z = path === 'on-road' ? -330 : path === 'corner-cut' ? -305 : -70;
    const pose = { x: 220, z, y: car.entity.transform.y, yaw: 0 };
    Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose); car.physics.body.setTranslation(pose, true); car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    world.spatial.set(car.entity.id, pose.x, pose.z);
    const samples: { tick: number; x: number; z: number; distanceToAsphalt: number }[] = [];
    for (let i = 0; i < 7200; i++) {
      world.applyInput(emptyInput(), 'keyboard'); world.update();
      if (!bus.entity.hidden && i % 30 === 0) samples.push({ tick: world.tick, x: bus.entity.transform.x, z: bus.entity.transform.z, distanceToAsphalt: roadDistance(bus.entity.transform) });
    }
    rows.push({ quality, path, apcFixture: { x: pose.x, z }, samples, maxDistance: Math.max(0, ...samples.map(s => s.distanceToAsphalt)), busSpawned: samples.length > 0, finalBus: { x: bus.entity.transform.x, z: bus.entity.transform.z, hidden: bus.entity.hidden }, passengersReleased: state.busReleased });
  } finally { world.dispose(); }
}
const result = { ...provenance(), method: 'Native L9 sim, HIGH/LOW; APC is placed at the same cross-section on asphalt, a corner cut and a wide off-road detour as controlled fixture setup. Bus physics/autopilot then runs unassisted for 120 s. Centreline distance is measured against every authored asphalt segment every 0.5 s. Hatch participation remains a separate browser/native observation.', asphaltHalfWidthM: road.width / 2, rows };
mkdirSync('docs/reports/s118-l9bus', { recursive: true });
writeFileSync('docs/reports/s118-l9bus/bus-route.json', `${JSON.stringify(result, null, 2)}\n`);
for (const row of rows) console.log(JSON.stringify({ quality: row.quality, path: row.path, spawned: row.busSpawned, maxDistance: row.maxDistance, end: row.finalBus, released: row.passengersReleased }));
if (rows.some(row => !row.busSpawned || row.maxDistance > road.width / 2)) process.exitCode = 1;
