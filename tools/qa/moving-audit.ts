import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { SimPhase } from '../../src/core/EventBus';
import { newCampaign, preset, type ProgressionPreset } from '../../src/sim/progression/Campaign';
import { LevelRunStopped, runLevel, runnerLevels, type RunnerLevel, type LevelReport } from '../sim-runner/levels';
import { ThreatObserver } from './threat/observer';
import { installKitingPolicy, finishKitingReceipt, type KitingReceipt } from './threat/kiting';
import { phases } from './threat/phases';

/** One bounded native or moving encounter, using the same input policy as qa:threat.
 * Split level/policy commands so the remote watchdog cannot discard an entire campaign audit. */
const { values } = parseArgs({ options: { level: { type: 'string' }, policy: { type: 'string' }, out: { type: 'string' }, trace: { type: 'boolean' } } });
const level = values.level as RunnerLevel, policy = values.policy;
if (!runnerLevels.includes(level) || !['native', 'retreat', 'circles'].includes(policy ?? '') || !values.out) throw new Error('--level L1–L10 --policy native|retreat|circles --out receipt.json');
const runtimeSha256 = createHash('sha256').update(readFileSync('src/sim/ai/InfectedSystem.ts')).digest('hex');
const policySha256 = createHash('sha256').update(readFileSync('tools/qa/threat/kiting.ts')).digest('hex');
const driverSha256 = level === 'L10' ? createHash('sha256').update(readFileSync('src/debug/bot/LevelTenBot.ts')).digest('hex') : null;
const campaign = level === 'L1' ? newCampaign('female', 1) : preset(`${level}-default` as ProgressionPreset);
campaign.seed = 1; campaign.settings.quality = 'low';
let run: LevelReport | null = null, observation: ReturnType<ThreatObserver['finish']> | null = null;
let observer: ThreatObserver | undefined, done = () => false;
let kiting: KitingReceipt = { kitingSeconds: 0, attacks: 0, attacksPerMinute: 0, samples: 0 };
const flags: string[] = [], start = performance.now();
const stops: { tick: number; position: { x: number; y: number; z: number }; input: { x: number; z: number }; wantedSpeed: number; pendingAdmission: boolean; blocker: string | null; mounted: boolean; hp: number }[] = [];
const damageBuckets: Record<string, { hits: number; damage: number; minDistance: number; maxDistance: number }> = {};
const firstHits: { tick: number; source: string; amount: number; distance: number; speed: number; hidden: boolean; seated: boolean; phase: string }[] = [];
const movingFrames: unknown[] = [];
try {
  run = await runLevel(level, 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: 'low',
    beforeBegin: world => {
      if (policy === 'native') observer = new ThreatObserver(world, level);
      else done = installKitingPolicy(world, kiting, level, policy === 'circles' ? 'circles' : 'retreat');
      if (values.trace) world.events.on('combat.hit', event => {
        if (event.type !== 'combat.hit' || event.targetId !== 1 || event.amount <= 0) return;
        const p = world.entities.get(1)!, source = world.entities.get(event.sourceId), velocity = p.survivor?.velocity;
        const speed = Math.hypot(velocity?.x ?? 0, velocity?.z ?? 0), distance = source ? Math.hypot(p.transform.x - source.transform.x, p.transform.z - source.transform.z) : 0;
        const phase = world.missions ? phases(world, level).map(p => p.key).join(',') : '';
        const hidden = !!p.hidden, seated = !!world.missions?.state.l2?.seated || world.vehicles?.active != null;
        const archetype = source?.archetype ?? event.actionId, key = `${phase}|${archetype}|${speed > .2 ? 'moving' : 'still'}|${hidden ? 'hidden' : 'visible'}|${seated ? 'seated' : 'on-foot'}`;
        const bucket = damageBuckets[key] ??= { hits: 0, damage: 0, minDistance: distance, maxDistance: distance };
        bucket.hits++; bucket.damage += event.amount; bucket.minDistance = Math.min(bucket.minDistance, distance); bucket.maxDistance = Math.max(bucket.maxDistance, distance);
        if (firstHits.length < 96) firstHits.push({ tick: event.tick, source: archetype, amount: event.amount, distance, speed, hidden, seated, phase });
      });
      if (values.trace) world.events.on('sim.tick', () => {
        const p = world.entities.get(1)!, previous = world.previousPlayer;
        if (kiting.diagnostics?.endTick === world.tick - 1 && world.tick % 120 === 0 && movingFrames.length < 16) {
          const nearby = world.infected!.active.filter(e => e.health.current > 0).sort((a, b) => Math.hypot(a.transform.x - p.transform.x, a.transform.z - p.transform.z) - Math.hypot(b.transform.x - p.transform.x, b.transform.z - p.transform.z)).slice(0, 4);
          movingFrames.push({ tick: world.tick, player: { ...p.transform }, nearby: nearby.map(e => ({ id: e.id, archetype: e.archetype, position: { ...e.transform }, state: e.infected!.state, special: e.infected!.special, brain: e.infected!.l1?.mode, cooldown: e.infected!.cooldown, specialAttack: e.infected!.specialAttack?.move })) });
        }
        if (kiting.diagnostics?.endTick !== world.tick - 1 || !previous || stops.length >= 32 || (stops.length && world.tick - stops.at(-1)!.tick < 15) || Math.hypot(p.transform.x - previous.x, p.transform.z - previous.z) * 60 > .05) return;
        const step = world.player!.locomotion.displacement, body = world.solids.blockingBody(1);
        stops.push({ tick: world.tick, position: { x: p.transform.x, y: p.transform.y, z: p.transform.z }, input: { ...world.inputFrame.move }, wantedSpeed: Math.hypot(step.x, step.z) * 60, pendingAdmission: !!p.pendingAdmission, blocker: body ? `${body.archetype}/${body.id}/${body.corpse ? 'corpse' : 'live'}` : null, mounted: !!world.mountedGun?.mounted, hp: p.health.current });
      }, SimPhase.cleanup + 2);
    },
    stopWhen: () => policy !== 'native' && done(),
    beforeDispose: () => { observation = observer?.finish() ?? null; kiting = finishKitingReceipt(kiting); },
  });
} catch (error) { if (!(error instanceof LevelRunStopped)) flags.push(String(error)); }
if (policy === 'native') { if (!run?.completed) flags.push(`INCOMPLETE_NATIVE:${run?.outcome ?? 'error'}`); }
else if (level !== 'L9') {
  if (kiting.kitingSeconds < 10) flags.push('MOVING_SAMPLE_BELOW_10_SECONDS');
  if ((kiting.hitsPerMinute ?? 0) < 2) flags.push('MOVING_HITS_BELOW_2_PER_MINUTE');
  const moving = kiting.diagnostics?.movingSeconds ?? 0, forced = kiting.diagnostics?.immobilizedSeconds ?? 0;
  if (policy === 'circles' && moving / Math.max(1 / 60, kiting.kitingSeconds - forced) < .95) flags.push('CONTROLLABLE_MOVEMENT_BELOW_95_PERCENT');
}
const receipt = { level, policy, seed: 1, quality: 'low', revision: process.env.QA_THREAT_REVISION ?? 'worktree',
  runtimeSha256, policySha256, driverSha256,
  seconds: (performance.now() - start) / 1000, run, observation, kiting: policy === 'native' ? null : kiting, ...(values.trace ? { stops, damageBuckets, firstHits, movingFrames } : {}), flags };
await mkdir(dirname(values.out), { recursive: true });
await writeFile(values.out, JSON.stringify(receipt, null, 2) + '\n');
console.log(`[moving-audit] ${level}/${policy}: ${receipt.seconds.toFixed(1)}s; ${policy === 'native' ? `${run?.outcome}, ${run?.damageTaken} HP` : `${kiting.hits ?? 0} hits / ${kiting.kitingSeconds.toFixed(2)}s`}; ${flags.join(', ') || 'PASS'}`);
process.exitCode = flags.length ? 1 : 0;
