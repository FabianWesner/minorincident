import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LevelRunStopped, runLevel, type LevelReport, type RunnerLevel } from '../../sim-runner/levels';
import { newCampaign, preset, type ProgressionPreset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { ThreatObserver } from './observer';
import { L4HoldCensus } from './l4-hold';
import { l3SharedSeeds, type L3SharedSeed } from './l3SharedSeeds';
import { runSeed } from './followerPaceSeeds';
import type { FollowerPaceSeed } from './followerPace';
import { installKitingPolicy, finishKitingReceipt, type KitingReceipt, type KitingStyle } from './kiting';

export interface StageJob {
  id: string; level: RunnerLevel; kind: 'native' | 'follower' | 'l3' | 'high-hold'; seed: number; passive: boolean;
}
export interface NativeStage {
  run: LevelReport | null; observation: ReturnType<ThreatObserver['finish']> | null;
  definitions: ThreatObserver['definitions']; quality: string; nativeStateHash: string | null;
  kiting?: KitingReceipt;
}
export interface StageResult {
  job: StageJob; seconds: number; startedAt: number; endedAt: number; error?: string;
  /** Diagnostic split of `seconds`, kept out of the receipts. */
  split?: { skilledSeconds?: number; kitingSeconds?: number; observerSeconds?: number; simSeconds?: number };
  native?: NativeStage; l3?: L3SharedSeed; follower?: FollowerPaceSeed; highHold?: ReturnType<L4HoldCensus['finish']>;
}
export interface ShardSpec { index: number; count: number }
export const stageId = (level: RunnerLevel, passive: boolean, seed = 1): string => `${level}/${passive ? 'passive' : 'skilled'}/${seed}`;
const kitingStyle: KitingStyle = process.env.MI_THREAT_KITING_STYLE === 'circles' ? 'circles' : 'retreat';
const campaignFor = (level: RunnerLevel, seed: number) => {
  const campaign = level === 'L1' ? newCampaign('female', seed) : preset(`${level}-default` as ProgressionPreset);
  campaign.seed = seed; campaign.settings.quality = 'low'; return campaign;
};
async function execute(job: StageJob): Promise<StageResult> {
  const start = performance.now(), startedAt = Date.now();
  console.log(`[qa:threat:stage] start ${job.id}`);
  const result: StageResult = { job, seconds: 0, startedAt, endedAt: startedAt };
  try {
    if (job.kind === 'follower') result.follower = await runSeed({ ...job, tier: 'low' });
    else if (job.kind === 'l3') result.l3 = (await l3SharedSeeds('low', campaignFor('L3', job.seed), [job.seed]))[0];
    else if (job.kind === 'high-hold') {
      let census: L4HoldCensus | undefined;
      await runLevel('L4', 'complete', 1, 250, 'auto', undefined, undefined, 0, { quality: 'high', passive: true,
        beforeBegin: world => { census = new L4HoldCensus(world); }, beforeDispose: () => { result.highHold = census!.finish(); } });
    } else {
      let observer: ThreatObserver | undefined;
      const native: NativeStage = { run: null, observation: null, definitions: [], quality: 'missing', nativeStateHash: null };
      const kiting: KitingReceipt = { kitingSeconds: 0, attacks: 0, attacksPerMinute: 0, samples: 0 };
      result.native = native;
      // Preserve every existing passive observation window, including L5's full 1,200 seconds.
      // L8's fenced tour can take 180 s; retain at least the full 20 s breach attack window.
      const windows: Partial<Record<RunnerLevel, number>> = { L3: 70, L4: 250, L6: 110, L8: 210 };
      const runStarted = performance.now();
      native.run = await runLevel(job.level, 'complete', job.seed, job.passive ? windows[job.level] : undefined, 'auto', campaignFor(job.level, job.seed), undefined, 0, {
        quality: 'low', passive: job.passive,
        beforeBegin: world => { observer = new ThreatObserver(world, job.level); native.definitions = observer.definitions; native.quality = observer.quality; },
        beforeDispose: world => { native.observation = observer?.finish() ?? null; if (!job.passive) native.nativeStateHash = stateHash(world.getState()); },
      });
      result.split = { skilledSeconds: (performance.now() - runStarted) / 1000, observerSeconds: (observer?.overheadMilliseconds ?? 0) / 1000, simSeconds: (observer?.simMilliseconds ?? 0) / 1000 };
      if (!job.passive) {
        native.kiting = finishKitingReceipt(kiting);
      }
      if (!job.passive && job.level !== 'L9') {
        // L9 is a driving/crawl route, explicitly exempt from the on-foot
        // kiting sample. Replaying its whole drive cannot collect that sample.
        let kitingComplete = () => false;
        const kitingStarted = performance.now();
        try { await runLevel(job.level, 'complete', job.seed, undefined, 'auto', campaignFor(job.level, job.seed), undefined, 0, {
          quality: 'low', beforeBegin: world => { kitingComplete = installKitingPolicy(world, kiting, job.level, kitingStyle); },
          // Cinematic inputs can repeat at one sim tick (L4 has 1,227 inputs
          // in its 1,200-tick window). Preserve the whole clock, not a frame cap.
          stopWhen: () => kitingComplete(),
          beforeDispose: () => { native.kiting = finishKitingReceipt(kiting); },
        }); } catch (error) { if (!(error instanceof LevelRunStopped)) throw error; }
        result.split!.kitingSeconds = (performance.now() - kitingStarted) / 1000;
      }
    }
  } catch (error) { result.error = String(error); }
  result.seconds = (performance.now() - start) / 1000; result.endedAt = Date.now();
  console.log(`[qa:threat:stage] ${job.id}: ${result.seconds.toFixed(3)}s`);
  return result;
}

/** Independent routes share a fixed pool: no level worker can hold a core idle while its seed jobs run. */
export async function runStages(levels: readonly RunnerLevel[], maxWorkers: number, shard?: ShardSpec): Promise<Map<string, StageResult>> {
  const jobs: StageJob[] = [];
  for (const level of levels) {
    jobs.push({ id: stageId(level, false), level, kind: level === 'L3' ? 'l3' : 'native', seed: 1, passive: false });
    jobs.push({ id: stageId(level, true), level, kind: 'native', seed: 1, passive: true });
    if (level === 'L4') jobs.push({ id: 'L4/high-hold', level, kind: 'high-hold', seed: 1, passive: true });
    if (level === 'L3') for (const seed of [2, 3]) jobs.push({ id: stageId(level, false, seed), level, kind: 'l3', seed, passive: false });
    if (level === 'L5' || level === 'L7') for (const passive of [false, true]) for (const seed of [2, 3])
      jobs.push({ id: stageId(level, passive, seed), level, kind: 'follower', seed, passive });
  }
  // Measured stage durations in seconds on a 4-vCPU runner running the pool of four workers (docs/reports/r23-threattime,
  // stages.json of the unbounded diagnostic run). Longest-first on these numbers is the classic LPT packing; the
  // old guesses put L7 passive seed 1 (240 s) and L8 skilled (454 s) last or in the middle and left two workers idle.
  const measured: Record<string, number> = {
    'L8/skilled/1': 454, 'L5/passive/1': 297, 'L5/passive/2': 277, 'L7/passive/1': 240, 'L9/skilled/1': 238, 'L5/passive/3': 232,
    'L7/passive/2': 227, 'L7/passive/3': 224, 'L4/skilled/1': 154, 'L10/skilled/1': 137, 'L4/high-hold': 130, 'L3/skilled/2': 108,
    'L4/passive/1': 107, 'L9/passive/1': 94, 'L2/passive/1': 92, 'L10/passive/1': 77, 'L5/skilled/1': 77, 'L3/skilled/1': 75,
    'L2/skilled/1': 72, 'L8/passive/1': 66, 'L5/skilled/2': 64, 'L3/skilled/3': 64, 'L5/skilled/3': 59, 'L1/skilled/1': 49,
    'L7/skilled/1': 49, 'L7/skilled/3': 48, 'L7/skilled/2': 40, 'L6/skilled/1': 32, 'L1/passive/1': 29, 'L3/passive/1': 19, 'L6/passive/1': 13,
  };
  const cost = (job: StageJob) => measured[job.id] ?? (job.kind === 'follower' ? job.passive ? 230 : 55 : job.passive ? 80 : 90);
  jobs.sort((a, b) => cost(b) - cost(a) || a.id.localeCompare(b.id));
  if (shard) {
    // Deterministic static split: longest-first onto count x 4 virtual workers, shard = virtual worker / 4. Every shard
    // then runs its own jobs through the same 4-worker pool, so the packing the split assumed is the packing it gets.
    const loads = new Array<number>(shard.count * maxWorkers).fill(0), owner = new Map<string, number>();
    for (const job of jobs) {
      const w = loads.indexOf(Math.min(...loads));
      loads[w] += cost(job); owner.set(job.id, Math.floor(w / maxWorkers));
    }
    const mine = jobs.filter(job => owner.get(job.id) === shard.index);
    jobs.length = 0; jobs.push(...mine);
    console.log(`[qa:threat] shard ${shard.index + 1}/${shard.count}: ${jobs.length} stages, planned ${loads.slice(shard.index * maxWorkers, (shard.index + 1) * maxWorkers).map(Math.round).join('/')} s per worker`);
  }
  const results = new Map<string, StageResult>();
  if (maxWorkers === 1) {
    for (const job of jobs) results.set(job.id, await execute(job));
    return results;
  }
  const worker = async () => {
    // Four workers remain within the runner's memory budget while collecting
    // short-lived simulation allocations less frequently.
    const child = fork(fileURLToPath(import.meta.url), [], { execArgv: ['--max-semi-space-size=64', '--import', 'tsx/esm'],
      env: { ...process.env, MI_THREAT_STAGE_WORKER: '1' }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    const exited = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    let finished = false;
    try {
      for (let job = jobs.shift(); job; job = jobs.shift()) {
        const reply = new Promise<StageResult>(resolve => { child.once('message', value => { resolve(value as StageResult); }); });
        child.send(job);
        const result = await Promise.race([reply, exited.then(code => { throw new Error(`Threat stage worker exited ${code} during ${job!.id}`); })]);
        if (result.job.id !== job.id || results.has(job.id)) throw new Error(`Invalid threat stage result for ${job.id}`);
        results.set(job.id, result);
      }
      child.disconnect();
      const code = await exited;
      if (code !== 0) throw new Error(`Threat stage worker exited ${code}`);
      finished = true;
    } finally {
      if (!finished) { child.kill('SIGTERM'); await exited.catch(() => {}); }
    }
  };
  const workers = await Promise.allSettled(Array.from({ length: Math.min(maxWorkers, jobs.length) }, worker));
  for (const result of workers) if (result.status === 'rejected') throw result.reason;
  return results;
}

if (process.env.MI_THREAT_STAGE_WORKER === '1' && process.send) {
  process.on('message', async (job: StageJob) => {
    const result = await execute(job);
    if (process.connected) process.send!(result);
  });
  process.once('disconnect', () => { process.removeAllListeners('message'); });
}
