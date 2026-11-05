import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { cure } from '../../../src/levels/L10/district';
import { stateHash } from '../../../src/sim/world/stateHash';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';

const identity = provenance(), rows = [];
const fringe = cure.regions.find(region => region.id === 'residential-fringe')!;
for (const tier of ['low', 'high'] as const) {
  const control = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L10-${tier}-complete.json`, 'utf8')) as NativeReceipt;
  assert.equal(control.sourceHash, identity.sourceHash); assert.equal(control.observerHash, identity.observerHash);
  const campaign = preset('L10-default'); campaign.settings.quality = tier;
  let pickupTick: number | null = null, firstDogTick: number | null = null, prematureTicks = 0, finalHash = '';
  const run = await runLevel('L10', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      world.events.on('pickup.collected', event => {
        if (event.type === 'pickup.collected' && ('actionId' in event ? event.actionId : event.item) === 'weapon.pistol') pickupTick ??= event.tick;
      });
      const update = world.update.bind(world);
      world.update = () => {
        update();
        const dogs = world.infected!.active.filter(actor => actor.health.current > 0 && !actor.hidden && !actor.pendingAdmission && actor.archetype.includes('dog') &&
          actor.transform.x >= fringe.envelope[0][0] && actor.transform.x <= fringe.envelope[1][0] && actor.transform.z >= fringe.envelope[0][1] && actor.transform.z <= fringe.envelope[1][1]);
        if (dogs.length) { firstDogTick ??= world.tick; if (pickupTick === null) prematureTicks++; }
      };
    },
    beforeDispose: world => { finalHash = stateHash(world.getState()); },
  });
  assert(run.completed); assert.equal(finalHash, control.nativeStateHash, 'read-only dog timing must leave the native control identical');
  rows.push({ tier, pickupTick, firstDogTick, prematureTicks, nativeStateHash: finalHash, controlIdentical: true });
}
atomicJson('docs/reports/fix51-verify/receipts/L10-fringe-dogs.json', { ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  method: 'Every native tick, both competent quality routes: first living admitted residential dog versus actual handgun pickup event; no input, actor or RNG changes; final state equals canonical control.', rows });
console.log(rows);
