import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { emptyInput } from '../../../src/input/InputFrame';
import { stateHash } from '../../../src/sim/world/stateHash';
import { ThreatObserver } from '../threat/observer';
import { provenance } from './probe';
import { atomicJson } from './report';

const trial = process.argv.includes('--trial');
const identity = provenance();
const rows = [];
for (const tier of process.argv.includes('--low-only') ? ['low'] as const : ['low', 'high'] as const) {
  const campaign = preset('L10-default'); campaign.settings.quality = tier;
  let activation: number | null = null, arena: number | null = null, close: number | null = null;
  let peak = 0, lastCount = 0, samples = 0, finalHash = '', threat: ThreatObserver | undefined;
  let finalThreat: ReturnType<ThreatObserver['finish']> | undefined;
  const trajectory: unknown[] = [];
  const run = await runLevel('L10', 'complete', 1, 1800, 'auto', campaign, undefined, 0, {
    quality: tier, passive: true, passiveHoldSeconds: 240,
    beforeBegin: w => {
      threat = new ThreatObserver(w, 'L10');
      const apply = w.applyInput.bind(w);
      w.applyInput = (frame, scheme) => apply(w.missions!.state.states['charge-active'] ? emptyInput() : frame, scheme);
      const update = w.update.bind(w);
      w.update = () => {
        update();
        if (!w.missions!.state.states['charge-active']) return;
        activation ??= w.tick;
        const mega = w.megaPursuit!.entity(), console = w.missions!.def.anchors['cure-console'];
        const distance = mega ? Math.hypot(mega.transform.x-console.x, mega.transform.z-console.z) : null;
        if (distance !== null && distance <= 25) arena ??= w.tick;
        if (distance !== null && distance <= 12) close ??= w.tick;
        lastCount = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.pendingAdmission).length;
        peak = Math.max(peak, lastCount); samples++;
        if (w.tick % 60 === 0) trajectory.push({ tick: w.tick, afterActivation: (w.tick-activation)/60, alive: lastCount, megaDistance: distance,
          mega: mega ? { id: mega.id, x: mega.transform.x, z: mega.transform.z, mode: w.megaPursuit!.state.mode } : null });
      };
    },
    beforeDispose: w => { finalHash = stateHash(w.getState()); finalThreat = threat!.finish(); },
  });
  const expected = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L10-${tier}-stationary.json`, 'utf8'));
  if (!trial) assert.equal(finalHash, expected.nativeStateHash, 'read-only hold observation must preserve the native final state');
  assert.equal(samples, 240*60, 'full four-minute assault window');
  const result = { tier, run, activationTick: activation, firstInside25mTick: arena, firstInside12mTick: close,
    arenaAfterActivationSeconds: arena !== null && activation !== null ? (arena-activation)/60 : null,
    closeAfterActivationSeconds: close !== null && activation !== null ? (close-activation)/60 : null,
    observedSeconds: samples/60, peakAlive: peak, lastAlive: lastCount, nativeStateHash: finalHash, controlIdentical: finalHash === expected.nativeStateHash,
    phases: finalThreat!.phases.filter(phase => ['step/hold', 'step/mega'].includes(phase.key)), trajectory };
  rows.push(result);
  console.log(`${tier}: peak ${peak}, arena +${result.arenaAfterActivationSeconds}s, 240s observation; control identical=${result.controlIdentical}`);
}
atomicJson(`docs/reports/fix51-r8c/l10-hold-${trial ? `trial-${identity.sourceHash.slice(0, 12)}` : 'proof'}.json`, { ...identity, trial, toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  method: 'Current-source full 240-second native assault; native tick census, both-tier capped peak, per-region/player threat, actual first 25m/12m Mega contact, and full milestone positions. Read-only control state hashes must match.', rows });
