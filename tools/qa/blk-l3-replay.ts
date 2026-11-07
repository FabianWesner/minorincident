/** blk-l3 (G-27): replay a recorded L3 physical route natively (world-space move toward the courier's recorded 0.5 s samples)
 * and trace the corgi. Usage: node --import tsx/esm tools/qa/blk-l3-replay.ts <route.json> <low|high> [maxTicks] */
import { readFileSync, writeFileSync } from 'node:fs';
import { emptyInput } from '../../src/input/InputFrame';
import { preset } from '../../src/sim/progression/Campaign';
import { LevelThreeBot } from '../../src/debug/bot/LevelThreeBot';
import { loadLevel } from '../sim-runner/levels';
import { followFrustum } from '../sim-runner/l3Bots';

const [routeFile, tier = 'low', maxArg] = process.argv.slice(2);
const route = JSON.parse(readFileSync(routeFile, 'utf8')) as [number, number, number, string][];
const campaign = preset('L3-default'); campaign.settings.quality = tier as 'low' | 'high';
const world = await loadLevel('L3', 1, campaign, 0, { quality: tier as 'low' | 'high' });
world.player!.damage = () => 0;
const mission = world.missions!, bot = new LevelThreeBot(world, 'complete', 'auto');
const maxTicks = Number(maxArg ?? 20000);
const trace: unknown[] = [];
let idx = 0, startTick = -1;
for (let t = 0; t < maxTicks; t++) {
  followFrustum(world);
  const s = mission.state.l3!, p = world.entities.get(1)!.transform;
  let frame = emptyInput();
  if (!s.fallbackAt) frame = bot.sample();
  else {
    if (startTick < 0) { startTick = world.tick; idx = route.findIndex(r => r[3] === 'checkpoint'); }
    while (idx < route.length - 1 && Math.hypot(route[idx][1] - p.x, route[idx][2] - p.z) < 1.2) idx++;
    const [, x, z] = route[idx], dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d > .6) frame.move = { x: dx / d, z: dz / d };
  }
  world.applyInput(frame, 'keyboard'); world.update();
  if (world.tick % 60 === 0) {
    const dog = [...world.entities.iterate()].find(e => e.companion);
    const c = dog?.companion;
    trace.push({ tick: world.tick, p: [+p.x.toFixed(1), +p.z.toFixed(1)], dog: dog && [+dog.transform.x.toFixed(2), +dog.transform.z.toFixed(2)], st: c?.state, f: c?.following, hid: dog?.hidden, pend: !!dog?.pendingAdmission, sep: dog && +Math.hypot(dog.transform.x - p.x, dog.transform.z - p.z).toFixed(1), crossed: s.crossedAt, barrier: s.barrierClosedAt, done: s.doneAt });
  }
  if (s.doneAt) break;
}
writeFileSync(process.env.OUT ?? 'test-results/blk-l3/trace.json', JSON.stringify(trace));
const last = trace[trace.length - 1] as Record<string, unknown>;
console.log(JSON.stringify(last));
world.dispose();
