import { armyLineVerdict, type ArmyLineVerdict } from '../threat/l3ArmyLine';
import { l3ArmySeeds } from '../threat/l3ArmySeeds';
import { extraFollowerPaceSeeds } from '../threat/followerPaceSeeds';
import type { FollowerPaceSeed } from '../threat/followerPace';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runLevel, type RunnerLevel, type LevelReport } from '../../sim-runner/levels';
import { newCampaign, preset, type ProgressionPreset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { emptyInput } from '../../../src/input/InputFrame';
import { ThreatObserver } from '../threat/observer';
import { L4HoldCensus } from '../threat/l4-hold';
import { AcceptanceObserver, type AcceptanceObservation } from './observer';

export type Tier = 'low' | 'high';
export interface NativeReceipt {
  version: 2; level: RunnerLevel; tier: Tier; policy: 'complete' | 'stationary'; seed: number;
  sourceHash: string; observerHash: string; revision: string; generatedAt: string;
  run: LevelReport | null; observation: AcceptanceObservation | null;
  threat: ReturnType<ThreatObserver['finish']> | null; highHold?: ReturnType<L4HoldCensus['finish']>;
  nativeStateHash: string | null; error: string | null;
  /** L3-06 army line over seeds 1–3 (complete policy only; tools/qa/threat/l3ArmyLine.ts). */
  l3Army?: ArmyLineVerdict;
  followerPaceSeeds?: FollowerPaceSeed[];
}
function hashFiles(paths: string[]): string {
  const hash = createHash('sha256');
  for (const path of [...new Set(paths)].sort()) { hash.update(path); hash.update('\0'); hash.update(readFileSync(path)); }
  return hash.digest('hex');
}
export function provenance(revision = sourceRevision()) {
  const files = execFileSync('git', ['ls-files', '-z', '--', 'src', 'layouts', 'public/assets/layouts'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const toolFiles = ['tools/qa/accept/observer.ts', 'tools/qa/accept/probe.ts', 'tools/qa/accept/l5-formation.ts', ...['tools/qa/threat', 'tools/sim-runner'].flatMap(dir => readdirSync(dir).filter(file => file.endsWith('.ts')).map(file => join(dir, file)))];
  return { sourceHash: hashFiles(files), observerHash: hashFiles(toolFiles), revision };
}
/** Remote runners have a manifest index without Git history; content hashes remain the authority. */
function sourceRevision(): string {
  if (process.env.QA_ACCEPT_REVISION) return process.env.QA_ACCEPT_REVISION;
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return 'manifest-only'; }
}

/** Ordinary production bots, plus a separately labelled survival-protected stationary policy.
 * The stationary policy reaches its phase by ordinary input and then releases all controls. */
export async function probeLevel(level: RunnerLevel, tier: Tier, policy: NativeReceipt['policy'], identity = provenance()): Promise<NativeReceipt> {
  const receipt: NativeReceipt = { version: 2, level, tier, policy, seed: 1, ...identity, generatedAt: new Date().toISOString(), run: null, observation: null, threat: null, nativeStateHash: null, error: null };
  const campaign = level === 'L1' ? newCampaign('female', 1) : preset(`${level}-default` as ProgressionPreset);
  campaign.settings.quality = tier;
  let acceptance: AcceptanceObserver | undefined, threat: ThreatObserver | undefined, hold: L4HoldCensus | undefined;
  const maxSeconds: Partial<Record<RunnerLevel, number>> = { L1: 360, L2: 240, L3: 90, L4: 250, L5: 240, L6: 360, L7: 240, L8: 180, L10: 1800 };
  try {
    receipt.run = await runLevel(level, 'complete', 1, policy === 'stationary' ? maxSeconds[level] : undefined, 'auto', campaign, undefined, 0, {
      quality: tier, passive: policy === 'stationary', passiveHoldSeconds: level === 'L10' ? 240 : undefined,
      beforeBegin: world => {
        if (level === 'L8' && process.env.L8_NATIVE_PROGRESS) world.events.on('sim.tick', () => { if (world.tick % 1800 === 0) console.log(JSON.stringify({ nativeProgress: policy, tier, tick: world.tick, at: world.entities.get(1)!.transform, hp: world.entities.get(1)!.health.current, arenas: world.missions!.l8!.state.arenas.map(a => ({ id: a.id, phase: a.phase, turned: a.ids.filter(id => !!world.entities.get(id)?.infected).length, living: a.ids.filter(id => (world.entities.get(id)?.health.current ?? 0) > 0).length })) })); });
        threat = new ThreatObserver(world, level); acceptance = new AcceptanceObserver(world);
        if (level === 'L4' && policy === 'stationary') hold = new L4HoldCensus(world);
        if (policy === 'stationary' && level !== 'L9') {
          // L1's generator patches device input through setInput rather than applyInput.
          if (level === 'L1') {
            const setInput = world.setInput.bind(world);
            world.setInput = patch => setInput(world.missions!.state.l1?.phase === 'spread' ? emptyInput() : { ...patch, mouseAttack: false, activeAttack: false, attackInPlace: false, attackTarget: undefined, left: { down: false, held: false, up: false }, right: { down: false, held: false, up: false } });
          }
          const applyInput = world.applyInput.bind(world);
          world.applyInput = (frame, scheme) => {
            const m = world.missions!, s = m.state;
            const stop = level === 'L1' ? s.l1?.phase === 'spread' : level === 'L2' ? !!s.l2?.doorsOpenAt : level === 'L3' ? s.l3?.phase === 'attack' : level === 'L4' ? s.l4?.phase === 'war'
              : level === 'L5' ? s.l5?.phase === 'search' : level === 'L6' ? s.l6?.phase === 'first' || s.l6?.phase === 'fails' : level === 'L7' ? !!world.l7Encounters?.state.started
                : level === 'L8' ? !!m.l8?.state.breachedAt : level === 'L10' ? !!s.states['charge-active'] : false;
            applyInput(stop ? emptyInput() : frame, scheme);
          };
        }
      },
      beforeDispose: world => {
        receipt.observation = acceptance?.finish() ?? null; receipt.threat = threat?.finish() ?? null;
        if (hold) receipt.highHold = hold.finish();
        receipt.nativeStateHash = stateHash(world.getState());
      },
    });
  } catch (error) { receipt.error = error instanceof Error ? error.stack ?? error.message : String(error); }
  if (level === 'L3' && policy === 'complete') {
    const army = receipt.threat?.l3Squad?.army ?? null;
    const checkpoint = receipt.threat?.phases.find(phase => phase.key === 'step/checkpoint');
    receipt.l3Army = armyLineVerdict([{ seed: 1, valid: !!receipt.run?.completed && army !== null, army, attacksPerMinute: checkpoint?.attacksPerMinute ?? null }, ...await l3ArmySeeds(tier)]);
  }
  if ((level === 'L5' || level === 'L7') && policy === 'complete') {
    receipt.followerPaceSeeds = [{ seed: 1, outcome: receipt.run?.outcome, nativeStateHash: receipt.nativeStateHash ?? undefined, valid: !!receipt.run?.completed && !receipt.error, companions: receipt.observation?.corgi.ids ?? [], phases: receipt.threat?.phases ?? [] }, ...await extraFollowerPaceSeeds(level, tier)];
  }
  return receipt;
}
