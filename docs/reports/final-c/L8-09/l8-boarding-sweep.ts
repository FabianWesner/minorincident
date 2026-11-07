import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { runLevel } from '../../sim-runner/levels';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';

// Read only: leave the canonical input policy, actors, boarding and RNG intact.
const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L8-default'); campaign.settings.quality = tier;
  const control = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L8-${tier}-complete.json`, 'utf8')) as NativeReceipt;
  assert.equal(control.sourceHash, identity.sourceHash);
  assert.equal(control.observerHash, identity.observerHash);
  const samples: object[] = [];
  let finalHash = '', transfer: unknown;
  const run = await runLevel('L8', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      const update = world.update.bind(world);
      world.update = () => {
        update();
        const zoo = world.missions!.l8!;
        if (!zoo.boarding() || zoo.departing()) return;
        const car = world.entities.get(zoo.state.carId)!, ids = zoo.passengers();
        const waiting = ids.filter(id => !car.vehicle!.passengers?.some(p => p.id === id && p.phase === 'seated'));
        const player = world.entities.get(1)!;
        samples.push({ tick: world.tick, carId: car.id, canDrive: zoo.canDrive(), ids, waiting,
          player: { ...player.transform }, actors: waiting.map(id => structuredClone(world.entities.get(id))) });
      };
    },
    beforeDispose: world => {
      finalHash = stateHash(world.getState());
      transfer = world.missions!.l8!.transferOrNull();
    },
  });
  assert.equal(finalHash, control.nativeStateHash, 'read-only boarding observer must preserve canonical state');
  assert(samples.length > 0);
  const path = `docs/reports/final-c/L8-09/${tier}-boarding-samples.json.gz`;
  const bytes = gzipSync(JSON.stringify(samples)); writeFileSync(path, bytes);
  rows.push({ tier, run, sampleCount: samples.length, samplesPath: path,
    samplesSha256: createHash('sha256').update(bytes).digest('hex'), transfer,
    nativeStateHash: finalHash, controlStateHash: control.nativeStateHash, controlIdentical: true });
  console.log(tier, run.outcome, samples.length, 'boarding ticks; control identical');
}
atomicJson('docs/reports/final-c/L8-09/boarding-native.json', { ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  method: 'Canonical complete policy both tiers, every boarding tick before departure; actual full mission passenger set and unseated snapshots. No actor/input/vehicle changes. Independent final-state control equality. Samples support a separate production UI replay, not a claim of rendered visibility.', rows });
