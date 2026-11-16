import { mkdir, writeFile } from 'node:fs/promises';
import { runLevel, type RunnerLevel } from '../sim-runner/levels';
import { ThreatObserver } from './threat/observer';

// A normal-speed comparison using the shared marked-route steering and
// interactions. Existing objective/combat holds remain; this is not a
// straight-line policy and must not be presented as one.
const out = process.argv[2] ?? 'test-results/escort-walk';
await mkdir(out, { recursive: true });
for (const level of ['L6', 'L7', 'L8'] as RunnerLevel[]) {
  let observer: ThreatObserver | undefined;
  let observation: ReturnType<ThreatObserver['finish']> | undefined;
  const run = await runLevel(level, 'complete', 1, undefined, 'auto', undefined, undefined, 0, {
    quality: 'low',
    beforeBegin: world => {
      observer = new ThreatObserver(world, level);
      const apply = world.applyInput.bind(world);
      world.applyInput = (frame, source) => apply({ ...frame, walk: true }, source);
    },
    beforeDispose: () => { observation = observer!.finish(); },
  });
  await writeFile(`${out}/${level}.json`, JSON.stringify({ policy: 'shared-route-normal-walk', seed: 1, run, observation }, null, 2) + '\n');
  console.log(`[escort-walk] ${level}: ${run.outcome}, ${run.time.toFixed(2)}s`);
}
