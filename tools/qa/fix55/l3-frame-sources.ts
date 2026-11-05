// fix55-l3 L3-02 survey: clear, reachable points that are inside the alarm frame but hidden behind a building
// (the station-door rule), as candidate in-frame doorway sources for the opening wave.
// Usage: node --import tsx/esm tools/qa/fix55/l3-frame-sources.ts [high|low]
import { followFrustum, loadL3, runL3 } from '../../sim-runner/l3Bots';
import { l3 } from '../../../src/data/l3';
const tier = (process.argv[2] ?? 'high') as 'low' | 'high';
const { world, mission } = await loadL3(1, tier);
runL3(world, mission, 'complete', { maxSeconds: 60, god: true, stopWhen: m => !!m.state.l3!.attackAt && world.tick > m.state.l3!.attackAt + 6 });
followFrustum(world);
const d = world.infected!.director, nav = world.infected!.nav, p = world.entities.get(1)!.transform, y = l3.map.yard;
console.log(`courier ${p.x.toFixed(1)},${p.z.toFixed(1)} yard x ${y.x0}..${y.x1} z ${y.z0}..${y.z1}`);
const goal = nav.nearestCell(p.x, p.z), hits: string[] = [];
for (let x = p.x - 30; x <= p.x + 30; x += .5) for (let z = p.z - 30; z <= p.z + 30; z += .5) {
  if (!d.inFrame({ x, z }) || !d.occluded({ x, z })) continue;
  const inside = x > y.x0 && x < y.x1 && z > y.z0 && z < y.z1;
  const cell = nav.nearestCell(x, z), path: number[] = [];
  const reach = cell >= 0 && nav.path(cell, goal, path, 200_000);
  hits.push(`${x.toFixed(1)},${z.toFixed(1)}${inside ? ' yard' : ''} d=${Math.hypot(x - p.x, z - p.z).toFixed(1)} path=${reach ? path.length : 'none'}`);
}
console.log(hits.length, 'points'); console.log(hits.join('\n'));
