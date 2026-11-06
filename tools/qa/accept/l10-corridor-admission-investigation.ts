import { probeLevel, provenance } from './probe';
import { AcceptanceObserver } from './observer';
import { atomicJson } from './report';
import { readFileSync } from 'node:fs';
const identity = provenance(), samples: unknown[] = [];
const observer = AcceptanceObserver.prototype as unknown as { observe: () => void };
const original = observer.observe;
let last = '';
observer.observe = function (this: unknown) {
  const w = (this as { world: import('../../../src/sim/world/SimWorld').SimWorld }).world;
  const player = w.entities.get(1)!;
  if (player.transform.x > 2900 && player.transform.x < 3350) {
    const ids = Object.entries(w.l10Encounters!.state.spawned).filter(([slot]) => slot.startsWith('corridor-line:infected.runner:')).map(([, id]) => id);
    const signature = ids.join(',');
    if (signature !== last) {
      last = signature;
      const active = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden);
      samples.push({ tick: w.tick, player: { x: player.transform.x, z: player.transform.z }, ids,
        living: ids.filter(id => (w.entities.get(id)?.health.current ?? 0) > 0),
        cap: w.infected!.director.cap, count: w.infected!.director.count, reserved: w.infected!.director.reserved,
        byRegion: Object.fromEntries([...new Set(active.map(e => e.infected?.cureRegion ?? 'unassigned'))].map(region => [region, active.filter(e => (e.infected?.cureRegion ?? 'unassigned') === region).length])),
        dogs: active.filter(e => e.archetype.includes('dog')).map(e => ({ id: e.id, region: e.infected?.cureRegion,
          slot: Object.entries(w.l10Encounters!.state.spawned).find(([, id]) => id === e.id)?.[0] })) });
    }
  }
  original.call(this);
};
const receipt = await probeLevel('L10', 'low', 'stationary', identity);
observer.observe = original;
const control = JSON.parse(readFileSync('docs/reports/fix51-verify/receipts/L10-low-stationary.json', 'utf8'));
atomicJson(`docs/reports/fix65-c/L10-03-corridor-${process.argv[2] ?? 'before'}.json`, { ...identity, samples,
  peak: receipt.observation?.regions['destroyed-corridor']?.regularGroupPeaks, regions: receipt.observation?.regions, nativeStateHash: receipt.nativeStateHash,
  sameAsControl: control.sourceHash === identity.sourceHash && control.nativeStateHash === receipt.nativeStateHash });
console.log(samples, receipt.observation?.regions['destroyed-corridor']?.regularGroupPeaks);
