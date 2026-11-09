/** Same seeded mortal policy and passive observer on baseline and candidate sources. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runLevel } from '../../../tools/sim-runner/levels';
import { ThreatObserver } from '../../../tools/qa/threat/observer';
import { stateHash } from '../../../src/sim/world/stateHash';
import { preset } from '../../../src/sim/progression/Campaign';

const out = process.argv[2];
if (!out) throw new Error('Specify a JSON output path');
const rows = [];
for (const level of ['L4', 'L5'] as const) for (const quality of ['low', 'high'] as const) {
  const campaign = preset(`${level}-default`); campaign.seed = 1; campaign.settings.quality = quality;
  let observer: ThreatObserver;
  let observation: ReturnType<ThreatObserver['finish']> | undefined;
  let hash: string | undefined;
  const run = await runLevel(level, 'complete', 1, level === 'L4' ? 250 : 400, 'auto', campaign, undefined, 0, {
    quality,
    beforeBegin: world => { observer = new ThreatObserver(world, level); },
    beforeDispose: world => { observation = observer.finish(); hash = stateHash(world.getState()); },
  });
  rows.push({ level, quality, run, observation, stateHash: hash });
  console.log(level, quality, run.outcome, run.time, run.damageTaken, run.kills, hash);
}
mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
writeFileSync(out, JSON.stringify({
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceTree: execFileSync('git', ['rev-parse', 'HEAD:src'], { encoding: 'utf8' }).trim(),
  workingSourceDiff: execFileSync('git', ['diff', '--', 'src'], { encoding: 'utf8' }), rows,
}));
