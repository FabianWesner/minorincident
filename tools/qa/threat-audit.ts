import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { runnerLevels, type RunnerLevel, type LevelReport } from '../sim-runner/levels';
import { ThreatObserver, followerCoverageFlags, followerPaceChecks, followerWaitFlags } from './threat/observer';
import { threatSteps } from './threat/phases';
import { proveThreatAudit, provePassiveFrom } from './threat/proof';
import { renderReport } from './threat/report';
import { L4HoldCensus } from './threat/l4-hold';
import { focusedCriteria } from './threat/criteria';
import { armyLineVerdict, type ArmyLineVerdict } from './threat/l3ArmyLine';
import { followerPaceVerdict, type FollowerPaceSeed, type FollowerPaceVerdict } from './threat/followerPace';
import { runStages, stageId } from './threat/stageJobs';
import type { L3SurvivalSeed } from './threat/l3SurvivalSeeds';
import type { KitingReceipt } from './threat/kiting';

export interface LevelReceipt {
  level: RunnerLevel; quality: string; definitions: ThreatObserver['definitions']; run: LevelReport | null;
  observation: ReturnType<ThreatObserver['finish']> | null; flags: string[]; wallSeconds: number; nativeStateHash: string | null;
  passiveRun: LevelReport | null; passiveObservation: ReturnType<ThreatObserver['finish']> | null; passiveFlags: string[];
  highHold?: ReturnType<L4HoldCensus['finish']>;
  /** L3-06 army line over seeds 1–3 (tools/qa/threat/l3ArmyLine.ts). */
  l3Army?: ArmyLineVerdict;
  l3SurvivalSeeds?: L3SurvivalSeed[];
  followerPace?: FollowerPaceVerdict;
  passiveFollowerPace?: FollowerPaceVerdict;
  followerPaceSeeds?: FollowerPaceSeed[];
  passiveFollowerPaceSeeds?: FollowerPaceSeed[];
  kiting: KitingReceipt | null;
}
export interface AuditReceipt {
  revision: string; mainRevision: string; sourceMatchesMain: boolean | null; seed: number; policy: string; tier: string;
  workers: number; seconds: number; flags: string[]; levels: LevelReceipt[];
  passivity?: { seconds: number; levels: number; matches: boolean };
}
const { values } = parseArgs({ options: {
  maxWorkers: { type: 'string', default: '4' }, levels: { type: 'string' },
  out: { type: 'string', default: 'test-results/qa-threat' }, report: { type: 'string' }, proof: { type: 'boolean' },
  'passive-from': { type: 'string' },
} });
const maxWorkers = Number(values.maxWorkers);
if (!Number.isInteger(maxWorkers) || maxWorkers < 1 || maxWorkers > 4) throw new Error('--maxWorkers must be 1–4');
if (values.proof) { await proveThreatAudit(); process.exit(0); }
if (values['passive-from']) { await provePassiveFrom(values['passive-from'], values.out!, values.report); process.exit(0); }
const selected = values.levels ? values.levels.split(',') as RunnerLevel[] : [...runnerLevels];
if (selected.some(level => !runnerLevels.includes(level)) || new Set(selected).size !== selected.length) throw new Error('--levels must be comma-separated unique L1–L10 IDs');
const git = (...args: string[]): string | null => {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { return null; } // run.sh uses a commit-less manifest repo; its caller supplies provenance.
};
const revision = process.env.QA_THREAT_REVISION ?? git('rev-parse', 'HEAD') ?? 'manifest-only';
const mainRevision = process.env.QA_THREAT_MAIN_REVISION ?? git('rev-parse', 'refs/heads/main') ?? 'not-supplied';
const sourceMatchesMain = process.env.QA_THREAT_SOURCE_MATCHES_MAIN !== undefined ? process.env.QA_THREAT_SOURCE_MATCHES_MAIN === 'true'
  : mainRevision === 'not-supplied' ? null : git('diff', mainRevision, '--', 'src', 'public') === '' && git('ls-files', '--others', '--exclude-standard', '--', 'src', 'public') === '';
const started = performance.now(), levels: LevelReceipt[] = [];
await mkdir(values.out!, { recursive: true });
const stages = await runStages(selected, maxWorkers);
await writeFile(join(values.out!, 'stages.json'), JSON.stringify([...stages.values()].map(({ job, seconds, startedAt, endedAt, error }) => ({ ...job, seconds, startedAt, endedAt, ...(error ? { error } : {}) })), null, 2) + '\n');
const stage = (id: string) => {
  const result = stages.get(id);
  if (!result) throw new Error(`Missing threat stage ${id}`);
  return result;
};
for (const level of selected) {
  const multiSeedPace = level === 'L5' || level === 'L7';
  const levelStages = [...stages.values()].filter(row => row.job.level === level);
  const wallSeconds = (Math.max(...levelStages.map(row => row.endedAt)) - Math.min(...levelStages.map(row => row.startedAt))) / 1000;
  const skilledStage = stage(stageId(level, false));
  const skilled = skilledStage.l3 ?? skilledStage.native;
  const run = skilled?.run ?? null, observation = skilled?.observation ?? null;
  const definitions = skilled?.definitions ?? [], quality = skilled?.quality ?? 'missing';
  const flags: string[] = [];
  if (skilledStage.error) flags.push(`AUDIT_ERROR:${skilledStage.error}`);
  if (!run?.completed) flags.push(`INCOMPLETE_NATIVE_POLICY:${run?.outcome ?? 'error'}`);
  if (!observation?.phases.length) flags.push('MISSING_PHASE_OBSERVATIONS');
  if (quality !== 'low') flags.push(`WRONG_POPULATION_TIER:${quality}`);
  for (const id of Object.keys(threatSteps[level])) {
    if (!definitions.some(step => step.id === id)) flags.push(`THREAT_INVENTORY_DRIFT:${id}`);
    if (!observation?.phases.some(row => row.key === `step/${id}`)) flags.push(`UNOBSERVED_THREAT_STEP:${id}`);
  }
  for (const row of observation?.phases ?? []) flags.push(...row.flags.filter(flag => !multiSeedPace || !flag.startsWith('SLOW_FOLLOWER:')).map(flag => `${row.key}:${flag}`));
  for (const wave of observation?.waves ?? []) flags.push(...wave.flags.map(flag => `wave/${wave.key}:${flag}`));
  const passiveStage = stage(stageId(level, true));
  const passiveRun = passiveStage.native?.run ?? null, passiveObservation = passiveStage.native?.observation ?? null;
  const passiveFlags: string[] = passiveStage.error ? [`AUDIT_ERROR:${passiveStage.error}`] : [];
  const kiting = skilled?.kiting ?? null;
  if (!kiting) passiveFlags.push('MISSING_KITING_POLICY_RECEIPT');
  else if (kiting.kitingSeconds === 0 && level !== 'L9') passiveFlags.push('MISSING_KITING_ON_FOOT_SAMPLE');
  else if (kiting.kitingSeconds > 0 && kiting.attacksPerMinute < 2) passiveFlags.push(`KITING_BELOW_ATTACKS_PER_MINUTE_2:${kiting.attacksPerMinute.toFixed(2)}`);
  // The acceptance hard rule applies to competent combat as well as passive
  // threat potential. Interrupted windups and group grabs are real attempts.
  for (const row of observation?.phases ?? []) if (row.threat && row.attacks + row.groupAttacks === 0)
    passiveFlags.push(`${row.key}:SKILLED_ZERO_ATTACK_WINDUPS`);
  const skilledFloors = level === 'L2' ? { step: 'bridge', rate: 2 } : level === 'L5' ? { step: 'look', rate: 3 } : level === 'L10' ? { step: 'hold', rate: 8 } : null;
  if (skilledFloors) {
    const row = observation?.phases.find(p => p.key === `step/${skilledFloors.step}`);
    if (!row || row.attacksPerMinute + row.groupAttacksPerMinute < skilledFloors.rate)
      passiveFlags.push(`step/${skilledFloors.step}:SKILLED_BELOW_ATTACKS_PER_MINUTE_${skilledFloors.rate}`);
  }
  if (level === 'L6' && (run?.damageTaken ?? 0) < 30) passiveFlags.push('SKILLED_DAMAGE_BELOW_30_HP');
  if (!passiveRun && !passiveObservation) passiveFlags.push('INCOMPLETE_PASSIVE_POLICY:error');
  if (!passiveObservation?.phases.length) passiveFlags.push('MISSING_PASSIVE_OBSERVATIONS');
  for (const id of Object.keys(threatSteps[level])) if (!passiveObservation?.phases.some(row => row.key === `step/${id}`)) passiveFlags.push(`UNOBSERVED_PASSIVE_CRITERION_STEP:${id}`);
  for (const row of passiveObservation?.phases ?? []) passiveFlags.push(...row.flags.filter(flag => flag !== 'ZERO_ATTACKS' && (!multiSeedPace || !flag.startsWith('SLOW_FOLLOWER:'))).map(flag => `${row.key}:${flag}`));
  const floors: Partial<Record<RunnerLevel, Record<string, { attacks?: number; reachability?: number; includeGroup?: boolean; firstAttack?: number }>>> = {
    L1: { spread: { attacks: 3, reachability: 90 } }, L2: { collapse: { attacks: 4, reachability: 90, firstAttack: 15 } },
    L3: { defend: { attacks: 4, reachability: 90, firstAttack: 10 } }, L4: { hold: { attacks: 6, reachability: 90, firstAttack: 10 } },
    L5: { look: { attacks: 3, includeGroup: true } }, L6: { stop: { attacks: 4, reachability: 95 }, retreat: { attacks: 4, includeGroup: true } },
    L7: { corridor: { attacks: 6, includeGroup: true } }, L8: { escape: { attacks: 4, includeGroup: true } }, L10: { hold: { attacks: 8, reachability: 90 } },
  };
  for (const row of passiveObservation?.phases ?? []) {
    const step = row.key.startsWith('step/') ? row.key.slice(5) : row.key.startsWith('phase/') ? row.key.slice(6) : '';
    const floor = floors[level]?.[step]; if (!floor) continue;
    const complete = (level === 'L3' || level === 'L4') && passiveRun?.objectiveTimeline.some(objective => objective.id === step);
    if (floor.attacks !== undefined && (row.seconds >= 20 || complete) && row.attacksPerMinute + (floor.includeGroup ? row.groupAttacksPerMinute : 0) < floor.attacks) passiveFlags.push(`${row.key}:BELOW_ATTACKS_PER_MINUTE_${floor.attacks}`);
    if (floor.firstAttack !== undefined && (row.seconds >= floor.firstAttack || complete) && (row.firstAttackSeconds === null || row.firstAttackSeconds > floor.firstAttack)) passiveFlags.push(`${row.key}:FIRST_ATTACK_OVER_${floor.firstAttack}_SECONDS`);
    if (floor.reachability !== undefined && row.last && row.last.alive > 0 && row.last.reachable * 100 / row.last.alive < floor.reachability)
      passiveFlags.push(`${row.key}:BELOW_REACHABILITY_PERCENT_${floor.reachability}`);
  }
  for (const wave of passiveObservation?.waves ?? []) passiveFlags.push(...wave.flags.map(flag => `wave/${wave.key}:${flag}`));
  if (!multiSeedPace) passiveFlags.push(...followerCoverageFlags(level, observation?.phases ?? []));
  if (followerPaceChecks[level]) passiveFlags.push(...followerWaitFlags(observation?.followerWait));
  const receipt: LevelReceipt = { level, quality, definitions, run, observation, flags, passiveRun, passiveObservation, passiveFlags, kiting, wallSeconds, nativeStateHash: skilled?.nativeStateHash ?? null };
  if (level === 'L4') {
    const hold = stage('L4/high-hold');
    if (hold.error || !hold.highHold) throw new Error(`Missing L4 high hold: ${hold.error ?? 'no census'}`);
    receipt.highHold = hold.highHold;
    console.log(`[qa:threat] L4 high hold: ${JSON.stringify(receipt.highHold)}`);
  }
  if (level === 'L3') {
    receipt.l3Army = armyLineVerdict([1, 2, 3].map(seed => stage(stageId(level, false, seed)).l3?.army
      ?? { seed, valid: false, army: null, attacksPerMinute: null }));
    receipt.l3SurvivalSeeds = [1, 2, 3].map(seed => stage(stageId(level, false, seed)).l3?.survival
      ?? { seed, valid: false, s1: null, density: { near30: [], maxConcurrent: 0, cap: 0 } });
    console.log(`[qa:threat] L3 army line over seeds 1–3: ${JSON.stringify(receipt.l3Army)}`);
  }
  if (multiSeedPace) {
    const extraSeeds = (passive: boolean): FollowerPaceSeed[] => [2, 3].map(seed => {
      const result = stage(stageId(level, passive, seed));
      return result.follower ?? { seed, valid: false, companions: [], phases: [], error: result.error ?? 'Missing seed result' };
    });
    receipt.followerPaceSeeds = [{ seed: 1, outcome: run?.outcome, nativeStateHash: skilled?.nativeStateHash ?? undefined, valid: !!run?.completed, companions: [], phases: observation?.phases ?? [] }, ...extraSeeds(false)];
    receipt.passiveFollowerPaceSeeds = [{ seed: 1, outcome: passiveRun?.outcome, valid: !!passiveRun && (passiveRun.completed || passiveRun.outcome === 'tick-budget'), companions: [], phases: passiveObservation?.phases ?? [] }, ...extraSeeds(true)];
    receipt.followerPace = followerPaceVerdict(receipt.followerPaceSeeds, { required: followerPaceChecks[level] });
    receipt.passiveFollowerPace = followerPaceVerdict(receipt.passiveFollowerPaceSeeds);
    flags.push(...receipt.followerPace.flags);
    passiveFlags.push(...receipt.followerPace.flags, ...receipt.passiveFollowerPace.flags);
    console.log(`[qa:threat] ${level} follower pace over seeds 1–3: skilled ${receipt.followerPace.flags.length}, passive ${receipt.passiveFollowerPace.flags.length} flags`);
  }
  for (const row of focusedCriteria([receipt])) if (row.verdict === 'FAIL') passiveFlags.push(`criterion/${row.id}:FAIL`);
  levels.push(receipt);
  console.log(`[qa:threat] ${level}: skilled ${run?.outcome ?? 'error'}, passive ${passiveRun?.outcome ?? 'error'}, ${passiveFlags.length} passive flags (${receipt.wallSeconds.toFixed(1)}s)`);
  await writeFile(join(values.out!, `${level}.json`), JSON.stringify(receipt, null, 2) + '\n');
}
const seconds = (performance.now() - started) / 1000;
const flags = levels.flatMap(level => level.passiveFlags.map(flag => `${level.level}/${flag}`));
if (selected.length !== runnerLevels.length) flags.push('PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate');
if (values.report && sourceMatchesMain !== true) flags.push('BASELINE_MAIN_SOURCE_NOT_VERIFIED');
const receipt: AuditReceipt = { revision, mainRevision, sourceMatchesMain, seed: 1, policy: 'kiting + passive', tier: 'low', workers: maxWorkers, seconds, flags, levels };
await writeFile(join(values.out!, 'audit.json'), JSON.stringify(receipt, null, 2) + '\n');
const reportPath = values.report ?? join(values.out!, 'README.md');
await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, renderReport(receipt, !!values.report));
if (values.report) await writeFile(join(dirname(reportPath), 'baseline.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(`[qa:threat] ${seconds.toFixed(1)}s; ${flags.length} fail flags; ${reportPath}`);
process.exitCode = flags.length ? 1 : 0;
