// r32-l9fun diagnostic: APC pose, bus and bay state around the evacuation bay on a skilled bot drive.
// Usage: node --import tsx/esm tools/qa/diag/l9bay.ts [road|countryside] [--from 150] [--to 190] [--seed 1]
import { loadLevel } from '../../sim-runner/levels';
import { LevelNineBot } from '../../../src/debug/bot/LevelNineBot';
import { preset } from '../../../src/sim/progression/Campaign';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i < 0 ? d : process.argv[i + 1]; };
const route = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'road';
const from = Number(arg('--from', '150')), to = Number(arg('--to', '190'));
const world = await loadLevel('L9', Number(arg('--seed', '1')), preset('L9-default'), 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, route, true), car = world.vehicles!.cars.get(l9.state.carId)!;
  for (let t = 0; t < to * 60; t++) {
    const f = bot.sample(); world.applyInput(f, 'keyboard'); world.update();
    if (world.tick < from * 60 || world.tick % 20) continue;
    const s = l9.driving.state, p = car.entity.transform, bus = world.entities.get(s.busId)?.transform;
    console.log((world.tick / 60).toFixed(2), `apc ${p.x.toFixed(1)},${p.z.toFixed(1)} y${p.y.toFixed(2)} yaw${p.yaw.toFixed(2)} v${car.physics.speed.toFixed(1)} in=${JSON.stringify(f.drive)} brake=${f.brake ?? ''} bus ${bus ? `${bus.x.toFixed(1)},${bus.z.toFixed(1)}` : '-'} gate=${s.gateClosed} evac=${s.evacuationAt} bridgeBlocked=${world.interactables!.walls.some(w => w.entityId === s.bridgeGateId)}`);
  }
} finally { world.dispose(); }
