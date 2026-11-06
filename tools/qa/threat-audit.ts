import { execFileSync, fork } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { runnerLevels, runLevel, type RunnerLevel, type LevelReport } from '../sim-runner/levels';
import { newCampaign, preset, type ProgressionPreset } from '../../src/sim/progression/Campaign';
import { ThreatObserver, followerCoverageFlags, followerPaceChecks, followerWaitFlags } from './threat/observer';
import { threatSteps } from './threat/phases';
import { proveThreatAudit, provePassiveFrom } from './threat/proof';
import { renderReport } from './threat/report';
import { stateHash } from '../../src/sim/world/stateHash';
import { L4HoldCensus } from './threat/l4-hold';
import { focusedCriteria } from './threat/criteria';
import { armyLineVerdict, type ArmyLineVerdict } from './threat/l3ArmyLine';
import { l3ArmySeeds } from './threat/l3ArmySeeds';
import { followerPaceVerdict, type FollowerPaceSeed, type FollowerPaceVerdict } from './threat/followerPace';
import { extraFollowerPaceSeeds } from './threat/followerPaceSeeds';

export interface LevelReceipt {
  level: RunnerLevel; quality: string; definitions: ThreatObserver['definitions']; run: LevelReport | null;
  observation: ReturnType<ThreatObserver['finish']> | null; flags: string[]; wallSeconds: number; nativeStateHash: string | null;
  passiveRun: LevelReport | null; passiveObservation: ReturnType<ThreatObserver['finish']> | null; passiveFlags: string[];
  highHold?: ReturnType<L4HoldCensus['finish']>;
  /** L3-06 army line over seeds 1–3 (tools/qa/threat/l3ArmyLine.ts). */
  l3Army?: ArmyLineVerdict;
  followerPace?: FollowerPaceVerdict;
  passiveFollowerPace?: FollowerPaceVerdict;
  followerPaceSeeds?: FollowerPaceSeed[];
  passiveFollowerPaceSeeds?: FollowerPaceSeed[];
}
export interface AuditReceipt {
  revision: string; mainRevision: string; sourceMatchesMain: boolean | null; seed: number; policy: string; tier: string;
  workers: number; seconds: number; flags: string[]; levels: LevelReceipt[];
  passivity?: { seconds: number; levels: number; matches: boolean };
}
const { values } = parseArgs({ options: {
  maxWorkers: { type: 'string', default: '2' }, levels: { type: 'string' },
  out: { type: 'string', default: 'test-results/qa-threat' }, report: { type: 'string' }, proof: { type: 'boolean' },
  'passive-from': { type: 'string' },
} });
const maxWorkers = Number(values.maxWorkers);
if (!Number.isInteger(maxWorkers) || maxWorkers < 1 || maxWorkers > 2) throw new Error('--maxWorkers must be 1 or 2');
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
// Each leaf uses one simulation process, including serial extra follower seeds.
// Waiting for exit keeps the whole audit within the existing two-worker cap.
const parallelLevels = maxWorkers === 2 && selected.length > 1;
if (parallelLevels) {
  const pending = [...selected];
  const completed = new Map<RunnerLevel, LevelReceipt>();
  const worker = async () => {
    for (let level = pending.shift(); level; level = pending.shift()) {
      const out = join(values.out!, level);
      const code = await new Promise<number | null>((resolve, reject) => {
        const child = fork(fileURLToPath(import.meta.url), ['--levels', level, '--maxWorkers', '1', '--out', out], {
          execArgv: ['--import', 'tsx/esm'], stdio: 'inherit',
          env: { ...process.env, QA_THREAT_REVISION: revision, QA_THREAT_MAIN_REVISION: mainRevision,
            ...(sourceMatchesMain === null ? {} : { QA_THREAT_SOURCE_MATCHES_MAIN: String(sourceMatchesMain) }) },
        });
        child.once('error', reject);
        child.once('exit', resolve);
      });
      const audit = JSON.parse(await readFile(join(out, 'audit.json'), 'utf8')) as AuditReceipt;
      const partial = 'PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate';
      const row = audit.levels[0];
      if (audit.revision !== revision || audit.mainRevision !== mainRevision || audit.sourceMatchesMain !== sourceMatchesMain
        || audit.seed !== 1 || audit.tier !== 'low' || audit.policy !== 'complete + passive' || audit.workers !== 1
        || audit.levels.length !== 1 || row?.level !== level
        || audit.flags.filter(flag => flag === partial).length !== 1
        || JSON.stringify(audit.flags.filter(flag => flag !== partial)) !== JSON.stringify(row.passiveFlags.map(flag => `${level}/${flag}`))
        || code !== 1) throw new Error(`Invalid isolated threat receipt for ${level} (exit ${code})`);
      completed.set(level, row);
      await writeFile(join(values.out!, `${level}.json`), JSON.stringify(row, null, 2) + '\n');
    }
  };
  // allSettled waits for both owned workers even if a leaf fails unexpectedly.
  const results = await Promise.allSettled([worker(), worker()]);
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  for (const level of selected) {
    const row = completed.get(level);
    if (!row) throw new Error(`Missing isolated threat receipt for ${level}`);
    levels.push(row);
  }
}
for (const level of parallelLevels ? [] : selected) {
  console.log(`[qa:threat] ${level}: skilled and passive native routes, seed=1, low population`);
  const multiSeedPace = level === 'L5' || level === 'L7';
  const start = performance.now(), holder: { audit?: ThreatObserver; observation?: ReturnType<ThreatObserver['finish']>; hash?: string } = {};
  const campaign = level === 'L1' ? newCampaign('female', 1) : preset(`${level}-default` as ProgressionPreset);
  campaign.seed = 1; campaign.settings.quality = 'low';
  let run: LevelReport | null = null;
  const flags: string[] = [];
  try {
    run = await runLevel(level, 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
      quality: 'low', beforeBegin: world => { holder.audit = new ThreatObserver(world, level); },
      beforeDispose: world => { holder.observation = holder.audit?.finish(); holder.hash = stateHash(world.getState()); },
    });
  } catch (error) { flags.push(`AUDIT_ERROR:${String(error)}`); }
  const observation = holder.observation ?? null, definitions = holder.audit?.definitions ?? [];
  if (!run?.completed) flags.push(`INCOMPLETE_NATIVE_POLICY:${run?.outcome ?? 'error'}`);
  if (!observation?.phases.length) flags.push('MISSING_PHASE_OBSERVATIONS');
  if (holder.audit?.quality !== 'low') flags.push(`WRONG_POPULATION_TIER:${holder.audit?.quality ?? 'missing'}`);
  for (const id of Object.keys(threatSteps[level])) {
    if (!definitions.some(step => step.id === id)) flags.push(`THREAT_INVENTORY_DRIFT:${id}`);
    if (!observation?.phases.some(row => row.key === `step/${id}`)) flags.push(`UNOBSERVED_THREAT_STEP:${id}`);
  }
  for (const row of observation?.phases ?? []) flags.push(...row.flags.filter(flag => !multiSeedPace || !flag.startsWith('SLOW_FOLLOWER:')).map(flag => `${row.key}:${flag}`));
  for (const wave of observation?.waves ?? []) flags.push(...wave.flags.map(flag => `wave/${wave.key}:${flag}`));
  const passiveHolder: { audit?: ThreatObserver; observation?: ReturnType<ThreatObserver['finish']> } = {};
  let passiveRun: LevelReport | null = null; const passiveFlags: string[] = [];
  try {
    const campaign = level === 'L1' ? newCampaign('female', 1) : preset(`${level}-default` as ProgressionPreset);
    campaign.seed = 1; campaign.settings.quality = 'low';
    // L8 measures the full calm minute plus 90 s of passive breach combat.
    // An undefended APC can be destroyed; do not spend 1,200 s trying to board
    // its wreck. The combat window exceeds the original 85.5 s baseline.
    const passiveWindowSeconds: Partial<Record<RunnerLevel, number>> = { L3: 70, L4: 250, L6: 110, L8: 150 };
    passiveRun = await runLevel(level, 'complete', 1, passiveWindowSeconds[level], 'auto', campaign, undefined, 0, {
      quality: 'low', passive: true, beforeBegin: world => { passiveHolder.audit = new ThreatObserver(world, level); },
      beforeDispose: () => { passiveHolder.observation = passiveHolder.audit?.finish(); },
    });
  } catch (error) { passiveFlags.push(`AUDIT_ERROR:${String(error)}`); }
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
  const passiveObservation = passiveHolder.observation ?? null;
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
  const receipt: LevelReceipt = { level, quality: holder.audit?.quality ?? 'missing', definitions, run, observation, flags, passiveRun, passiveObservation, passiveFlags, wallSeconds: (performance.now() - start) / 1000, nativeStateHash: holder.hash ?? null };
  if (level === 'L4') {
    console.log('[qa:threat] L4: high-tier native hold census through the line break');
    let census: L4HoldCensus | undefined;
    await runLevel('L4', 'complete', 1, 250, 'auto', undefined, undefined, 0, { quality: 'high', passive: true,
      beforeBegin: world => { census = new L4HoldCensus(world); }, beforeDispose: () => { receipt.highHold = census!.finish(); } });
    console.log(`[qa:threat] L4 high hold: ${JSON.stringify(receipt.highHold)}`);
  }
  if (level === 'L3') {
    const army = observation?.l3Squad?.army ?? null;
    receipt.l3Army = armyLineVerdict([{ seed: 1, valid: !!run?.completed && army !== null, army }, ...await l3ArmySeeds('low')]);
    console.log(`[qa:threat] L3 army line over seeds 1–3: ${JSON.stringify(receipt.l3Army)}`);
  }
  if (multiSeedPace) {
    receipt.followerPaceSeeds = [{ seed: 1, outcome: run?.outcome, nativeStateHash: holder.hash, valid: !!run?.completed, companions: [], phases: observation?.phases ?? [] }, ...await extraFollowerPaceSeeds(level, 'low', false, maxWorkers)];
    receipt.passiveFollowerPaceSeeds = [{ seed: 1, outcome: passiveRun?.outcome, valid: !!passiveRun && (passiveRun.completed || passiveRun.outcome === 'tick-budget'), companions: [], phases: passiveObservation?.phases ?? [] }, ...await extraFollowerPaceSeeds(level, 'low', true, maxWorkers)];
    receipt.followerPace = followerPaceVerdict(receipt.followerPaceSeeds, { required: followerPaceChecks[level] });
    receipt.passiveFollowerPace = followerPaceVerdict(receipt.passiveFollowerPaceSeeds);
    flags.push(...receipt.followerPace.flags);
    passiveFlags.push(...receipt.followerPace.flags, ...receipt.passiveFollowerPace.flags);
    console.log(`[qa:threat] ${level} follower pace over seeds 1–3: skilled ${receipt.followerPace.flags.length}, passive ${receipt.passiveFollowerPace.flags.length} flags`);
  }
  receipt.wallSeconds = (performance.now() - start) / 1000;
  for (const row of focusedCriteria([receipt])) if (row.verdict === 'FAIL') passiveFlags.push(`criterion/${row.id}:FAIL`);
  levels.push(receipt);
  console.log(`[qa:threat] ${level}: skilled ${run?.outcome ?? 'error'}, passive ${passiveRun?.outcome ?? 'error'}, ${passiveFlags.length} passive flags (${receipt.wallSeconds.toFixed(1)}s)`);
  await writeFile(join(values.out!, `${level}.json`), JSON.stringify(receipt, null, 2) + '\n');
}
const seconds = (performance.now() - started) / 1000;
const flags = levels.flatMap(level => level.passiveFlags.map(flag => `${level.level}/${flag}`));
if (selected.length !== runnerLevels.length) flags.push('PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate');
if (values.report && sourceMatchesMain !== true) flags.push('BASELINE_MAIN_SOURCE_NOT_VERIFIED');
const receipt: AuditReceipt = { revision, mainRevision, sourceMatchesMain, seed: 1, policy: 'complete + passive', tier: 'low', workers: selected.some(level => level === 'L5' || level === 'L7') ? maxWorkers : 1, seconds, flags, levels };
await writeFile(join(values.out!, 'audit.json'), JSON.stringify(receipt, null, 2) + '\n');
const reportPath = values.report ?? join(values.out!, 'README.md');
await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, renderReport(receipt, !!values.report));
if (values.report) await writeFile(join(dirname(reportPath), 'baseline.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(`[qa:threat] ${seconds.toFixed(1)}s; ${flags.length} fail flags; ${reportPath}`);
process.exitCode = flags.length ? 1 : 0;
