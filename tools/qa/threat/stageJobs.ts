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
import { installKitingPolicy, finishKitingReceipt, type KitingReceipt } from './kiting';

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
  native?: NativeStage; l3?: L3SharedSeed; follower?: FollowerPaceSeed; highHold?: ReturnType<L4HoldCensus['finish']>;
}
export const stageId = (level: RunnerLevel, passive: boolean, seed = 1): string => `${level}/${passive ? 'passive' : 'skilled'}/${seed}`;
const campaignFor = (level: RunnerLevel, seed: number) => {
  const campaign = level === 'L1' ? newCampaign('female', seed) : preset(`${level}-default` as ProgressionPreset);
  campaign.seed = seed; campaign.settings.quality = 'low'; return campaign;
};
async function execute(job: StageJob): Promise<StageResult> {
  const start = performance.now(), startedAt = Date.now();
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
      const windows: Partial<Record<RunnerLevel, number>> = { L3: 70, L4: 250, L6: 110, L8: 150 };
      native.run = await runLevel(job.level, 'complete', job.seed, job.passive ? windows[job.level] : undefined, 'auto', campaignFor(job.level, job.seed), undefined, 0, {
        quality: 'low', passive: job.passive,
        beforeBegin: world => { observer = new ThreatObserver(world, job.level); native.definitions = observer.definitions; native.quality = observer.quality; },
        beforeDispose: world => { native.observation = observer?.finish() ?? null; if (!job.passive) native.nativeStateHash = stateHash(world.getState()); },
      });
      if (!job.passive) {
        native.kiting = kiting;
        let kitingComplete = () => false;
        try { await runLevel(job.level, 'complete', job.seed, undefined, 'auto', campaignFor(job.level, job.seed), undefined, 0, {
          quality: 'low', beforeBegin: world => { kitingComplete = installKitingPolicy(world, kiting, job.level); },
          // Cinematic inputs can repeat at one sim tick (L4 has 1,227 inputs
          // in its 1,200-tick window). Preserve the whole clock, not a frame cap.
          stopWhen: () => kitingComplete(),
          beforeDispose: () => { native.kiting = finishKitingReceipt(kiting); },
        }); } catch (error) { if (!(error instanceof LevelRunStopped)) throw error; }
      }
    }
  } catch (error) { result.error = String(error); }
  result.seconds = (performance.now() - start) / 1000; result.endedAt = Date.now();
  console.log(`[qa:threat:stage] ${job.id}: ${result.seconds.toFixed(3)}s`);
  return result;
}

/** Independent routes share a fixed pool: no level worker can hold a core idle while its seed jobs run. */
export async function runStages(levels: readonly RunnerLevel[], maxWorkers: number): Promise<Map<string, StageResult>> {
  const jobs: StageJob[] = [];
  for (const level of levels) {
    jobs.push({ id: stageId(level, false), level, kind: level === 'L3' ? 'l3' : 'native', seed: 1, passive: false });
    jobs.push({ id: stageId(level, true), level, kind: 'native', seed: 1, passive: true });
    if (level === 'L4') jobs.push({ id: 'L4/high-hold', level, kind: 'high-hold', seed: 1, passive: true });
    if (level === 'L3') for (const seed of [2, 3]) jobs.push({ id: stageId(level, false, seed), level, kind: 'l3', seed, passive: false });
    if (level === 'L5' || level === 'L7') for (const passive of [false, true]) for (const seed of [2, 3])
      jobs.push({ id: stageId(level, passive, seed), level, kind: 'follower', seed, passive });
  }
  // Runner stage profiles: start long routes first to avoid a late passive tail.
  const nativeCosts: Record<RunnerLevel, readonly [number, number]> = {
    L1: [30, 30], L2: [45, 45], L3: [80, 20], L4: [270, 150], L5: [50, 250],
    L6: [35, 10], L7: [40, 30], L8: [35, 70], L9: [20, 20], L10: [120, 90],
  };
  const cost = (job: StageJob) => job.kind === 'high-hold' ? 180 : nativeCosts[job.level][job.passive ? 1 : 0];
  jobs.sort((a, b) => cost(b) - cost(a));
  const results = new Map<string, StageResult>();
  if (maxWorkers === 1) {
    for (const job of jobs) results.set(job.id, await execute(job));
    return results;
  }
  const worker = async () => {
    const child = fork(fileURLToPath(import.meta.url), [], { execArgv: ['--import', 'tsx/esm'],
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
