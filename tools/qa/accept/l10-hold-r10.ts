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

const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L10-default'); campaign.settings.quality = tier;
  let activation: number | null = null, arena: number | null = null, close: number | null = null;
  let peak = 0, lastCount = 0, samples = 0, finalHash = '', threat: ThreatObserver | undefined;
  let finalThreat: ReturnType<ThreatObserver['finish']> | undefined;
  const trajectory: unknown[] = [], megaIds = new Set<number>();
  const scheduledRelocations: { tick: number; id: number; writer: string; metres: number }[] = [];
  let previousMega: { id: number; x: number; z: number } | null = null, maximumMegaStepMetres = 0;
  const movementDiscontinuities: { tick: number; id: number; metres: number }[] = [];
  const run = await runLevel('L10', 'complete', 1, 1800, 'auto', campaign, undefined, 0, {
    quality: tier, passive: true, passiveHoldSeconds: 240,
    beforeBegin: w => {
      threat = new ThreatObserver(w, 'L10');
      const relocate = w.solids.relocate.bind(w.solids);
      w.solids.relocate = (entity, at, writer, range, navigation) => {
        const from = { x: entity.transform.x, z: entity.transform.z };
        const moved = relocate(entity, at, writer, range, navigation);
        if (moved && entity.infected?.pursuit) scheduledRelocations.push({ tick: w.tick, id: entity.id, writer, metres: Math.hypot(entity.transform.x - from.x, entity.transform.z - from.z) });
        return moved;
      };
      const apply = w.applyInput.bind(w);
      w.applyInput = (frame, scheme) => apply(w.missions!.state.states['charge-active'] ? emptyInput() : frame, scheme);
      const update = w.update.bind(w);
      w.update = () => {
        update();
        if (w.megaPursuit?.state.id) megaIds.add(w.megaPursuit.state.id);
        const currentMega = w.megaPursuit?.entity();
        if (currentMega) {
          if (previousMega?.id === currentMega.id) {
            const metres = Math.hypot(currentMega.transform.x - previousMega.x, currentMega.transform.z - previousMega.z);
            maximumMegaStepMetres = Math.max(maximumMegaStepMetres, metres);
            if (metres > 1) movementDiscontinuities.push({ tick: w.tick, id: currentMega.id, metres });
          }
          previousMega = { id: currentMega.id, x: currentMega.transform.x, z: currentMega.transform.z };
        }
        if (!w.missions!.state.states['charge-active']) return;
        activation ??= w.tick;
        const mega = w.megaPursuit!.entity(), consoleAnchor = w.missions!.def.anchors['cure-console'];
        const distance = mega ? Math.hypot(mega.transform.x-consoleAnchor.x, mega.transform.z-consoleAnchor.z) : null;
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
  assert.equal(expected.sourceHash, identity.sourceHash); assert.equal(expected.observerHash, identity.observerHash);
  assert.equal(run.outcome, 'tick-budget');
  assert.equal(samples, 240*60, 'full four-minute assault window');
  assert.equal(finalHash, expected.nativeStateHash, 'read-only hold observation must preserve the native final state');
  const result = { tier, run, activationTick: activation, firstInside25mTick: arena, firstInside12mTick: close,
    arenaAfterActivationSeconds: arena !== null && activation !== null ? (arena-activation)/60 : null,
    closeAfterActivationSeconds: close !== null && activation !== null ? (close-activation)/60 : null,
    observedSeconds: samples/60, peakAlive: peak, lastAlive: lastCount, nativeStateHash: finalHash, controlIdentical: finalHash === expected.nativeStateHash,
    persistentMegaIds: [...megaIds], scheduledRelocations,
    maximumMegaStepMetres, movementDiscontinuities,
    phases: finalThreat!.phases.filter(phase => ['step/hold', 'step/mega'].includes(phase.key)), trajectory };
  rows.push(result);
  console.log(`${tier}: peak ${peak}, arena +${result.arenaAfterActivationSeconds}s, 240s observation; control identical=${result.controlIdentical}`);
}
const toolSha256 = createHash('sha256').update(readFileSync('tools/qa/accept/l10-hold-r10.ts')).digest('hex');
atomicJson('docs/reports/fix51-r10c/l10-hold-proof.json', { ...identity, toolSha256,
  method: 'Ordinary native stationary policy; 240 active seconds after charge activation; actual first Mega centre crossing of 25m arena and 12m close-move radii. Track every Mega movement tick from introduction, and all actual Mega relocations regardless of writer. Native final state must match the independent canonical acceptance control.', rows });
