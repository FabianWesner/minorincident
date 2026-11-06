import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handoverChecks, type Handover } from './l8-handover-receipts';
import { provenance } from './probe';
import { atomicJson } from './report';
const cases = [];
for (const tier of ['low', 'high']) {
  const original = JSON.parse(readFileSync(`docs/reports/sweep-c5/L8-10/${tier}-handover.json`, 'utf8')) as Handover;
  const baseline = handoverChecks(original, tier); assert(baseline.valid && baseline.transport && baseline.clock); cases.push({ tier, fault: 'actual original', observed: baseline });
  const boundary = structuredClone(original); boundary.result.ms = 6000; assert(handoverChecks(boundary, tier).clock); cases.push({ tier, fault: 'synthetic exact6000ms boundary', accepted: true });
  for (const fault of ['6000.01ms', 'zero duration', 'negative duration', 'NaN duration', 'different APC', 'healed durability', 'missing driver', 'inactive APC', 'lost passenger', 'unseated passenger', 'unreviewed capture', 'loading card still shown', 'wrong runtime tier']) {
    const broken = structuredClone(original);
    if (fault === '6000.01ms') broken.result.ms = 6000.01;
    if (fault === 'zero duration') broken.result.ms = 0;
    if (fault === 'negative duration') broken.result.ms = -1;
    if (fault === 'NaN duration') broken.result.ms = NaN;
    if (fault === 'different APC') broken.result.car.id++;
    if (fault === 'healed durability') broken.result.car.health.current++;
    if (fault === 'missing driver') broken.result.car.vehicle.driver = 0;
    if (fault === 'inactive APC') broken.result.active = -1;
    if (fault === 'lost passenger') broken.result.car.vehicle.passengers.pop();
    if (fault === 'unseated passenger') broken.result.car.vehicle.passengers[0].phase = 'enter';
    if (fault === 'unreviewed capture') delete broken.captures[0].seen;
    if (fault === 'loading card still shown') broken.result.loading = true;
    if (fault === 'wrong runtime tier') broken.result.quality = tier === 'low' ? 'high' : 'low';
    const observed = handoverChecks(broken, tier), timing = ['6000.01ms', 'zero duration', 'negative duration', 'NaN duration'].includes(fault);
    assert(timing ? !observed.clock : !observed.transport, `${tier}: ${fault}`); cases.push({ tier, fault, rejected: true });
  }
}
atomicJson('docs/reports/sweep-c5/L8-10/checker-controls.json', { ...provenance(), cases, method: 'Pure consumer controls only; synthetic boundary/counterexamples are never game measurements. Actual proof files unchanged.' });
console.log('Both originals pass; exact6000ms boundary accepts;26 semantic faults reject.');
