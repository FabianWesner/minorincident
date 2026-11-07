import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { cure } from '../../../src/levels/L10/district';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';

// Absolute acceptance bounds, independent of authored population settings.
const targets = [
  { region: 'residential-fringe', low: [8, 16], high: [12, 24], dogs: [1, 2], alphas: [0, 0] },
  { region: 'industrial-area', low: [16, 28], high: [25, 45], dogs: [2, 4], alphas: [1, 1] },
  { region: 'military-zone', low: [28, 45], high: [45, 75], dogs: [2, 4], alphas: [1, 2] },
  { region: 'research-campus', low: [35, 55], high: [55, 85], dogs: [2, 4], alphas: [1, 2] },
  { region: 'destroyed-corridor', low: [50, 75], high: [80, 130], dogs: [3, 5], alphas: [2, 3] },
  { region: 'dispersal-complex', low: [75, 95], high: [140, 190] },
] as const;
const identity = provenance(), rows = [];
type Census = { tick: number; count: number; regular: number; dogs: number; alphas: number; ids: number[];
  specialActors: { id: number; archetype: string; x: number; z: number; cureRegion?: string; hidden: boolean }[] };
type Interval = { firstTick: number; lastTick: number; count: number; regular: number; dogs: number; alphas: number };
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L10-default'); campaign.settings.quality = tier;
  const regions = targets.map(target => ({ region: target.region, ticks: 0, upperViolations: 0,
    peak: 0, peakCensus: null as Census | null, witness: null as Census | null, intervals: [] as Interval[] }));
  let finalHash = '';
  const run = await runLevel('L10', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      const update = world.update.bind(world);
      world.update = () => {
        update();
        if (world.missions!.state.states['cure-released']) return;
        const player = world.entities.get(1)!;
        const region = cure.regions.find(r => player.transform.x >= r.envelope[0][0] && player.transform.x <= r.envelope[1][0]);
        const index = targets.findIndex(target => target.region === region?.id);
        if (!region || index < 0) return;
        const target = targets[index], record = regions[index], bounds = target[tier];
        const actors = world.infected!.active.filter(actor => actor.health.current > 0 && !actor.corpse && !actor.hidden && !actor.pendingAdmission && !actor.infected?.pursuit &&
          actor.transform.x >= region.envelope[0][0] && actor.transform.x <= region.envelope[1][0] && actor.transform.z >= region.envelope[0][1] && actor.transform.z <= region.envelope[1][1]);
        const dogs = actors.filter(actor => actor.archetype.includes('dog')).length;
        const alphas = actors.filter(actor => actor.archetype.includes('alpha')).length;
        const regular = actors.length - dogs - alphas;
        const count = target.region === 'residential-fringe' ? regular : actors.length;
        record.ticks++;
        if (count > record.peak) {
          record.peak = count;
          record.peakCensus = { tick: world.tick, count, regular, dogs, alphas, ids: actors.map(actor => actor.id),
            specialActors: actors.filter(actor => actor.archetype.includes('dog') || actor.archetype.includes('alpha')).map(actor => ({
              id: actor.id, archetype: actor.archetype, x: actor.transform.x, z: actor.transform.z,
              cureRegion: actor.infected?.cureRegion, hidden: !!actor.hidden || !!actor.infected?.hidden,
            })) };
        }
        const previous = record.intervals.at(-1);
        if (previous && previous.lastTick === world.tick - 1 && previous.count === count && previous.regular === regular && previous.dogs === dogs && previous.alphas === alphas) previous.lastTick = world.tick;
        else record.intervals.push({ firstTick: world.tick, lastTick: world.tick, count, regular, dogs, alphas });
        if (count > bounds[1] || ('dogs' in target && (dogs > target.dogs[1] || alphas > target.alphas[1]))) record.upperViolations++;
        if (!record.witness && count >= bounds[0] && count <= bounds[1] &&
          (!('dogs' in target) || (dogs >= target.dogs[0] && dogs <= target.dogs[1] && alphas >= target.alphas[0] && alphas <= target.alphas[1]))) {
          record.witness = { tick: world.tick, count, regular, dogs, alphas, ids: actors.map(actor => actor.id),
            specialActors: actors.filter(actor => actor.archetype.includes('dog') || actor.archetype.includes('alpha')).map(actor => ({
              id: actor.id, archetype: actor.archetype, x: actor.transform.x, z: actor.transform.z,
              cureRegion: actor.infected?.cureRegion, hidden: !!actor.hidden || !!actor.infected?.hidden,
            })) };
        }
      };
    },
    beforeDispose: world => { finalHash = stateHash(world.getState()); },
  });
  const control = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L10-${tier}-complete.json`, 'utf8')) as NativeReceipt;
  assert(run.completed && control.sourceHash === identity.sourceHash);
  assert.equal(finalHash, control.nativeStateHash, 'simultaneous census must preserve the native route');
  for (const region of regions) assert.equal(region.intervals.reduce((sum, interval) => sum + interval.lastTick - interval.firstTick + 1, 0), region.ticks);
  rows.push({ tier, regions, nativeStateHash: finalHash, controlIdentical: true });
  console.log(tier, regions.map(region => ({ region: region.region, ticks: region.ticks, upperViolations: region.upperViolations,
    peakCensus: region.peakCensus && { ...region.peakCensus, ids: region.peakCensus.ids.length },
    witness: region.witness && { ...region.witness, ids: region.witness.ids.length }, intervals: region.intervals.length })));
}
atomicJson('docs/reports/final-c/L10-03/composition.json', { ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), targets, rows,
  pass: rows.every(row => row.regions.every(region => region.ticks > 0 && region.witness && !region.upperViolations)),
  method: 'Read-only every-tick admitted living local census on both canonical competent routes. Every region needs one same-tick witness meeting all count/species ranges and no upper-bound violations. Hidden/pending actors and the separate pursuing Mega are excluded. Final state hashes equal independent native controls; authored counts and input are unchanged.' });
