import { l8Route } from '../../src/data/l8Bosses';
import { mkdir, writeFile } from 'node:fs/promises';
import { runLevel, type RunnerLevel } from '../sim-runner/levels';
import { ThreatObserver } from './threat/observer';

// A normal-speed comparison using the shared marked-route steering and
// interactions. Existing objective/combat holds remain; this is not a
// straight-line policy and must not be presented as one.
const out = process.argv[2] ?? 'test-results/escort-walk';
const straightL7 = process.argv.includes('--straight-l7');
const straightL8 = process.argv.includes('--straight-l8');
const straightL6 = process.argv.includes('--straight-l6');
const tunnelRoute = [{ x: 6, z: 15 }, { x: 25, z: 15 }, { x: 245, z: 15 }, { x: 250, z: 15 }, { x: 273, z: 15 }];
const route = [{ x: 88, z: 15 }, { x: 88, z: 46 }, { x: -30, z: 47 }, { x: -36, z: 47 }, { x: -36, z: 41.7 }, { x: -50, z: 41.7 }, { x: -50, z: 47 }, { x: -74, z: 47 }];
await mkdir(out, { recursive: true });
for (const level of (straightL7 ? ['L7'] : straightL6 ? ['L6'] : straightL8 ? ['L8'] : ['L6', 'L7', 'L8']) as RunnerLevel[]) {
  let waypoint = 0, zooStage = '';
  let observer: ThreatObserver | undefined;
  let observation: ReturnType<ThreatObserver['finish']> | undefined;
  const run = await runLevel(level, 'complete', 1, undefined, 'auto', undefined, undefined, 0, {
    quality: 'low',
    beforeBegin: world => {
      observer = new ThreatObserver(world, level);
      const apply = world.applyInput.bind(world);
      world.applyInput = (frame, source) => {
        const walking = { ...frame, walk: true };
        if (straightL7 && world.l7Encounters!.state.started && world.l7Departure!.state.phase === 'waiting') {
          const p = world.entities.get(1)!.transform;
          while (waypoint < route.length - 1 && Math.hypot(p.x - route[waypoint].x, p.z - route[waypoint].z) < 1.2) waypoint++;
          const goal = route[waypoint], dx = goal.x - p.x, dz = goal.z - p.z, length = Math.hypot(dx, dz);
          walking.move = length > .3 ? { x: dx / length, z: dz / length } : { x: 0, z: 0 };
        }
        if (straightL6 && ['retreat', 'exit'].includes(world.missions!.state.l6!.phase)) {
          const p = world.entities.get(1)!.transform;
          while (waypoint < tunnelRoute.length - 1 && Math.hypot(p.x - tunnelRoute[waypoint].x, p.z - tunnelRoute[waypoint].z) < 1) waypoint++;
          const goal = tunnelRoute[waypoint], dx = goal.x - p.x, dz = goal.z - p.z, length = Math.hypot(dx, dz);
          walking.move = length > .4 ? { x: dx / length, z: dz / length } : { x: 0, z: 0 };
        }
        if (straightL8) {
          const zoo = world.missions!.l8!, next = zoo.state.arenas.find(a => a.phase !== 3);
          if (zoo.state.sealedAt && !zoo.protecting() && next?.phase === 0) {
            const stage = l8Route.find(r => r.id === next.id)!;
            if (zooStage !== stage.id) { zooStage = stage.id; waypoint = 0; }
            const points = [...stage.nodes, { x: (stage.zone.x0 + stage.zone.x1) / 2, z: (stage.zone.z0 + stage.zone.z1) / 2 }];
            const p = world.entities.get(1)!.transform;
            while (waypoint < points.length - 1 && Math.hypot(p.x - points[waypoint].x, p.z - points[waypoint].z) < 1.2) waypoint++;
            const goal = points[waypoint], dx = goal.x - p.x, dz = goal.z - p.z, length = Math.hypot(dx, dz);
            walking.move = length > .3 ? { x: dx / length, z: dz / length } : { x: 0, z: 0 };
          }
        }
        apply(walking, source);
      };
    },
    beforeDispose: () => { observation = observer!.finish(); },
  });
  await writeFile(`${out}/${level}.json`, JSON.stringify({ policy: straightL7 ? 'independent-l7-corridor-normal-walk' : straightL6 ? 'independent-l6-tunnel-normal-walk' : straightL8 ? 'independent-l8-between-arenas-normal-walk' : 'shared-route-normal-walk', seed: 1, run, observation }, null, 2) + '\n');
  console.log(`[escort-walk] ${level}: ${run.outcome}, ${run.time.toFixed(2)}s`);
}
