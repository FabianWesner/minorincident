import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runLevel, type RunnerLevel } from '../../sim-runner/levels';
import { preset, type ProgressionPreset } from '../../../src/sim/progression/Campaign';
import { ThreatObserver } from './observer';
import { stateHash } from '../../../src/sim/world/stateHash';
import { followerPaceSeeds, type FollowerPaceSeed } from './followerPace';

interface SeedJob { level: RunnerLevel; tier: 'low' | 'high'; passive: boolean; seed: number }
export async function runSeed({ level, tier, passive, seed }: SeedJob): Promise<FollowerPaceSeed> {
  console.log(`[qa:follower-pace] ${level} ${tier}/${passive ? 'passive' : 'complete'} seed ${seed}`);
  const campaign = preset(`${level}-default` as ProgressionPreset); campaign.seed = seed; campaign.settings.quality = tier;
  let observer: ThreatObserver | undefined;
  const row: FollowerPaceSeed = { seed, valid: false, companions: [], phases: [] };
  try {
    const run = await runLevel(level, 'complete', seed, undefined, 'auto', campaign, undefined, 0, {
      quality: tier, passive, beforeBegin: world => { observer = new ThreatObserver(world, level, { paths: false }); },
      beforeDispose: world => {
        row.phases = observer!.finish().phases.map(({ key, followerSpeeds, followerMedian }) => ({ key, followerSpeeds, followerMedian }));
        row.nativeStateHash = stateHash(world.getState());
        row.companions = [...world.entities.iterate()].filter(e => e.companion).map(e => e.id);
      },
    });
    row.outcome = run.outcome; row.time = run.time;
    // Passive L5/L7 may hold until the unchanged ordinary simulation budget.
    // Missing phase/ID samples still cannot vote.
    row.valid = passive ? run.outcome === 'tick-budget' || run.completed : run.completed;
  } catch (error) { row.error = String(error); }
  return row;
}
function isolatedSeed(job: SeedJob): Promise<FollowerPaceSeed> {
  return new Promise(resolve => {
    let row: FollowerPaceSeed | undefined;
    const failed = (error: string): FollowerPaceSeed => ({ seed: job.seed, valid: false, companions: [], phases: [], error });
    const child = fork(fileURLToPath(import.meta.url), [], { execArgv: ['--import', 'tsx/esm'],
      env: { ...process.env, MI_FOLLOWER_PACE_JOB: JSON.stringify(job) }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    child.once('message', value => { row = value as FollowerPaceSeed; });
    child.once('error', error => { resolve(failed(String(error))); });
    // Await actual exit before freeing a slot; no seed process survives the pair.
    child.once('exit', code => { resolve(code === 0 && row?.seed === job.seed ? row : failed(`seed worker exited ${code}`)); });
  });
}

/** Same native routes and full windows as seed 1, capped at two isolated simulation workers. */
export async function extraFollowerPaceSeeds(level: RunnerLevel, tier: 'low' | 'high', passive = false, maxWorkers = 2): Promise<FollowerPaceSeed[]> {
  if (maxWorkers !== 1 && maxWorkers !== 2) throw new Error('follower pace workers must be 1 or 2');
  const jobs = followerPaceSeeds.slice(1).map(seed => ({ level, tier, passive, seed }));
  if (maxWorkers === 2) return Promise.all(jobs.map(isolatedSeed));
  const rows: FollowerPaceSeed[] = [];
  for (const job of jobs) rows.push(await runSeed(job));
  return rows;
}

if (process.env.MI_FOLLOWER_PACE_JOB && process.send) {
  const row = await runSeed(JSON.parse(process.env.MI_FOLLOWER_PACE_JOB) as SeedJob);
  process.send(row); process.disconnect();
}
