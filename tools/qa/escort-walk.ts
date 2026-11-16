import { mkdir, writeFile } from 'node:fs/promises';
import { runLevel, type RunnerLevel } from '../sim-runner/levels';
import { ThreatObserver } from './threat/observer';

// A normal-speed comparison using the shared marked-route steering and
// interactions. Existing objective/combat holds remain; this is not a
// straight-line policy and must not be presented as one.
const out = process.argv[2] ?? 'test-results/escort-walk';
const straightL7 = process.argv.includes('--straight-l7');
const route = [{ x: 88, z: 15 }, { x: 88, z: 46 }, { x: -30, z: 47 }, { x: -36, z: 47 }, { x: -36, z: 41.7 }, { x: -50, z: 41.7 }, { x: -50, z: 47 }, { x: -74, z: 47 }];
await mkdir(out, { recursive: true });
for (const level of (straightL7 ? ['L7'] : ['L6', 'L7', 'L8']) as RunnerLevel[]) {
  let waypoint = 0;
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
        apply(walking, source);
      };
    },
    beforeDispose: () => { observation = observer!.finish(); },
  });
  await writeFile(`${out}/${level}.json`, JSON.stringify({ policy: straightL7 ? 'independent-l7-corridor-normal-walk' : 'shared-route-normal-walk', seed: 1, run, observation }, null, 2) + '\n');
  console.log(`[escort-walk] ${level}: ${run.outcome}, ${run.time.toFixed(2)}s`);
}
